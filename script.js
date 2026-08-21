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

// Highlights card: auto-advancing, one item spotlighted at a time.
const highlightsList = document.querySelector('.highlights-list');
if (highlightsList) {
  const items = [...highlightsList.children];
  const viewport = highlightsList.parentElement;
  let activeIndex = 0;
  let timer;

  const showItem = (index) => {
    activeIndex = index;
    items.forEach((li, i) => li.classList.toggle('active', i === activeIndex));
    highlightsList.style.transform = `translateY(-${items[activeIndex].offsetTop}px)`;
  };

  const advance = () => showItem((activeIndex + 1) % items.length);

  const start = () => {
    timer = setInterval(advance, 2800);
  };
  const stop = () => clearInterval(timer);

  showItem(0);
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
