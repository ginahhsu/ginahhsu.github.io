// Click any photo inside a case study's main content to view it full screen.
// Delegated on document, not bound per-image, so it also works for images
// added after load (the seat selection page's password-gated content,
// injected once unlocked) without needing a re-init hook.
//
// Images that share one background tile (an A/B "Experience A/B" panel, the
// five-touchpoint row) open together as that whole tile, not just the one
// image clicked - GROUP_SELECTORS lists the tile containers this applies to.
(function () {
  const GROUP_SELECTORS = ['.cs-panel', '.cs-touchpoints'];

  const lightbox = document.createElement('div');
  lightbox.className = 'cs-lightbox';
  lightbox.id = 'csLightbox';

  const closeBtn = document.createElement('span');
  closeBtn.className = 'cs-lightbox-close';
  closeBtn.setAttribute('aria-hidden', 'true');
  closeBtn.textContent = '×';

  const lightboxImg = document.createElement('img');
  lightboxImg.alt = '';

  let groupClone = null;

  lightbox.appendChild(closeBtn);
  lightbox.appendChild(lightboxImg);

  function findGroup(img) {
    for (const selector of GROUP_SELECTORS) {
      const group = img.closest(selector);
      if (group) return group;
    }
    return null;
  }

  function openLightbox(img) {
    if (groupClone) {
      groupClone.remove();
      groupClone = null;
    }

    const group = findGroup(img);
    if (group) {
      lightboxImg.style.display = 'none';
      groupClone = group.cloneNode(true);
      groupClone.classList.add('cs-lightbox-group');
      lightbox.appendChild(groupClone);
    } else {
      lightboxImg.style.display = '';
      lightboxImg.src = img.currentSrc || img.src;
      lightboxImg.alt = img.alt;
    }

    lightbox.classList.add('is-open');
  }

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    lightboxImg.src = '';
    if (groupClone) {
      groupClone.remove();
      groupClone = null;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(lightbox);
  });

  document.addEventListener('click', (e) => {
    const img = e.target.closest('.cs-main img');
    if (img) {
      openLightbox(img);
      return;
    }
    if (e.target.closest('#csLightbox')) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
})();
