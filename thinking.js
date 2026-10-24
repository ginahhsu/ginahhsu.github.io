// "Show the thinking" - press T (or flip the switch) to overlay the page's
// own layout reasoning: column bands with their gutters, redlines on text
// measure, and numbered pins that open a short note about a design decision.
//
// Everything is authored in the HTML, nothing per page lives here:
//   data-note="..."    a numbered pin on that element's top-right corner
//   data-measure       a redline: rendered width + characters per line
//   data-grid-col      a column band; gutters between side-by-side bands
//                      are labelled automatically
//
// Homepage only: index.html is the one page that loads this script and
// carries these attributes. The switch sits in the sticky panel, and the
// on/off state is remembered between visits.
(() => {
  const notes = [...document.querySelectorAll('[data-note]')];
  if (!notes.length) return;

  const measures = [...document.querySelectorAll('[data-measure]')];
  const cols = [...document.querySelectorAll('[data-grid-col]')];
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

  const bands = cols.map(() => layer.appendChild(Object.assign(document.createElement('div'), { className: 'thinking-band' })));
  const gutters = [];

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

  // Characters per line, counted from the rendered line boxes rather than
  // estimated from font size - so it stays honest at every breakpoint.
  const charsPerLine = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const tops = new Set([...range.getClientRects()].filter((r) => r.width > 1).map((r) => Math.round(r.top)));
    const length = el.textContent.replace(/\s+/g, ' ').trim().length;
    return Math.round(length / Math.max(1, tops.size));
  };

  const visible = (rect) => rect.width > 0 && rect.height > 0;

  function place() {
    if (layer.hidden) return;
    const vw = document.documentElement.clientWidth;

    const colRects = cols.map((col) => col.getBoundingClientRect());
    colRects.forEach((r, i) => {
      Object.assign(bands[i].style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, display: visible(r) ? '' : 'none' });
    });

    measures.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const line = redlines[i];
      line.style.display = visible(r) ? '' : 'none';
      Object.assign(line.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      line.firstChild.textContent = `${Math.round(r.width)}px · ${charsPerLine(el)} chars a line`;
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

    // Gutter labels between bands that sit side by side.
    gutters.forEach((g) => g.remove());
    gutters.length = 0;
    const sorted = colRects.filter(visible).sort((a, b) => a.left - b.left);
    for (let i = 1; i < sorted.length; i += 1) {
      const a = sorted[i - 1];
      const b = sorted[i];
      const gap = Math.round(b.left - a.right);
      if (gap <= 0 || b.top > a.bottom || a.top > b.bottom) continue;
      const g = document.createElement('div');
      g.className = 'thinking-gutter';
      g.innerHTML = `<span>${gap}</span>`;
      // Halfway down the part of the gutter that's on screen.
      const top = Math.max(a.top, b.top, 0);
      const bottom = Math.min(a.bottom, b.bottom, window.innerHeight);
      Object.assign(g.style, { left: `${a.right}px`, width: `${gap}px`, top: `${(top + bottom) / 2}px` });
      layer.appendChild(g);
      gutters.push(g);
      // Step down past any pin that lands on the label.
      const pinRects = pins.map((pin) => pin.getBoundingClientRect()).filter(visible);
      const hits = (rect) => pinRects.some((p) => p.left < rect.right && p.right > rect.left && p.top < rect.bottom + 16 && p.bottom > rect.top);
      for (let tries = 0; tries < 6 && hits(g.getBoundingClientRect()); tries += 1) {
        g.style.top = `${parseFloat(g.style.top) + 40}px`;
      }
    }

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

  // Cards on the homepage reflow (filter tabs, hover tilt) and images load
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
