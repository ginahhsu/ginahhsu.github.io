// Builds a scroll-spy table of contents for case study pages, generated from
// each page's own <h2> section headings (Background, The challenge, etc.) -
// nothing to hand-maintain per page, it just reads whatever headings exist.
//
// Two renderings share the same headings/slugs: a fixed sidebar (.cs-toc,
// desktop only, see case-study.css) and a dropdown menu injected into the
// sticky .cs-topbar (.cs-topbar-toc, tablet/mobile only - the sidebar has no
// room to sit next to the content column below 1300px).
//
// Runs automatically on load. Pages that inject their content dynamically after
// load (seatselection.html's password gate) should call
// window.buildCaseStudyTOC() again once the real content is in the DOM.
function buildCaseStudyTOC() {
  const existing = document.querySelector('.cs-toc');
  if (existing) existing.remove();
  const existingTopbarToc = document.querySelector('.cs-topbar-toc');
  if (existingTopbarToc) existingTopbarToc.remove();

  const headings = [...document.querySelectorAll('.cs-main .cs-section > h2')];
  if (headings.length < 2) return;

  const slugify = (text) => text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const used = new Set();
  const entries = [];

  const nav = document.createElement('nav');
  nav.className = 'cs-toc';
  nav.setAttribute('aria-label', 'Case study sections');

  const label = document.createElement('p');
  label.className = 'cs-toc-label';
  label.textContent = 'Contents';
  nav.appendChild(label);

  const list = document.createElement('ul');
  nav.appendChild(list);

  const topbarToc = document.createElement('div');
  topbarToc.className = 'cs-topbar-toc';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'cs-topbar-toc-toggle';
  toggle.setAttribute('aria-haspopup', 'true');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = 'Contents <span class="cs-topbar-toc-chevron" aria-hidden="true">&#9662;</span>';

  const panel = document.createElement('ul');
  panel.className = 'cs-topbar-toc-panel';
  panel.setAttribute('aria-label', 'Case study sections');

  topbarToc.appendChild(toggle);
  topbarToc.appendChild(panel);

  const closeTopbarToc = () => {
    topbarToc.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  };

  headings.forEach((heading) => {
    const base = slugify(heading.textContent) || 'section';
    let slug = base;
    let i = 2;
    while (used.has(slug)) slug = `${base}-${i++}`;
    used.add(slug);
    heading.id = slug;

    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${slug}`;
    a.textContent = heading.textContent;
    li.appendChild(a);
    list.appendChild(li);

    const liPanel = document.createElement('li');
    const aPanel = document.createElement('a');
    aPanel.href = `#${slug}`;
    aPanel.textContent = heading.textContent;
    aPanel.addEventListener('click', closeTopbarToc);
    liPanel.appendChild(aPanel);
    panel.appendChild(liPanel);

    entries.push({ heading, links: [a, aPanel] });
  });

  document.body.appendChild(nav);

  const topbar = document.querySelector('.cs-topbar');
  if (topbar) topbar.appendChild(topbarToc);

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = topbarToc.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
  document.addEventListener('click', (event) => {
    if (!topbarToc.contains(event.target)) closeTopbarToc();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeTopbarToc();
  });

  const setActive = (activeHeading) => {
    entries.forEach(({ heading, links }) => {
      const isActive = heading === activeHeading;
      links.forEach((link) => link.classList.toggle('is-active', isActive));
    });
  };
  setActive(entries[0].heading);

  const observer = new IntersectionObserver((intersections) => {
    intersections.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const match = entries.find(({ heading }) => heading === entry.target);
      if (match) setActive(match.heading);
    });
  }, { rootMargin: '-10% 0px -70% 0px', threshold: 0 });

  entries.forEach(({ heading }) => observer.observe(heading));
}

window.buildCaseStudyTOC = buildCaseStudyTOC;
document.addEventListener('DOMContentLoaded', buildCaseStudyTOC);
