// Site-wide "← Prev · Page ▾ · Next →" pill. One page list drives every
// page's prev/next links and the dropdown, so reordering the site (or adding
// a case study) means editing PAGES below and nothing else.
//
// Placement is pure CSS (site-nav.css), keyed off data-context: centred in
// the top bar on case studies and the Showcase, and floating at the bottom
// of the screen on phones - where a thumb can actually reach it.
//
// On the homepage there's no separate pill: the filter tabs already are a
// dark pill at top-centre, so the menu button is added to the end of them
// and the tabs become the nav (data-context="tabs").
(() => {
  // Case study entries (group: 'work') are added and removed by the browser
  // editor's Case studies panel - keep each on one line in this shape.
  const PAGES = [
    { href: 'aboutme.html', label: 'About', key: 'A' },
    { href: 'index.html', label: 'Home', key: 'H' },
    { href: 'ultrabasic.html', label: 'UltraBasic', group: 'work' },
    { href: 'seatselection.html', label: 'Seat Selection', group: 'work' },
    { href: 'designingwithai.html', label: 'Designing with AI', group: 'work' },
    { href: 'spacecentre.html', label: 'Space Centre', group: 'work' },
    { href: 'turntool.html', label: 'Turn Tool', group: 'work' },
    { href: 'sidequests.html', label: 'Side Quests', group: 'fun' },
    { href: 'showcase.html', label: 'Showcase', group: 'fun' },
  ];

  const file = location.pathname.split('/').pop() || 'index.html';
  const index = PAGES.findIndex((page) => page.href === file);
  if (index === -1) return; // e.g. case-study-template.html

  const current = PAGES[index];
  const prev = PAGES[(index - 1 + PAGES.length) % PAGES.length];
  const next = PAGES[(index + 1) % PAGES.length];

  const tabs = document.querySelector('.tabs');
  const context = tabs ? 'tabs'
    : document.querySelector('.showcase-topbar') ? 'showcase'
    : 'case';

  const arrow = (dir) => `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${dir === 'left' ? 'M13 8H3m4-4L3 8l4 4' : 'M3 8h10M9 4l4 4-4 4'}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const nav = tabs || document.createElement('nav');
  nav.classList.add('site-nav');
  nav.dataset.context = context;
  if (!tabs) nav.setAttribute('aria-label', 'Site');

  let workNumber = 0;
  const itemHtml = (page) => {
    const hint = page.group === 'work' ? String(++workNumber).padStart(2, '0') : (page.key || '');
    const isCurrent = page === current;
    return `<li><a href="${page.href}"${isCurrent ? ' aria-current="page"' : ''}>${page.label}<span class="site-nav-hint">${hint}</span></a></li>`;
  };
  const groupHtml = (pages) => `<ul>${pages.map(itemHtml).join('')}</ul>`;

  const chevron = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const menuIcon = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M3 8h10M3 11.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

  const currentHtml = `
    <div class="site-nav-current">
      <button type="button" class="site-nav-toggle" aria-haspopup="true" aria-expanded="false"${tabs ? ' aria-label="All pages" title="All pages  /"' : ''}>
        ${tabs ? menuIcon : `<span>${current.label}</span>${chevron}`}
      </button>
      <div class="site-nav-menu" hidden>
        ${groupHtml(PAGES.filter((p) => !p.group))}
        ${groupHtml(PAGES.filter((p) => p.group === 'work'))}
        ${groupHtml(PAGES.filter((p) => p.group === 'fun'))}
        <dl class="site-nav-keys">
          <div><dt><kbd>&larr;</kbd><kbd>&rarr;</kbd></dt><dd>Previous / next page</dd></div>
          <div><dt><kbd>1</kbd>&ndash;<kbd>${Math.min(9, PAGES.filter((p) => p.group === 'work').length)}</kbd></dt><dd>Jump to a case study</dd></div>
          ${tabs ? '<div><dt><kbd>T</kbd></dt><dd>Show the thinking</dd></div>' : ''}
          <div><dt><kbd>/</kbd></dt><dd>Open this menu</dd></div>
        </dl>
      </div>
    </div>
  `;

  if (tabs) {
    nav.insertAdjacentHTML('beforeend', `<span class="site-nav-divider" aria-hidden="true"></span>${currentHtml}`);
  } else {
    nav.innerHTML = `
    <a class="site-nav-step" href="${prev.href}" rel="prev" aria-label="Previous: ${prev.label}">${arrow('left')}<span class="site-nav-step-label">${prev.label}</span><span class="site-nav-step-short">Prev</span></a>
    ${currentHtml}
    <a class="site-nav-step" href="${next.href}" rel="next" aria-label="Next: ${next.label}"><span class="site-nav-step-label">${next.label}</span><span class="site-nav-step-short">Next</span>${arrow('right')}</a>
    `;
    document.body.appendChild(nav);
  }

  const toggle = nav.querySelector('.site-nav-toggle');
  const menu = nav.querySelector('.site-nav-menu');

  const setOpen = (open) => {
    menu.hidden = !open;
    nav.classList.toggle('is-menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (open) menu.querySelector('[aria-current]')?.focus();
  };

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(menu.hidden);
  });
  document.addEventListener('click', (event) => {
    if (!nav.contains(event.target)) setOpen(false);
  });

  const isTyping = (target) => target.closest?.('input, textarea, select, [contenteditable]');

  document.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;

    if (event.key === 'Escape' && !menu.hidden) {
      setOpen(false);
      toggle.focus();
      return;
    }
    if (event.key === '/') {
      event.preventDefault();
      setOpen(menu.hidden);
      return;
    }

    // Lightboxes, the Showcase panel and the Contents dropdown already use
    // the arrow keys (or Escape) while they're open - leave them alone then.
    if (document.querySelector('.is-open')) return;

    const go = (page) => { if (page) location.href = page.href; };
    if (event.key === 'ArrowLeft') go(prev);
    else if (event.key === 'ArrowRight') go(next);
    else if (event.key === 'h' || event.key === 'H') go(PAGES.find((p) => p.key === 'H'));
    else if (event.key === 'a' || event.key === 'A') go(PAGES.find((p) => p.key === 'A'));
    else if (/^[1-9]$/.test(event.key)) go(PAGES.filter((p) => p.group === 'work')[Number(event.key) - 1]);
  });
})();
