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

// Card hover + linked intro (desktop pointers only).
//
// Hovering (or tabbing to) a card selects it - a coral box with corner
// handles and a label naming the journey it covered and what it moved
// (the card's data-outcome) - dims the rest of the grid,
// and lights up the intro sentence about it in the sticky panel. Hovering
// an intro sentence does the same in reverse. Sentences are tied to cards
// by data-work="ultrabasic" <-> href="./ultrabasic.html", so there's no
// second list to keep in sync.
const cards = [...document.querySelectorAll('a.card')];
const masonry = document.querySelector('.masonry');
const intro = document.querySelector('.panel-intro');
const sentences = intro ? [...intro.querySelectorAll('[data-work]')] : [];
const workOf = (card) => (card.getAttribute('href') || '').replace(/^\.\//, '').replace(/\.html$/, '');

if (masonry) {
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const boxes = [];
  const boxFor = (i) => {
    if (!boxes[i]) {
      const box = document.createElement('div');
      box.className = 'card-selection';
      box.setAttribute('aria-hidden', 'true');
      box.innerHTML = '<i></i><i></i><i></i><i></i><span></span>';
      document.body.appendChild(box);
      boxes[i] = box;
    }
    return boxes[i];
  };

  let lit = [];
  let frame = 0;

  // Re-measured every frame while something is lit: the card lifts on
  // hover and the page can scroll underneath, so a one-off position drifts.
  const place = () => {
    lit.forEach((card, i) => {
      const r = card.getBoundingClientRect();
      const box = boxFor(i);
      Object.assign(box.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      const label = card.dataset.outcome || card.querySelector('.card-btn')?.textContent.trim() || '';
      box.lastChild.textContent = label;
      box.classList.add('is-on');
    });
    boxes.slice(lit.length).forEach((box) => box.classList.remove('is-on'));
    frame = lit.length ? requestAnimationFrame(place) : 0;
  };

  const light = (works) => {
    lit = cards.filter((card) => works.includes(workOf(card)) && !card.classList.contains('is-disabled'));
    masonry.classList.toggle('is-linked', lit.length > 0);
    cards.forEach((card) => card.classList.toggle('is-lit', lit.includes(card)));
    const spot = sentences.some((s) => works.includes(s.dataset.work));
    intro?.classList.toggle('is-spot', spot);
    sentences.forEach((s) => s.classList.toggle('is-on', works.includes(s.dataset.work)));
    if (lit.length && !frame) frame = requestAnimationFrame(place);
    if (!lit.length) place();
  };

  cards.forEach((card) => {
    // Keyboard focus gets the same selection and linked sentence as hover,
    // on every device - only the pointer-driven drift is mouse-only.
    card.addEventListener('focus', () => light([workOf(card)]));
    card.addEventListener('blur', () => light([]));
    if (!canHover) return;
    card.addEventListener('mouseenter', () => light([workOf(card)]));
    card.addEventListener('mouseleave', () => {
      card.style.removeProperty('--px');
      card.style.removeProperty('--py');
      light([]);
    });
    // Image drift: -1..1 from the card's centre, scaled in CSS.
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--px', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
      card.style.setProperty('--py', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
    });
    // Settle before navigating, so the view transition captures the card
    // at rest rather than mid-drift.
    card.addEventListener('click', () => {
      card.style.removeProperty('--px');
      card.style.removeProperty('--py');
      light([]);
    });
  });

  if (canHover) sentences.forEach((sentence) => {
    sentence.addEventListener('mouseenter', () => light(sentence.dataset.work.split(/\s+/)));
    sentence.addEventListener('mouseleave', () => light([]));
  });
}

// Highlights card: auto-advancing, one full attribute at a time, crossfading in place.
// A single fixed-height box swaps its text content on each tick - sized to fit every
// attribute in full, so nothing ever truncates.
//
// Moving content has to be stoppable (WCAG 2.2.2): it pauses on hover and on
// keyboard focus, the dots are real buttons that step through it, and with
// reduced motion on it doesn't auto-advance at all.
const highlightsViewport = document.querySelector('.highlights-viewport');
if (highlightsViewport) {
  const card = highlightsViewport.closest('.card-highlights');
  const data = [...document.querySelectorAll('.highlights-data li')].map((li) => li.textContent.trim());
  const activeEl = highlightsViewport.querySelector('.is-active');
  const dotsEl = document.querySelector('.highlights-dots');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  // Silent while it rotates on its own; announced once someone steps
  // through it with the dots.
  activeEl.setAttribute('aria-live', 'off');
  let index = 0;
  let timer;

  if (dotsEl) {
    dotsEl.innerHTML = data.map((_, i) => `<button type="button" class="highlights-dot" aria-label="Highlight ${i + 1} of ${data.length}"></button>`).join('');
  }
  const dots = dotsEl ? [...dotsEl.children] : [];

  const setText = () => {
    const current = index % data.length;
    activeEl.textContent = data[current];
    dots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === current);
      dot.setAttribute('aria-current', String(i === current));
    });
  };

  setText();

  const show = (next) => {
    if (reduceMotion.matches) {
      index = next;
      setText();
      return;
    }
    activeEl.classList.add('is-swapping');
    setTimeout(() => {
      index = next;
      setText();
      void activeEl.offsetHeight; // force reflow so removing the class re-triggers the transition
      activeEl.classList.remove('is-swapping');
    }, 400);
  };

  const stop = () => clearInterval(timer);
  const start = () => {
    stop();
    if (!reduceMotion.matches) timer = setInterval(() => show(index + 1), 3400);
  };

  dots.forEach((dot, i) => dot.addEventListener('click', () => {
    stop();
    activeEl.setAttribute('aria-live', 'polite');
    show(i);
  }));

  start();
  card.addEventListener('mouseenter', stop);
  card.addEventListener('mouseleave', () => { if (!card.contains(document.activeElement)) start(); });
  card.addEventListener('focusin', stop);
  card.addEventListener('focusout', (e) => { if (!card.contains(e.relatedTarget)) start(); });
  reduceMotion.addEventListener('change', start);
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
