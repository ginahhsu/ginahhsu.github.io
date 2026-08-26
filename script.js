// Size the background grid so a whole number of tiles always fits exactly
// across its width - otherwise the rightmost column gets clipped mid-tile
// whenever the viewport width isn't a multiple of the tile size. Keeps the
// tile close to its natural ~1040px size rather than always snapping to one
// giant or one tiny tile.
const bgGrid = document.querySelector('.bg-grid');
if (bgGrid) {
  const NATIVE_W = 865;
  const NATIVE_H = 1403;
  const TARGET_TILE = 1040;

  const sizeGrid = () => {
    const width = bgGrid.getBoundingClientRect().width;
    if (!width) return;
    const tilesAcross = Math.max(1, Math.round(width / TARGET_TILE));
    const tileWidth = width / tilesAcross;
    const tileHeight = tileWidth * (NATIVE_H / NATIVE_W);
    bgGrid.style.backgroundSize = `${tileWidth}px ${tileHeight}px`;
  };

  sizeGrid();
  window.addEventListener('resize', sizeGrid);
}

// Subtle tilt/lift on card hover.
document.querySelectorAll('a.card').forEach((card) => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotateX = ((y / rect.height) - 0.5) * -4;
    const rotateY = ((x / rect.width) - 0.5) * 4;
    card.style.transform = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-3px)`;
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
  });

  // Clear the hover tilt before navigating away, so a cross-document view
  // transition captures the card flat rather than mid-tilt.
  card.addEventListener('click', () => {
    card.style.transform = '';
  });
});

// Highlights card: auto-advancing, one full attribute at a time, crossfading in place.
// A single fixed-height box swaps its text content on each tick - sized to fit every
// attribute in full, so nothing ever truncates.
const highlightsViewport = document.querySelector('.highlights-viewport');
if (highlightsViewport) {
  const data = [...document.querySelectorAll('.highlights-data li')].map((li) => li.textContent.trim());
  const activeEl = highlightsViewport.querySelector('.is-active');
  const dotsEl = document.querySelector('.highlights-dots');
  let index = 0;
  let timer;

  if (dotsEl) {
    dotsEl.innerHTML = data.map(() => '<span class="highlights-dot"></span>').join('');
  }
  const dots = dotsEl ? [...dotsEl.children] : [];

  const setText = () => {
    const current = index % data.length;
    activeEl.textContent = data[current];
    dots.forEach((dot, i) => dot.classList.toggle('is-active', i === current));
  };

  setText();

  const advance = () => {
    activeEl.classList.add('is-swapping');
    setTimeout(() => {
      index += 1;
      setText();
      void activeEl.offsetHeight; // force reflow so removing the class re-triggers the transition
      activeEl.classList.remove('is-swapping');
    }, 400);
  };

  const start = () => { timer = setInterval(advance, 3400); };
  const stop = () => clearInterval(timer);

  start();
  highlightsViewport.addEventListener('mouseenter', stop);
  highlightsViewport.addEventListener('mouseleave', start);
}

// Tab filtering (All / About / Projects / For fun). Non-matching cards stay
// visible but dim out, and every card reflows into its new position with a
// FLIP-based transition (record old position, reorder, animate the delta).
const tabs = document.querySelectorAll('.tab');
const cols = document.querySelectorAll('.col');

// Fixed reference order per column, captured once - every filter reorders
// from this canonical list rather than whatever order the last filter left
// behind, so "All" always lands back on the original layout.
const originalOrder = new Map([...cols].map((col) => [col, [...col.children]]));

const categoryOf = (item) => item.dataset.category || item.querySelector('[data-category]')?.dataset.category;
const focusablesOf = (item) => (item.matches('a') ? [item] : [...item.querySelectorAll('a')]);

const applyFilter = (filter) => {
  const items = [...cols].flatMap((col) => [...col.children]);
  const isMatch = (item) => filter === 'all' || categoryOf(item) === filter;

  // FIRST: record every item's position before touching the DOM.
  const firstRects = new Map(items.map((item) => [item, item.getBoundingClientRect()]));

  // Reorder each column in place: matches first, then non-matches - both
  // groups keep their original relative order so the reflow reads naturally.
  cols.forEach((col) => {
    const children = originalOrder.get(col);
    const matched = children.filter(isMatch);
    const unmatched = children.filter((item) => !isMatch(item));
    [...matched, ...unmatched].forEach((item) => col.appendChild(item));
  });

  // Dim non-matching cards instead of removing them, and keep them out of
  // tab order while they're disabled.
  items.forEach((item) => {
    const match = isMatch(item);
    item.classList.toggle('is-disabled', !match);
    focusablesOf(item).forEach((a) => {
      if (match) a.removeAttribute('tabindex');
      else a.setAttribute('tabindex', '-1');
    });
  });

  // LAST + INVERT + PLAY: animate every item from its old position to its new one.
  items.forEach((item) => {
    const first = firstRects.get(item);
    const last = item.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    if (!dx && !dy) return;

    item.style.transition = 'none';
    item.style.transform = `translate(${dx}px, ${dy}px)`;
    void item.offsetHeight; // force reflow so the transition below actually animates

    requestAnimationFrame(() => {
      item.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
      item.style.transform = '';
    });

    item.addEventListener('transitionend', () => {
      item.style.transition = '';
    }, { once: true });
  });
};

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    applyFilter(tab.dataset.filter);
  });
});
