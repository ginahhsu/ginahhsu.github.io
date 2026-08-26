// Builds a sticky, scroll-spy table of contents for case study pages, generated
// from each page's own <h2> section headings (Background, The challenge, etc.) -
// nothing to hand-maintain per page, it just reads whatever headings exist.
//
// Runs automatically on load. Pages that inject their content dynamically after
// load (seatselection.html's password gate) should call
// window.buildCaseStudyTOC() again once the real content is in the DOM.
function buildCaseStudyTOC() {
  const existing = document.querySelector('.cs-toc');
  if (existing) existing.remove();

  const headings = [...document.querySelectorAll('.cs-main .cs-section > h2')];
  if (headings.length < 2) return;

  const slugify = (text) => text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const used = new Set();
  const links = [];

  const nav = document.createElement('nav');
  nav.className = 'cs-toc';
  nav.setAttribute('aria-label', 'Case study sections');

  const label = document.createElement('p');
  label.className = 'cs-toc-label';
  label.textContent = 'Contents';
  nav.appendChild(label);

  const list = document.createElement('ul');

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
    links.push({ heading, link: a });
  });

  nav.appendChild(list);
  document.body.appendChild(nav);

  const setActive = (activeLink) => {
    links.forEach(({ link }) => link.classList.remove('is-active'));
    if (activeLink) activeLink.classList.add('is-active');
  };
  setActive(links[0].link);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const match = links.find(({ heading }) => heading === entry.target);
      if (match) setActive(match.link);
    });
  }, { rootMargin: '-10% 0px -70% 0px', threshold: 0 });

  links.forEach(({ heading }) => observer.observe(heading));
}

window.buildCaseStudyTOC = buildCaseStudyTOC;
document.addEventListener('DOMContentLoaded', buildCaseStudyTOC);
