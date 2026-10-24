#!/usr/bin/env python3
"""Local site editor - edit text and design tokens in the browser, saved
straight back into the HTML/CSS source files.

Start it by double-clicking "Edit site.command" in the repo root (or run
`python3 tools/edit-server.py`). It serves the repo on 127.0.0.1 only and
injects tools/editor.js into every page it serves. The live site never loads
editor.js - it only exists on pages served by this script - so editing is
impossible for anyone but whoever is sitting at this Mac.

How edits map back to source:
  - Text: every page is parsed as it's served. Each text-only element (a
    paragraph, heading, list item... with no images/svg/blocks inside) gets
    a data-src="start:end" attribute holding the character range of its
    inner HTML in the *source file*. Saving replaces exactly that range.
    The page also carries a hash of the file; if the file changed on disk
    since the page loaded, the save is refused rather than written into the
    wrong place.
  - Tokens: the custom properties in each stylesheet's first :root block.
    Saving rewrites just that one `--name: value;` declaration, then bumps
    the stylesheet's ?v= cache-buster in every page.

Every request to /__edit/ must carry a random token that's printed into the
served page, so another website open in the same browser can't POST to this
server behind your back.
"""

import hashlib
import html
import json
import os
import re
import secrets
import subprocess
import sys
import threading
import webbrowser
from datetime import datetime
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST = '127.0.0.1'
PORT = int(os.environ.get('PORT', '8130'))
TOKEN = secrets.token_urlsafe(24)
written = set()  # files saved this session - the only ones Publish commits

TEXT_TAGS = {'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'figcaption', 'dt', 'dd',
             'blockquote', 'td', 'th', 'span', 'a', 'label', 'small'}
INLINE_OK = {'a', 'strong', 'b', 'em', 'i', 'u', 'br', 'span', 'sup', 'sub', 'small', 'code', 'mark', 'abbr', 'kbd'}
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
SKIP_INSIDE = {'script', 'style', 'svg', 'template', 'head', 'button', 'select', 'textarea'}


class TextMapper(HTMLParser):
    """Finds text-only elements and their inner-HTML source ranges."""

    def __init__(self, source):
        super().__init__(convert_charrefs=False)
        self.source = source
        self.line_starts = [0]
        for m in re.finditer('\n', source):
            self.line_starts.append(m.end())
        self.stack = []      # [tag, tag_start, inner_start, ok, has_text, skip_depth_marker]
        self.found = []      # (tag_start, tag_text_len, inner_start, inner_end)
        self.skip = 0

    def src_offset(self):
        line, col = self.getpos()
        return self.line_starts[line - 1] + col

    def handle_starttag(self, tag, attrs):
        start = self.src_offset()
        text = self.get_starttag_text() or ''
        if tag in VOID:
            if tag != 'br':
                for frame in self.stack:
                    frame[3] = False
            return
        if self.skip or tag in SKIP_INSIDE:
            self.skip += 1
            for frame in self.stack:
                frame[3] = False
            self.stack.append([tag, start, start + len(text), False, False, True])
            return
        if tag not in INLINE_OK:
            for frame in self.stack:
                frame[3] = False
        hidden = any(k == 'hidden' for k, _ in attrs)
        self.stack.append([tag, start, start + len(text), tag in TEXT_TAGS and not hidden, False, False])

    def handle_startendtag(self, tag, attrs):
        if tag != 'br':
            for frame in self.stack:
                frame[3] = False

    def handle_endtag(self, tag):
        end = self.src_offset()
        # Pop to the matching open tag (tolerates the odd implicit close).
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                break
        else:
            return
        while len(self.stack) > i:
            frame = self.stack.pop()
            if frame[5]:
                self.skip -= 1
            if frame[0] == tag and frame[3] and frame[4]:
                self.found.append((frame[1], frame[2] - frame[1], frame[2], end))

    def handle_data(self, data):
        if data.strip() and self.stack:
            self.stack[-1][4] = True
            for frame in self.stack:
                frame[4] = True

    def handle_entityref(self, name):
        self.handle_data('&')

    def handle_charref(self, name):
        self.handle_data('&')


def editable_ranges(source):
    mapper = TextMapper(source)
    mapper.feed(source)
    # Keep only the outermost editable element of any nested pair, so a
    # <p> with a link in it is edited as the whole paragraph.
    found = sorted(mapper.found, key=lambda f: (f[0], -f[3]))
    outer = []
    for item in found:
        if outer and item[0] < outer[-1][3]:
            continue
        outer.append(item)
    return outer


class ElementIndex(HTMLParser):
    """Every element's source ranges, for reordering and image edits."""

    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.source = source
        self.line_starts = [0] + [m.end() for m in re.finditer('\n', source)]
        self.nodes = []   # dicts: tag, attrs, start, start_end, inner_end, end, parent
        self.stack = []

    def src_offset(self):
        line, col = self.getpos()
        return self.line_starts[line - 1] + col

    def _open(self, tag, attrs, void):
        start = self.src_offset()
        start_end = start + len(self.get_starttag_text() or '')
        node = {'tag': tag, 'attrs': dict(attrs), 'start': start, 'start_end': start_end,
                'inner_end': start_end if void else None, 'end': start_end if void else None,
                'parent': self.stack[-1] if self.stack else None}
        self.nodes.append(node)
        if not void:
            self.stack.append(len(self.nodes) - 1)

    def handle_starttag(self, tag, attrs):
        self._open(tag, attrs, tag in VOID)

    def handle_startendtag(self, tag, attrs):
        self._open(tag, attrs, True)

    def handle_endtag(self, tag):
        pos = self.src_offset()
        for i in range(len(self.stack) - 1, -1, -1):
            if self.nodes[self.stack[i]]['tag'] == tag:
                break
        else:
            return
        end = self.source.index('>', pos) + 1
        while len(self.stack) > i:
            node = self.nodes[self.stack.pop()]
            node['inner_end'], node['end'] = pos, end


def index_elements(source):
    idx = ElementIndex(source)
    idx.feed(source)
    return idx.nodes


def reorder_containers(nodes):
    """Containers marked data-reorder="group" and their direct children."""
    out = []
    for i, node in enumerate(nodes):
        if 'data-reorder' in node['attrs'] and node['end'] is not None:
            kids = [n for n in nodes if n['parent'] == i]
            out.append({'group': node['attrs']['data-reorder'], 'node': node,
                        'inner': (node['start_end'], node['inner_end']),
                        'blocks': [(k['start'], k['end']) for k in kids]})
    return out


def image_tags(nodes):
    return [(n['start'], n['start_end']) for n in nodes if n['tag'] == 'img']


def set_attr(tag, name, value):
    """Set (or with value None, remove) one attribute on a start tag."""
    pattern = re.compile(r'\s%s\s*=\s*("[^"]*"|\'[^\']*\')' % re.escape(name))
    tag = pattern.sub('', tag)
    if value is None:
        return tag
    close = '/>' if tag.rstrip().endswith('/>') else '>'
    body = tag.rstrip()[:-len(close)].rstrip()
    return '%s %s="%s"%s' % (body, name, html.escape(value, quote=True), close)


def set_max_width(tag, width):
    m = re.search(r'\sstyle\s*=\s*"([^"]*)"', tag)
    decls = [d.strip() for d in (m.group(1) if m else '').split(';') if d.strip()]
    decls = [d for d in decls if not re.match(r'max-width\s*:', d)]
    if width:
        decls.append('max-width: %s' % width)
    return set_attr(tag, 'style', '; '.join(decls) if decls else None)


def apply_edits(source, splices, containers):
    """Apply non-overlapping splices plus container reorders in one pass.

    splices:    (start, end, replacement) - text, width and image edits
    containers: (inner_start, inner_end, lead, sep, trail, [block ranges])
    Edits inside a block that moves travel with it, because blocks are
    rendered recursively from the original source."""
    items = [('s', a, b, r) for a, b, r in splices] + [('c', c[0], c[1], c) for c in containers]

    def render(lo, hi):
        cands = [it for it in items if lo <= it[1] and it[2] <= hi and (it[1], it[2]) != (lo, hi)]
        top = [it for it in cands
               if not any(o is not it and o[1] <= it[1] and it[2] <= o[2] and (o[1], o[2]) != (it[1], it[2]) for o in cands)]
        out, pos = [], lo
        for kind, a, b, payload in sorted(top, key=lambda it: it[1]):
            out.append(source[pos:a])
            if kind == 's':
                out.append(payload)
            else:
                _, _, lead, sep, trail, blocks = payload
                parts = [render(x, y) for x, y in blocks]
                out.append(lead + sep.join(parts) + trail if parts else lead.rstrip(' ') + trail)
            pos = b
        out.append(source[pos:hi])
        return ''.join(out)

    return render(0, len(source))


def file_hash(text):
    return hashlib.sha1(text.encode('utf-8')).hexdigest()[:16]


def safe_path(rel, exts):
    path = os.path.realpath(os.path.join(ROOT, rel))
    if not path.startswith(ROOT + os.sep) or os.path.splitext(path)[1] not in exts or not os.path.isfile(path):
        raise ValueError('Not an editable file: %s' % rel)
    return path


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def write(path, text):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    written.add(os.path.relpath(path, ROOT))


def root_block(css):
    m = re.search(r':root\s*\{', css)
    if not m:
        return None
    end = css.index('}', m.end())
    return m.end(), end


def read_tokens(css):
    block = root_block(css)
    if not block:
        return []
    body = css[block[0]:block[1]]
    tokens, group = [], 'Tokens'
    for m in re.finditer(r'/\*\s*=+\s*(.+?)\s*=+|(--[\w-]+)\s*:\s*([^;]+);', body):
        if m.group(1):
            group = re.sub(r'\s*\(.*', '', m.group(1)).strip()
        else:
            tokens.append({'name': m.group(2), 'value': m.group(3).strip(), 'group': group})
    return tokens


def bump_version(css_file):
    version = datetime.now().strftime('%Y%m%d-%H%M')
    name = re.escape(os.path.basename(css_file))
    for entry in os.listdir(ROOT):
        if entry.endswith('.html'):
            path = os.path.join(ROOT, entry)
            text = read(path)
            new = re.sub(r'(%s\?v=)[^"\']*' % name, r'\g<1>' + version, text)
            if new != text:
                write(path, new)


def git(*args):
    proc = subprocess.run(['git'] + list(args), cwd=ROOT, capture_output=True, text=True)
    return proc.returncode, (proc.stdout + proc.stderr).strip()



# ---- Case studies: add / archive / restore ----
# A case study is wired into three files: its card on index.html (inside a
# data-reorder="cards" column), its line in site-nav.js's PAGES list, and -
# once archived - a line in showcase.html's SHOWCASE_ITEMS. Archived cards
# are kept verbatim inside <template id="archived-cards"> on index.html so a
# restore puts back exactly what was there.

ARROW_SVG = ('<svg viewBox="0 0 24 24"><path d="M7 17L17 7M17 7H9M17 7V15" stroke="currentColor" '
             'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>')
CARD_STYLES = {'teal': 'Single phone', 'purple': 'Two phones', 'sky': 'Laptop, full width', 'ai': 'Panel, centred'}
NAV_LINE = re.compile(r"^\s*\{ href: '([^']+)', label: (?:'([^']*)'|\"([^\"]*)\"), group: 'work' \},\n", re.M)


def slug_of(href):
    return re.sub(r'^\./', '', href or '').replace('.html', '')


def case_cards(index_src):
    """Homepage cards that link to a case study page."""
    nodes = index_elements(index_src)
    out = []
    for cont in reorder_containers(nodes):
        for i, (a, b) in enumerate(cont['blocks']):
            node = next(n for n in nodes if n['start'] == a)
            href = node['attrs'].get('href', '')
            if node['tag'] == 'a' and node['attrs'].get('data-category') == 'projects' and href.endswith('.html'):
                out.append({'slug': slug_of(href), 'range': (a, b), 'cont': cont, 'pos': i})
    return out


def card_facts(card_html):
    def grab(pattern):
        m = re.search(pattern, card_html, re.S)
        return html.unescape(re.sub(r'<[^>]+>', '', m.group(1))).strip() if m else ''
    img = re.search(r'<img[^>]*\ssrc="([^"]+)"', card_html)
    return {
        'title': grab(r'class="card-title"[^>]*>(.*?)</h2>'),
        'label': grab(r'class="card-label"[^>]*>(.*?)</p>'),
        'button': grab(r'class="card-btn"[^>]*>(.*?)<svg'),
        'outcome': html.unescape(re.search(r'data-outcome="([^"]*)"', card_html).group(1)) if 'data-outcome="' in card_html else '',
        'image': img.group(1) if img else '',
    }


def remove_block(src, cont, pos):
    blocks = cont['blocks']
    a, b = blocks[pos]
    if pos > 0:
        return src[:blocks[pos - 1][1]] + src[b:]
    if len(blocks) > 1:
        return src[:a] + src[blocks[1][0]:]
    return src[:a] + src[b:]


def insert_first(src, cont, block_html):
    blocks = cont['blocks']
    if not blocks:
        a, _ = cont['inner']
        return src[:a] + '\n\n        ' + block_html + src[a:]
    sep = src[blocks[0][1]:blocks[1][0]] if len(blocks) > 1 else '\n\n        '
    a = blocks[0][0]
    return src[:a] + block_html + sep + src[a:]


ARCHIVE_OPEN = '<template id="archived-cards">'


def archived_cards(index_src):
    i = index_src.find(ARCHIVE_OPEN)
    if i == -1:
        return []
    inner_start = i + len(ARCHIVE_OPEN)
    inner_end = index_src.index('</template>', inner_start)
    out = []
    for m in re.finditer(r'<a class="card[^"]*" href="([^"]+)".*?</a>', index_src[inner_start:inner_end], re.S):
        out.append({'slug': slug_of(m.group(1)), 'start': inner_start + m.start(), 'end': inner_start + m.end(),
                    'html': m.group(0)})
    return out


def nav_add(js, slug, label):
    lines = list(NAV_LINE.finditer(js))
    quoted = "'%s'" % label if "'" not in label and '\\' not in label else json.dumps(label)
    entry = "    { href: '%s.html', label: %s, group: 'work' },\n" % (slug, quoted)
    if any(m.group(1) == slug + '.html' for m in lines):
        return js
    at = lines[-1].end() if lines else js.index("  const PAGES = [\n") + len("  const PAGES = [\n")
    return js[:at] + entry + js[at:]


def nav_remove(js, slug):
    for m in NAV_LINE.finditer(js):
        if m.group(1) == slug + '.html':
            return js[:m.start()] + js[m.end():]
    return js


def showcase_add(src, item):
    marker = 'const SHOWCASE_ITEMS = [\n'
    at = src.index(marker) + len(marker)
    return src[:at] + '    ' + json.dumps(item, ensure_ascii=False) + ',\n' + src[at:]


def showcase_remove(src, slug):
    return re.sub(r'^ *\{[^\n]*"href": "%s\.html"[^\n]*\},?\n' % re.escape(slug), '', src, count=1, flags=re.M)


def list_cases():
    index_src = read(os.path.join(ROOT, 'index.html'))
    nav = read(os.path.join(ROOT, 'site-nav.js'))
    labels = {m.group(1): m.group(2) or m.group(3) for m in NAV_LINE.finditer(nav)}
    active = []
    for c in case_cards(index_src):
        facts = card_facts(index_src[c['range'][0]:c['range'][1]])
        active.append({'slug': c['slug'], 'title': facts['title'], 'label': labels.get(c['slug'] + '.html', facts['button'])})
    archived = [{'slug': a['slug'], 'title': card_facts(a['html'])['title']} for a in archived_cards(index_src)]
    return {'active': active, 'archived': archived, 'styles': CARD_STYLES}


def archive_case(slug):
    index_path = os.path.join(ROOT, 'index.html')
    index_src = read(index_path)
    card = next((c for c in case_cards(index_src) if c['slug'] == slug), None)
    if not card:
        raise ValueError('No homepage card links to %s.html.' % slug)
    a, b = card['range']
    block = index_src[a:b]
    facts = card_facts(block)
    nav_src = read(os.path.join(ROOT, 'site-nav.js'))
    nav_label = next((m.group(2) or m.group(3) for m in NAV_LINE.finditer(nav_src) if m.group(1) == slug + '.html'), facts['button'])
    stored = set_attr(block[:block.index('>') + 1], 'data-nav-label', nav_label) + block[block.index('>') + 1:]
    index_src = remove_block(index_src, card['cont'], card['pos'])
    if ARCHIVE_OPEN not in index_src:
        index_src = index_src.replace('</main>', '<!-- Archived case study cards, kept verbatim so the browser editor can\n'
                                      '     restore them. Never rendered. -->\n' + ARCHIVE_OPEN + '\n</template>\n\n</main>', 1)
    close = index_src.index('</template>', index_src.index(ARCHIVE_OPEN))
    index_src = index_src[:close] + stored + '\n' + index_src[close:]
    write(index_path, index_src)

    nav_path = os.path.join(ROOT, 'site-nav.js')
    write(nav_path, nav_remove(read(nav_path), slug))

    showcase_path = os.path.join(ROOT, 'showcase.html')
    showcase = showcase_remove(read(showcase_path), slug)
    item = {'image': facts['image'] or 'assets/gina-avatar.jpg', 'tag': 'CASE STUDY', 'title': facts['title'] or slug,
            'desc': facts['outcome'] or facts['label'], 'href': slug + '.html'}
    write(showcase_path, showcase_add(showcase, item))
    return {'archived': slug}


def restore_case(slug):
    index_path = os.path.join(ROOT, 'index.html')
    index_src = read(index_path)
    entry = next((a for a in archived_cards(index_src) if a['slug'] == slug), None)
    if not entry:
        raise ValueError('%s is not in the archive.' % slug)
    index_src = index_src[:entry['start']] + index_src[entry['end']:]
    index_src = re.sub(r'(%s)\n+' % re.escape(ARCHIVE_OPEN), r'\1\n', index_src, count=1)
    card = entry['html']
    tag_end = card.index('>') + 1
    label = re.search(r'\sdata-nav-label="([^"]*)"', card[:tag_end])
    card = set_attr(card[:tag_end], 'data-nav-label', None) + card[tag_end:]
    first = reorder_containers(index_elements(index_src))[0]
    index_src = insert_first(index_src, first, card)
    write(index_path, index_src)

    nav_path = os.path.join(ROOT, 'site-nav.js')
    facts = card_facts(card)
    nav_label = html.unescape(label.group(1)) if label else (facts['button'] or facts['title'])
    write(nav_path, nav_add(read(nav_path), slug, nav_label))
    showcase_path = os.path.join(ROOT, 'showcase.html')
    write(showcase_path, showcase_remove(read(showcase_path), slug))
    return {'restored': slug}


def new_case(data):
    title = (data.get('title') or '').strip()
    short = (data.get('short') or '').strip() or title
    slug = re.sub(r'[^a-z0-9]+', '', (data.get('slug') or short).lower())
    style = data.get('style') if data.get('style') in CARD_STYLES else 'sky'
    image = (data.get('image') or '').strip()
    if not title or not slug:
        raise ValueError('A case study needs a title.')
    if not image or not os.path.isfile(os.path.join(ROOT, image)):
        raise ValueError('Choose a card image first.')
    page = slug + '.html'
    if os.path.exists(os.path.join(ROOT, page)):
        raise ValueError('%s already exists - pick a different short name.' % page)

    template = read(os.path.join(ROOT, 'case-study-template.html'))
    template = template.replace('[Project Title]', html.escape(title), 2)
    # Placeholder images point at this project's own folder, so replacing
    # them in the editor files the new image under assets/<slug>/.
    template = re.sub(r'src="\[assets/PROJECT/([^\]"]+)\]"', r'src="assets/%s/\1"' % slug, template)
    write(os.path.join(ROOT, page), template)

    e = lambda v: html.escape(v, quote=True)
    card = ('<a class="card card-%s" href="./%s" data-category="projects" data-outcome="%s">\n'
            '          <div class="card-glass"></div>\n'
            '          <div class="card-top">\n'
            '            <p class="card-label">%s</p>\n'
            '            <h2 class="card-title">%s</h2>\n'
            '          </div>\n'
            '          <img class="card-bg-img" src="%s" alt="%s">\n'
            '          <span class="card-btn">%s %s</span>\n'
            '        </a>') % (style, page, e(data.get('outcome', '').strip()), e(data.get('label', '').strip()),
                              e(title), e(image), e(data.get('alt', '').strip()), e(short), ARROW_SVG)
    index_path = os.path.join(ROOT, 'index.html')
    index_src = read(index_path)
    first = reorder_containers(index_elements(index_src))[0]
    write(index_path, insert_first(index_src, first, card))

    nav_path = os.path.join(ROOT, 'site-nav.js')
    write(nav_path, nav_add(read(nav_path), slug, short))
    return {'page': page}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        # Quiet except for editor API calls - page/asset requests are noise.
        if args and '/__edit/' in str(args[0]):
            sys.stderr.write('  %s\n' % (fmt % args))

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def local_host(self):
        # Refuse anything not addressed to this machine by name, so a web
        # page can't reach the server via a domain pointed at 127.0.0.1.
        host = (self.headers.get('Host') or '').rsplit(':', 1)[0]
        if host in ('127.0.0.1', 'localhost'):
            return True
        self.send_error(403)
        return False

    # ---- Pages: serve with editor injected ----
    def do_GET(self):
        if not self.local_host():
            return
        path = self.path.split('?')[0].split('#')[0]
        if path.startswith('/__edit/'):
            return self.api_get(path)
        if path.endswith('/'):
            path += 'index.html'
        if path.endswith('.html'):
            try:
                full = safe_path(path.lstrip('/'), {'.html'})
            except ValueError:
                return super().do_GET()
            return self.serve_page(full)
        return super().do_GET()

    def serve_page(self, full):
        source = read(full)
        rel = os.path.relpath(full, ROOT)
        inserts = {}

        def add(tag_start, tag_end, attr):
            at = tag_end - 1  # just before the start tag's ">"
            if source[at - 1] == '/':
                at -= 1
            inserts.setdefault(at, []).append(attr)

        for tag_start, tag_len, inner_start, inner_end in editable_ranges(source):
            add(tag_start, tag_start + tag_len,
                ' data-src="%d:%d" data-tag="%d:%d"' % (inner_start, inner_end, tag_start, tag_start + tag_len))
        nodes = index_elements(source)
        for start, end in image_tags(nodes):
            add(start, end, ' data-img="%d:%d"' % (start, end))
        for cont in reorder_containers(nodes):
            node = cont['node']
            add(node['start'], node['start_end'], ' data-reorder-src="%d:%d"' % cont['inner'])
            for b_start, b_end in cont['blocks']:
                child = next(n for n in nodes if n['start'] == b_start)
                add(child['start'], child['start_end'], ' data-block="%d:%d"' % (b_start, b_end))

        out, last = [], 0
        for at in sorted(inserts):
            out.append(source[last:at])
            out.append(''.join(inserts[at]))
            last = at
        out.append(source[last:])
        page = ''.join(out)
        boot = ('<script>window.__EDIT__ = %s;</script>\n<script src="/tools/editor.js"></script>\n'
                % json.dumps({'token': TOKEN, 'file': rel, 'hash': file_hash(source)}))
        i = page.rfind('</body>')
        page = page[:i] + boot + page[i:] if i != -1 else page + boot
        body = page.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ---- API ----
    def authorised(self):
        if self.headers.get('X-Edit-Token') != TOKEN:
            self.reply(403, {'error': 'Missing or wrong edit token - reload the page.'})
            return False
        return True

    def reply(self, status, data):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def api_get(self, path):
        if not self.authorised():
            return
        query = dict(p.split('=', 1) for p in (self.path.split('?', 1) + [''])[1].split('&') if '=' in p)
        try:
            if path == '/__edit/tokens':
                full = safe_path(query.get('file', ''), {'.css'})
                return self.reply(200, {'tokens': read_tokens(read(full))})
            if path == '/__edit/cases':
                return self.reply(200, list_cases())
            if path == '/__edit/status':
                _, branch = git('rev-parse', '--abbrev-ref', 'HEAD')
                _, status = git('status', '--porcelain', '--', *sorted(written)) if written else (0, '')
                return self.reply(200, {'branch': branch, 'files': sorted(written), 'status': status})
        except ValueError as e:
            return self.reply(400, {'error': str(e)})
        self.reply(404, {'error': 'Unknown endpoint'})

    def do_POST(self):
        if not self.local_host():
            return
        path = self.path.split('?')[0]
        if not path.startswith('/__edit/') or not self.authorised():
            if not path.startswith('/__edit/'):
                self.reply(404, {'error': 'Unknown endpoint'})
            return
        try:
            length = int(self.headers.get('Content-Length', 0))
            if path == '/__edit/upload':
                return self.reply(200, self.upload(self.rfile.read(length)))
            data = json.loads(self.rfile.read(length) or b'{}')
            if path == '/__edit/save':
                return self.reply(200, self.save(data))
            if path == '/__edit/publish':
                return self.reply(200, self.publish(data))
            if path == '/__edit/case/new':
                return self.reply(200, new_case(data))
            if path == '/__edit/case/archive':
                return self.reply(200, archive_case(re.sub(r'[^a-z0-9-]', '', data.get('slug', ''))))
            if path == '/__edit/case/restore':
                return self.reply(200, restore_case(re.sub(r'[^a-z0-9-]', '', data.get('slug', ''))))
        except ValueError as e:
            return self.reply(409, {'error': str(e)})
        self.reply(404, {'error': 'Unknown endpoint'})

    def save(self, data):
        saved = []
        text_edits = data.get('text') or []
        width_edits = data.get('widths') or []
        image_edits = data.get('images') or []
        reorder = data.get('reorder') or []
        if text_edits or width_edits or image_edits or reorder:
            full = safe_path(data['file'], {'.html'})
            source = read(full)
            if file_hash(source) != data.get('hash'):
                raise ValueError('%s changed on disk since this page loaded. Reload, then redo the edit.' % data['file'])
            stale = 'The page no longer lines up with the file. Reload and try again.'
            ranges = editable_ranges(source)
            inner_ok = {(a, b) for _, _, a, b in ranges}
            tag_ok = {(t, t + n) for t, n, _, _ in ranges}
            nodes = index_elements(source)
            img_ok = set(image_tags(nodes))
            splices = []

            for edit in text_edits:
                a, b = int(edit['start']), int(edit['end'])
                if (a, b) not in inner_ok:
                    raise ValueError(stale)
                splices.append((a, b, edit['html']))

            tag_changes = {}
            for edit in width_edits:
                a, b = int(edit['start']), int(edit['end'])
                width = edit.get('maxWidth')
                if (a, b) not in tag_ok or (width and not re.fullmatch(r'\d+(\.\d+)?px', width)):
                    raise ValueError(stale)
                tag_changes[(a, b)] = set_max_width(tag_changes.get((a, b), source[a:b]), width)
            for edit in image_edits:
                a, b = int(edit['start']), int(edit['end'])
                if (a, b) not in img_ok:
                    raise ValueError(stale)
                tag = tag_changes.get((a, b), source[a:b])
                if edit.get('src'):
                    tag = set_attr(tag, 'src', edit['src'])
                if edit.get('alt') is not None:
                    tag = set_attr(tag, 'alt', edit['alt'])
                tag_changes[(a, b)] = tag
            splices += [(a, b, tag) for (a, b), tag in tag_changes.items()]

            containers = []
            if reorder:
                known = {'%d:%d' % c['inner']: c for c in reorder_containers(nodes)}
                sent = {r['container']: [tuple(map(int, blk.split(':'))) for blk in r['blocks']] for r in reorder}
                groups = {}
                for key, c in known.items():
                    groups.setdefault(c['group'], []).append(key)
                for key in sent:
                    if key not in known:
                        raise ValueError(stale)
                    group = groups[known[key]['group']]
                    if not all(k in sent for k in group):
                        raise ValueError(stale)
                    before = sorted(b for k in group for b in known[k]['blocks'])
                    after = sorted(b for k in group for b in sent[k])
                    if before != after:
                        raise ValueError(stale)
                for key, blocks in sent.items():
                    c = known[key]
                    a, b = c['inner']
                    orig = c['blocks']
                    lead = source[a:orig[0][0]] if orig else source[a:b]
                    trail = source[orig[-1][1]:b] if orig else ''
                    sep = source[orig[0][1]:orig[1][0]] if len(orig) > 1 else lead
                    containers.append((a, b, lead, sep, trail, blocks))

            spans = sorted((a, b) for a, b, _ in splices)
            if any(spans[i][1] > spans[i + 1][0] for i in range(len(spans) - 1)):
                raise ValueError(stale)
            write(full, apply_edits(source, splices, containers))
            saved.append(data['file'])

        for css_file, values in (data.get('tokens') or {}).items():
            full = safe_path(css_file, {'.css'})
            css = read(full)
            block = root_block(css)
            if not block:
                continue
            body = css[block[0]:block[1]]
            for name, value in values.items():
                if not re.fullmatch(r'--[\w-]+', name) or re.search(r'[;{}]', value) or '/*' in value:
                    raise ValueError('Refusing an odd-looking value for %s' % name)
                body, n = re.subn(r'(%s\s*:\s*)[^;]+;' % re.escape(name), lambda m: m.group(1) + value + ';', body, count=1)
                if not n:
                    raise ValueError('%s not found in %s' % (name, css_file))
            write(full, css[:block[0]] + body + css[block[1]:])
            bump_version(css_file)
            saved.append(css_file)
        return {'saved': saved}

    def upload(self, body):
        # New image, saved next to the one it replaces (assets/<project>/).
        query = dict(p.split('=', 1) for p in (self.path.split('?', 1) + [''])[1].split('&') if '=' in p)
        from urllib.parse import unquote
        folder = os.path.realpath(os.path.join(ROOT, unquote(query.get('dir', 'assets'))))
        assets = os.path.join(ROOT, 'assets')
        if not (folder == assets or folder.startswith(assets + os.sep)):
            folder = assets
        if not os.path.isdir(folder):
            # A new case study's own folder (assets/<slug>) may not exist yet.
            if os.path.dirname(folder) == assets and re.fullmatch(r'[a-z0-9-]+', os.path.basename(folder)):
                os.makedirs(folder)
            else:
                folder = assets
        name, ext = os.path.splitext(unquote(query.get('name', 'image')))
        ext = ext.lower()
        if ext not in {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'}:
            raise ValueError('Images only: PNG, JPG, WebP, GIF or AVIF.')
        if len(body) > 20 * 1024 * 1024:
            raise ValueError('That image is over 20MB. Export a smaller version first.')
        name = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-') or 'image'
        candidate, n = name + ext, 2
        while os.path.exists(os.path.join(folder, candidate)):
            candidate, n = '%s-%d%s' % (name, n, ext), n + 1
        target = os.path.join(folder, candidate)
        with open(target, 'wb') as f:
            f.write(body)
        rel = os.path.relpath(target, ROOT)
        written.add(rel)
        return {'path': rel.replace(os.sep, '/')}

    def publish(self, data):
        if not written:
            raise ValueError('Nothing saved from the editor yet.')
        message = (data.get('message') or '').strip() or 'Edit copy and spacing in the site editor'
        files = sorted(written)
        code, out = git('add', '--', *files)
        if code:
            raise ValueError(out)
        code, out = git('commit', '-m', message, '--', *files)
        if code and 'nothing to commit' not in out:
            raise ValueError(out)
        _, branch = git('rev-parse', '--abbrev-ref', 'HEAD')
        code, push = git('push', '-u', 'origin', branch)
        if code:
            raise ValueError('Committed locally, but the push failed:\n' + push)
        written.clear()
        return {'branch': branch, 'live': branch == 'main', 'log': out + '\n' + push}


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    url = 'http://%s:%d/index.html' % (HOST, PORT)
    print('\n  Site editor running at %s' % url)
    print('  Only this Mac can reach it. Close this window (or Ctrl+C) to stop.\n')
    if '--no-browser' not in sys.argv:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
