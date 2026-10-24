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
        out, last = [], 0
        for tag_start, tag_len, inner_start, inner_end in editable_ranges(source):
            insert_at = tag_start + tag_len - 1  # just before the start tag's ">"
            if source[insert_at - 1] == '/':
                continue
            out.append(source[last:insert_at])
            out.append(' data-src="%d:%d"' % (inner_start, inner_end))
            last = insert_at
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
            data = json.loads(self.rfile.read(length) or b'{}')
            if path == '/__edit/save':
                return self.reply(200, self.save(data))
            if path == '/__edit/publish':
                return self.reply(200, self.publish(data))
        except ValueError as e:
            return self.reply(409, {'error': str(e)})
        self.reply(404, {'error': 'Unknown endpoint'})

    def save(self, data):
        saved = []
        text_edits = data.get('text') or []
        if text_edits:
            full = safe_path(data['file'], {'.html'})
            source = read(full)
            if file_hash(source) != data.get('hash'):
                raise ValueError('%s changed on disk since this page loaded. Reload, then redo the edit.' % data['file'])
            valid = {(s, e) for _, _, s, e in editable_ranges(source)}
            for edit in sorted(text_edits, key=lambda x: -x['start']):
                start, end = int(edit['start']), int(edit['end'])
                if (start, end) not in valid:
                    raise ValueError('That text block no longer lines up with the file. Reload and try again.')
                source = source[:start] + edit['html'] + source[end:]
            write(full, source)
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
