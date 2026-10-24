// "Show the thinking" - press T (or flip the switch) to overlay the
// reasoning behind the page: numbered pins that open a short note on a
// product decision (who it serves, what it's for, who it includes), plus a
// live accessibility check on the text it's pointed at.
//
// Everything is authored in the HTML, nothing per page lives here:
//   data-note="..."    a numbered pin on that element's top-right corner
//   data-measure       a dashed outline labelled with that text's WCAG
//                      contrast against what's actually behind it
//
// Homepage only: index.html is the one page that loads this script and
// carries these attributes. The switch sits in the sticky panel, and the
// on/off state is remembered between visits.
(() => {
  const notes = [...document.querySelectorAll('[data-note]')];
  if (!notes.length) return;

  const measures = [...document.querySelectorAll('[data-measure]')];
  const STORAGE_KEY = 'gh-show-thinking';

  // ---- Switch ----
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'thinking-toggle';
  toggle.setAttribute('aria-pressed', 'false');
  toggle.innerHTML = '<span class="thinking-switch" aria-hidden="true"></span><span class="thinking-toggle-label">Show the thinking</span><kbd aria-hidden="true">T</kbd>';

  const mount = document.querySelector('.panel-inner');
  if (mount) mount.appendChild(toggle);
  else document.body.appendChild(toggle);

  // ---- Overlay ----
  // A fixed layer, re-measured from getBoundingClientRect on scroll/resize,
  // so pins stay glued to sticky elements (the panel, the filter pill) as
  // well as to content that scrolls.
  const layer = document.createElement('div');
  layer.className = 'thinking-layer';
  layer.hidden = true;
  document.body.appendChild(layer);

  const redlines = measures.map(() => {
    const el = document.createElement('div');
    el.className = 'thinking-redline';
    el.innerHTML = '<span></span>';
    return layer.appendChild(el);
  });

  const popover = document.createElement('div');
  popover.className = 'thinking-popover';
  popover.setAttribute('role', 'dialog');
  popover.hidden = true;

  const pins = notes.map((target, i) => {
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'thinking-pin';
    pin.setAttribute('aria-label', `Design note ${i + 1} of ${notes.length}`);
    pin.innerHTML = `<img src="assets/gina-avatar.jpg" alt=""><span>${i + 1}</span>`;
    pin.addEventListener('click', (event) => {
      event.stopPropagation();
      openNote(popover.dataset.index === String(i) && !popover.hidden ? -1 : i);
    });
    return layer.appendChild(pin);
  });
  // Outside the layer on purpose: the layer sits under the nav pill (z 25
  // vs 30) so pins never cover the open page menu, but a note you've just
  // opened has to read over everything, the pill included.
  document.body.appendChild(popover);

  let openIndex = -1;
  function openNote(i) {
    openIndex = i;
    pins.forEach((pin, j) => pin.classList.toggle('is-active', j === i));
    if (i < 0) {
      popover.hidden = true;
      delete popover.dataset.index;
      return;
    }
    popover.dataset.index = String(i);
    popover.innerHTML = `
      <p class="thinking-popover-head"><img src="assets/gina-avatar.jpg" alt=""><strong>Gina</strong><span>note ${i + 1} of ${notes.length}</span></p>
      <p class="thinking-popover-body"></p>`;
    popover.querySelector('.thinking-popover-body').textContent = notes[i].dataset.note;
    popover.hidden = false;
    place();
  }

  // WCAG contrast of an element's text against the first solid background
  // behind it - computed from the live styles, so it stays honest if the
  // palette changes.
  const parseRgb = (value) => (value.match(/[\d.]+/g) || []).map(Number);
  const luminance = ([r, g, b]) => {
    const channel = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const backgroundOf = (el) => {
    for (let node = el; node; node = node.parentElement) {
      const bg = parseRgb(getComputedStyle(node).backgroundColor);
      if (bg.length >= 3 && (bg[3] === undefined || bg[3] > 0.9)) return bg;
    }
    return [255, 255, 255];
  };
  const contrastLabel = (el) => {
    const style = getComputedStyle(el);
    const a = luminance(parseRgb(style.color));
    const b = luminance(backgroundOf(el));
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const size = parseFloat(style.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
    const level = ratio >= (large ? 4.5 : 7) ? 'AAA' : ratio >= (large ? 3 : 4.5) ? 'AA' : null;
    return `Contrast ${ratio.toFixed(1)}:1 · ${level ? `passes WCAG ${level}` : 'below WCAG AA'}`;
  };

  const visible = (rect) => rect.width > 0 && rect.height > 0;

  function place() {
    if (layer.hidden) return;
    const vw = document.documentElement.clientWidth;

    measures.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const line = redlines[i];
      line.style.display = visible(r) ? '' : 'none';
      Object.assign(line.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      line.firstChild.textContent = contrastLabel(el);
    });

    notes.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const pin = pins[i];
      pin.style.display = visible(r) ? '' : 'none';
      pin.style.left = `${Math.min(r.right - 14, vw - 34)}px`;
      // Elements that start at the very top of the screen (the sticky
      // panel) keep their pin on screen rather than half cut off.
      pin.style.top = `${r.top - 14 < 8 && r.bottom > 48 ? 8 : r.top - 14}px`;
    });

    if (openIndex >= 0) {
      const pinRect = pins[openIndex].getBoundingClientRect();
      const width = popover.offsetWidth;
      const left = pinRect.right + 8 + width > vw - 12 ? pinRect.left - width - 8 : pinRect.right + 8;
      popover.style.left = `${Math.max(12, left)}px`;
      popover.style.top = `${Math.max(12, pinRect.top)}px`;
    }
  }

  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; place(); });
  };

  const setOn = (on) => {
    layer.hidden = !on;
    document.documentElement.classList.toggle('is-thinking', on);
    toggle.setAttribute('aria-pressed', String(on));
    if (!on) openNote(-1);
    try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch (e) { /* private mode */ }
    place();
  };

  toggle.addEventListener('click', () => setOn(layer.hidden));
  document.addEventListener('click', (event) => {
    if (openIndex >= 0 && !popover.contains(event.target)) openNote(-1);
  });
  document.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (event.key === 't' || event.key === 'T') setOn(layer.hidden);
    else if (event.key === 'Escape' && openIndex >= 0) openNote(-1);
  });

  // Cards on the homepage reflow (filter tabs, hover lift) and images load
  // late, so re-measure on anything that can move an annotated element.
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('load', schedule);
  document.addEventListener('transitionend', schedule);
  new ResizeObserver(schedule).observe(document.body);

  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) { /* private mode */ }
  setOn(saved === '1');
})();
