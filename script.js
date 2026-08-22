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

// Highlights card: auto-advancing, one full attribute at a time, crossfading in place.
// A single fixed-height box swaps its text content on each tick - sized to fit every
// attribute in full, so nothing ever truncates.
const highlightsViewport = document.querySelector('.highlights-viewport');
if (highlightsViewport) {
  const data = [...document.querySelectorAll('.highlights-data li')].map((li) => li.textContent.trim());
  const activeEl = highlightsViewport.querySelector('.is-active');
  let index = 0;
  let timer;

  const setText = () => {
    activeEl.textContent = data[index % data.length];
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
