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
});

// Highlights card: auto-advancing, one bold item + one dimmed item visible at a time, looping.
const highlightsList = document.querySelector('.highlights-list');
if (highlightsList) {
  const count = highlightsList.children.length;

  // Duplicate the list so the last item can scroll seamlessly back into the first.
  [...highlightsList.children].forEach((li) => {
    const clone = li.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    highlightsList.appendChild(clone);
  });

  const items = [...highlightsList.children];
  const viewport = highlightsList.parentElement;
  let index = 0;
  let timer;

  const render = (animate) => {
    highlightsList.style.transition = animate ? '' : 'none';
    viewport.style.transition = animate ? '' : 'none';

    items.forEach((li, i) => li.classList.toggle('active', i === index));

    const activeTop = items[index].offsetTop;
    const next = items[index + 1];
    viewport.style.height = `${(next.offsetTop + next.offsetHeight) - activeTop}px`;
    highlightsList.style.transform = `translateY(-${activeTop}px)`;

    if (!animate) void highlightsList.offsetHeight; // force reflow before re-enabling transitions
  };

  const advance = () => {
    index += 1;
    render(true);
    if (index === count) {
      setTimeout(() => {
        index = 0;
        render(false);
      }, 900);
    }
  };

  render(false);
  const start = () => { timer = setInterval(advance, 3400); };
  const stop = () => clearInterval(timer);

  // Re-measure once webfonts finish loading, since that can shift line wraps/heights.
  const fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  fontsReady.then(() => render(false));

  // Re-measure on resize so the clipped height stays accurate at any viewport width.
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => render(false), 150);
  });

  start();
  viewport.addEventListener('mouseenter', stop);
  viewport.addEventListener('mouseleave', start);
}

// Tab filtering (All / About / Projects / For fun).
const tabs = document.querySelectorAll('.tab');
const cards = document.querySelectorAll('[data-category]');

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');

    const filter = tab.dataset.filter;
    cards.forEach((card) => {
      const match = filter === 'all' || card.dataset.category === filter;
      card.classList.toggle('hidden', !match);
    });
  });
});
