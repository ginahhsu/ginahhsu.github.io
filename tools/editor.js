// In-page editor. Only ever loaded by tools/edit-server.py, which injects it
// (plus window.__EDIT__ = { token, file, hash }) into pages it serves on
// 127.0.0.1 - no page on the live site references this file.
//
//   Edit (E)    every text block with a data-src range becomes typeable;
//               cards get a grip to reorder them (drag, or arrow keys),
//               images open a panel to replace them or edit alt text, and
//               text blocks get a right-edge handle to set their max-width
//   Spacing     the :root tokens of each stylesheet on the page, live preview
//   Save (⌘S)   writes text + tokens into the source files, then reloads
//   Publish     commits the saved files and pushes the current branch
(() => {
  const CONFIG = window.__EDIT__;
  if (!CONFIG) return;

  const RESUME_KEY = 'gh-editor-resume';
  const api = (path, body) => fetch(`/__edit/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'X-Edit-Token': CONFIG.token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  });

  // ---- Styles ----
  const style = document.createElement('style');
  style.textContent = `
    .ed-dock, .ed-panel, .ed-modal, .ed-toast { font: 500 13px/1.3 Roboto, system-ui, sans-serif; color: #fdfbf8; }
    .ed-dock { position: fixed; right: 16px; bottom: 16px; z-index: 2000; display: flex; gap: 4px; padding: 4px; border-radius: 100px; background: #1d120e; box-shadow: 0 10px 30px rgba(0,0,0,.3); }
    .ed-dock button, .ed-modal button { border: 0; border-radius: 100px; padding: 9px 14px; background: transparent; color: inherit; font: inherit; cursor: pointer; white-space: nowrap; }
    .ed-dock button:hover { background: rgba(253,251,248,.1); }
    .ed-dock button[aria-pressed="true"] { background: #fdfbf8; color: #2e1b15; }
    .ed-dock .ed-primary { background: #e8505b; color: #fff; }
    .ed-dock .ed-primary:hover { background: #d63f4a; }
    .ed-dock button:disabled { opacity: .4; cursor: default; background: transparent; }
    .ed-dock [data-mode-only] { display: none; }
    html.ed-editing .ed-dock [data-mode-only] { display: inline-block; }

    html.ed-editing [data-ed-text] { outline: 1px dashed rgba(232,80,91,.55); outline-offset: 3px; border-radius: 2px; cursor: text; }
    html.ed-editing [data-ed-text]:hover { outline-color: #e8505b; }
    html.ed-editing [data-ed-text]:focus { outline: 2px solid #e8505b; outline-offset: 3px; }
    html.ed-editing [data-ed-text].ed-changed { background: rgba(232,80,91,.1); }
    /* Reorder grips, image panel, width handle */
    .ed-grip { position: absolute; top: 10px; right: 10px; z-index: 12; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; background: #1d120e; color: #fdfbf8; cursor: grab; box-shadow: 0 4px 12px rgba(0,0,0,.25); }
    .ed-grip svg { width: 10px; height: 16px; }
    .ed-grip:focus-visible { outline: 2px solid #e8505b; outline-offset: 2px; }
    .ed-grip:active { cursor: grabbing; }
    html.ed-editing [data-block] { position: relative; }
    .ed-dragging { opacity: .4; }
    html.ed-editing img[data-img] { pointer-events: auto !important; cursor: pointer; }
    html.ed-editing img[data-img]:hover { outline: 2px dashed #e8505b; outline-offset: -2px; }
    html.ed-editing img[data-img].ed-changed { outline: 2px solid #e8505b; outline-offset: -2px; }
    html.ed-editing [data-ed-text].ed-resized { box-shadow: inset -2px 0 0 #e8505b; }
    .ed-image { position: fixed; z-index: 2050; width: 300px; padding: 14px 16px; border-radius: 14px; background: #1d120e; color: #fdfbf8; box-shadow: 0 16px 40px rgba(0,0,0,.35); font: 500 13px/1.35 Roboto, system-ui, sans-serif; }
    .ed-image[hidden] { display: none; }
    .ed-image p { margin: 0 0 8px; }
    .ed-image-head { display: flex; justify-content: space-between; align-items: center; }
    .ed-image-head button { border: 0; background: none; color: inherit; font-size: 18px; cursor: pointer; }
    .ed-image-file { font: 11px ui-monospace, Menlo, monospace; color: rgba(253,251,248,.6); word-break: break-all; }
    .ed-image-replace { display: inline-block; margin: 2px 0 12px; padding: 8px 12px; border-radius: 100px; background: rgba(253,251,248,.12); cursor: pointer; }
    .ed-image-replace:focus-within { outline: 2px solid #e8505b; }
    .ed-image-replace input { position: absolute; opacity: 0; width: 1px; height: 1px; }
    .ed-image-alt { display: block; }
    .ed-image-alt span { display: block; margin: 2px 0 6px; font-weight: 400; font-size: 11px; color: rgba(253,251,248,.55); }
    .ed-image-alt textarea { width: 100%; padding: 8px; border: 1px solid rgba(253,251,248,.2); border-radius: 8px; background: transparent; color: inherit; font: 400 13px/1.4 Roboto, system-ui, sans-serif; resize: vertical; }
    .ed-image-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 10px; }
    .ed-image-actions button { border: 0; border-radius: 100px; padding: 8px 12px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
    .ed-image-actions .ed-primary { background: #e8505b; color: #fff; }
    .ed-width { position: fixed; z-index: 2040; width: 8px; height: 28px; border-radius: 4px; background: #e8505b; cursor: ew-resize; box-shadow: 0 2px 6px rgba(0,0,0,.25); touch-action: none; }
    .ed-width[hidden] { display: none; }
    .ed-width span { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); padding: 3px 6px; border-radius: 4px; background: #e8505b; color: #fff; font: 500 10px/1 ui-monospace, Menlo, monospace; white-space: nowrap; }
    .ed-width span:empty { display: none; }
    .ed-revealed { display: block !important; outline: 1px dashed #e8505b; padding: 8px 10px 8px 26px; margin: 8px 0; position: relative; }
    .ed-revealed::before { content: "Hidden source text - shown while editing"; display: block; margin: 0 0 6px -16px; font: 600 10px/1 ui-monospace, Menlo, monospace; color: #e8505b; }

    .ed-panel { position: fixed; top: 12px; right: 12px; bottom: 72px; z-index: 2000; width: 320px; display: flex; flex-direction: column; border-radius: 14px; background: #1d120e; box-shadow: 0 16px 40px rgba(0,0,0,.35); }
    .ed-panel[hidden] { display: none; }
    .ed-panel header { padding: 14px 16px 10px; border-bottom: 1px solid rgba(253,251,248,.12); }
    .ed-panel header p { margin: 4px 0 0; color: rgba(253,251,248,.6); font-weight: 400; font-size: 12px; }
    .ed-panel-body { overflow-y: auto; padding: 4px 16px 16px; }
    .ed-file { margin: 16px 0 2px; font: 600 11px/1 ui-monospace, Menlo, monospace; color: #ffd1c6; }
    .ed-group { margin: 14px 0 6px; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; color: rgba(253,251,248,.5); }
    .ed-row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 4px 8px; padding: 6px 0; }
    .ed-row label { font: 12px ui-monospace, Menlo, monospace; color: rgba(253,251,248,.85); overflow: hidden; text-overflow: ellipsis; }
    .ed-row.ed-changed label { color: #ff8f96; }
    .ed-row input[type="range"] { grid-column: 1 / -1; width: 100%; accent-color: #e8505b; }
    .ed-row input[type="number"], .ed-row input[type="text"], .ed-row select { width: 110px; padding: 5px 7px; border: 1px solid rgba(253,251,248,.18); border-radius: 6px; background: transparent; color: inherit; font: 12px ui-monospace, Menlo, monospace; }
    .ed-row select option { color: #000; }
    .ed-row .ed-color { display: flex; gap: 6px; align-items: center; }
    .ed-row input[type="color"] { width: 26px; height: 26px; padding: 0; border: 0; background: none; }
    .ed-row .ed-color input[type="text"] { width: 80px; }

    .ed-modal { position: fixed; inset: 0; z-index: 2100; display: grid; place-items: center; background: rgba(0,0,0,.4); }
    .ed-modal > div { width: min(420px, calc(100vw - 32px)); padding: 20px; border-radius: 14px; background: #1d120e; box-shadow: 0 16px 40px rgba(0,0,0,.35); }
    .ed-modal h2 { margin: 0 0 8px; font-size: 16px; }
    .ed-modal p, .ed-modal li { color: rgba(253,251,248,.75); font-weight: 400; line-height: 1.45; }
    .ed-modal ul { margin: 8px 0; padding-left: 18px; font: 12px ui-monospace, Menlo, monospace; }
    .ed-modal input { width: 100%; margin: 8px 0 16px; padding: 9px 10px; border: 1px solid rgba(253,251,248,.2); border-radius: 8px; background: transparent; color: inherit; font: inherit; }
    .ed-modal .ed-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .ed-modal .ed-primary { background: #e8505b; color: #fff; }
    .ed-modal pre { max-height: 160px; overflow: auto; white-space: pre-wrap; font-size: 11px; color: rgba(253,251,248,.7); }

    /* The site nav floats at the bottom below 960px - dock moves up out of its way. */
    @media (max-width: 960px) {
      .ed-dock { top: 12px; bottom: auto; }
      .ed-panel { top: 64px; bottom: 12px; }
    }

    .ed-toast { position: fixed; left: 50%; top: 16px; transform: translateX(-50%); z-index: 2200; max-width: min(520px, calc(100vw - 32px)); padding: 10px 16px; border-radius: 10px; background: #1d120e; box-shadow: 0 10px 30px rgba(0,0,0,.3); white-space: pre-wrap; }
    .ed-toast.is-error { background: #9b2430; }
  `;
  document.head.appendChild(style);

  const toast = (message, isError) => {
    const el = document.createElement('div');
    el.className = `ed-toast${isError ? ' is-error' : ''}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), isError ? 7000 : 2600);
  };

  // ---- Dock ----
  const dock = document.createElement('div');
  dock.className = 'ed-dock';
  dock.innerHTML = `
    <button type="button" data-act="edit" aria-pressed="false" title="Edit text (E)">&#9998; Edit</button>
    <button type="button" data-act="spacing" data-mode-only aria-pressed="false">Spacing &amp; color</button>
    <button type="button" data-act="save" data-mode-only class="ed-primary" disabled>Save</button>
    <button type="button" data-act="publish">Publish&hellip;</button>`;
  document.body.appendChild(dock);
  const btn = (act) => dock.querySelector(`[data-act="${act}"]`);

  // ---- Text editing ----
  const hasWords = (el) => /[\p{L}\p{N}]/u.test(el.textContent);
  const blocks = [...document.querySelectorAll('[data-src]')].filter(hasWords);
  const originals = new Map();
  const revealed = [];
  let editing = false;

  const pending = { tokens: {}, widths: new Map(), images: new Map() };
  const changedBlocks = () => blocks.filter((el) => originals.has(el) && el.innerHTML !== originals.get(el));
  const tokenCount = () => Object.values(pending.tokens).reduce((n, values) => n + Object.keys(values).length, 0);
  const dirtyCount = () => changedBlocks().length + tokenCount() + pending.widths.size + pending.images.size + (orderChanged() ? 1 : 0);

  // ---- Card order ----
  // Containers marked data-reorder (the homepage's two columns) hold blocks
  // with data-block ranges; the server rebuilds each container from the
  // order they end up in.
  const containers = [...document.querySelectorAll('[data-reorder-src]')];
  const orderOf = () => containers.map((c) => [...c.children].filter((k) => k.dataset.block).map((k) => k.dataset.block).join(','));
  const originalOrder = orderOf();
  const orderChanged = () => orderOf().some((o, i) => o !== originalOrder[i]);

  const refresh = () => {
    const n = dirtyCount();
    btn('save').disabled = !n;
    btn('save').textContent = n ? `Save ${n} change${n === 1 ? '' : 's'}` : 'Save';
    blocks.forEach((el) => el.classList.toggle('ed-changed', originals.has(el) && el.innerHTML !== originals.get(el)));
  };

  const setEditing = (on) => {
    editing = on;
    document.documentElement.classList.toggle('ed-editing', on);
    btn('edit').setAttribute('aria-pressed', String(on));
    btn('edit').innerHTML = on ? 'Done' : '&#9998; Edit';
    blocks.forEach((el) => {
      if (on) {
        if (!originals.has(el)) originals.set(el, el.innerHTML);
        el.setAttribute('contenteditable', 'true');
        el.setAttribute('data-ed-text', '');
        el.spellcheck = true;
        const hiddenParent = el.closest('[hidden]');
        if (hiddenParent && !revealed.includes(hiddenParent)) {
          hiddenParent.hidden = false;
          hiddenParent.classList.add('ed-revealed');
          revealed.push(hiddenParent);
        }
      } else {
        el.removeAttribute('contenteditable');
        el.removeAttribute('data-ed-text');
      }
    });
    setGrips(on);
    if (!on) {
      closeImagePanel();
      widthHandle.hidden = true;
      revealed.splice(0).forEach((el) => { el.hidden = true; el.classList.remove('ed-revealed'); });
      panel.hidden = true;
      btn('spacing').setAttribute('aria-pressed', 'false');
    }
  };

  document.addEventListener('input', (event) => {
    if (event.target.closest?.('[data-ed-text]')) refresh();
  });

  // One block = one line of copy: Enter finishes, Shift+Enter is a line break.
  document.addEventListener('keydown', (event) => {
    const block = event.target.closest?.('[data-ed-text]');
    if (block && event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) document.execCommand('insertLineBreak');
      else block.blur();
    }
    if (block && event.key === 'Escape') {
      block.innerHTML = originals.get(block);
      block.blur();
      refresh();
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 's' && editing) {
      event.preventDefault();
      save();
    }
    if (!block && !event.metaKey && !event.ctrlKey && !event.altKey && (event.key === 'e' || event.key === 'E')
      && !event.target.closest?.('input, textarea, select, [contenteditable]')) {
      setEditing(!editing);
    }
  }, true);

  // Paste as plain text, so styling from wherever it was copied stays out of the source.
  document.addEventListener('paste', (event) => {
    if (!event.target.closest?.('[data-ed-text]')) return;
    event.preventDefault();
    document.execCommand('insertText', false, event.clipboardData.getData('text/plain').replace(/\s*\n\s*/g, ' '));
  });

  // While editing, links and cards stay put instead of navigating away.
  document.addEventListener('click', (event) => {
    if (!editing || event.target.closest('.ed-dock, .ed-panel, .ed-modal, .ed-image')) return;
    const img = event.target.closest('img[data-img]');
    if (img) {
      event.preventDefault();
      event.stopPropagation();
      openImagePanel(img);
      return;
    }
    if (event.target.closest('a, button, .ed-grip')) event.preventDefault();
  }, true);

  // ---- Reorder: grips ----
  const grips = [];
  const groupOf = (block) => block.parentElement;
  function setGrips(on) {
    grips.splice(0).forEach((g) => g.remove());
    if (!on) return;
    containers.forEach((container) => [...container.children].filter((k) => k.dataset.block).forEach((block) => {
      const grip = document.createElement('span');
      grip.className = 'ed-grip';
      grip.setAttribute('role', 'button');
      grip.setAttribute('tabindex', '0');
      grip.setAttribute('aria-label', 'Move card (drag, or use arrow keys)');
      grip.draggable = true;
      grip.innerHTML = '<svg viewBox="0 0 10 16" aria-hidden="true"><g fill="currentColor"><circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/><circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/></g></svg>';
      block.appendChild(grip);
      grips.push(grip);
    }));
  }

  let dragging = null;
  document.addEventListener('dragstart', (event) => {
    const grip = event.target.closest?.('.ed-grip');
    if (!grip) return;
    dragging = grip.parentElement;
    dragging.classList.add('ed-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', '');
    const r = dragging.getBoundingClientRect();
    event.dataTransfer.setDragImage(dragging, event.clientX - r.left, event.clientY - r.top);
  });
  document.addEventListener('dragover', (event) => {
    if (!dragging) return;
    const over = event.target.closest?.('[data-block]');
    const container = over ? over.parentElement : event.target.closest?.('[data-reorder-src]');
    if (!container || !containers.includes(container)) return;
    event.preventDefault();
    if (over && over !== dragging && !over.contains(dragging)) {
      const r = over.getBoundingClientRect();
      container.insertBefore(dragging, event.clientY < r.top + r.height / 2 ? over : over.nextSibling);
    } else if (!over) {
      container.appendChild(dragging);
    }
  });
  document.addEventListener('drop', (event) => { if (dragging) event.preventDefault(); });
  document.addEventListener('dragend', () => {
    if (!dragging) return;
    dragging.classList.remove('ed-dragging');
    dragging = null;
    refresh();
  });

  // Keyboard: up/down within a column, left/right to the other column.
  // Captured and stopped here so the site nav's arrow-key page shortcuts
  // never see these presses.
  document.addEventListener('keydown', (event) => {
    const grip = event.target.closest?.('.ed-grip');
    if (!grip || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const block = grip.parentElement;
    const container = groupOf(block);
    const siblings = [...container.children].filter((k) => k.dataset.block);
    const i = siblings.indexOf(block);
    if (event.key === 'ArrowUp' && i > 0) container.insertBefore(block, siblings[i - 1]);
    if (event.key === 'ArrowDown' && i < siblings.length - 1) container.insertBefore(block, siblings[i + 1].nextSibling);
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const target = containers[containers.indexOf(container) + (event.key === 'ArrowLeft' ? -1 : 1)];
      if (target) {
        const others = [...target.children].filter((k) => k.dataset.block);
        target.insertBefore(block, others[Math.min(i, others.length)] || null);
      }
    }
    grip.focus();
    refresh();
  }, true);

  // ---- Images: replace + alt text ----
  const imagePanel = document.createElement('div');
  imagePanel.className = 'ed-image';
  imagePanel.hidden = true;
  imagePanel.setAttribute('role', 'dialog');
  imagePanel.setAttribute('aria-label', 'Edit image');
  document.body.appendChild(imagePanel);
  let imageTarget = null;

  const imageState = (img) => pending.images.get(img) || { alt: img.getAttribute('alt') || '', file: null };
  const setImageState = (img, state) => {
    const changed = state.file || state.alt !== (img.dataset.edAlt ?? img.getAttribute('alt') ?? '');
    if (changed) pending.images.set(img, state);
    else pending.images.delete(img);
    img.classList.toggle('ed-changed', !!changed);
    refresh();
  };

  function openImagePanel(img) {
    if (img.dataset.edSrc === undefined) {
      img.dataset.edSrc = img.getAttribute('src');
      img.dataset.edAlt = img.getAttribute('alt') || '';
    }
    imageTarget = img;
    const state = imageState(img);
    imagePanel.innerHTML = `
      <p class="ed-image-head"><strong>Image</strong><button type="button" data-close aria-label="Close">&times;</button></p>
      <p class="ed-image-file"></p>
      <label class="ed-image-replace">Replace image&hellip;<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif"></label>
      <label class="ed-image-alt">Alt text <span>what a screen reader says - leave empty only if it's decorative</span><textarea rows="3"></textarea></label>
      <div class="ed-image-actions"><button type="button" data-revert>Revert</button><button type="button" data-close class="ed-primary">Done</button></div>`;
    imagePanel.querySelector('.ed-image-file').textContent = state.file ? `New: ${state.file.name} (saves into ${folderOf(img.dataset.edSrc)}/)` : img.dataset.edSrc;
    const alt = imagePanel.querySelector('textarea');
    alt.value = state.alt;
    alt.addEventListener('input', () => setImageState(img, { ...imageState(img), alt: alt.value }));
    imagePanel.querySelector('input[type="file"]').addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;
      img.src = URL.createObjectURL(file);
      img.removeAttribute('srcset');
      setImageState(img, { ...imageState(img), file });
      imagePanel.querySelector('.ed-image-file').textContent = `New: ${file.name} (saves into ${folderOf(img.dataset.edSrc)}/)`;
    });
    imagePanel.querySelector('[data-revert]').addEventListener('click', () => {
      img.src = img.dataset.edSrc;
      img.setAttribute('alt', img.dataset.edAlt);
      pending.images.delete(img);
      img.classList.remove('ed-changed');
      refresh();
      openImagePanel(img);
    });
    imagePanel.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeImagePanel));
    imagePanel.hidden = false;
    const r = img.getBoundingClientRect();
    const w = imagePanel.offsetWidth;
    const h = imagePanel.offsetHeight;
    imagePanel.style.left = `${Math.max(12, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 12))}px`;
    imagePanel.style.top = `${Math.max(12, Math.min(r.top + 16, innerHeight - h - 12))}px`;
    alt.focus();
  }
  function closeImagePanel() {
    imagePanel.hidden = true;
    imageTarget?.focus?.();
    imageTarget = null;
  }
  const folderOf = (src) => (src || 'assets/x').replace(/^\.\//, '').split('/').slice(0, -1).join('/') || 'assets';
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !imagePanel.hidden) closeImagePanel();
  });

  // ---- Text widths: right-edge handle ----
  const widthHandle = document.createElement('div');
  widthHandle.className = 'ed-width';
  widthHandle.hidden = true;
  widthHandle.title = 'Drag to set this text block\'s width. Double-click to reset.';
  widthHandle.innerHTML = '<span></span>';
  document.body.appendChild(widthHandle);
  let widthTarget = null;
  let widthHide = 0;

  const isBlock = (el) => !/^inline/.test(getComputedStyle(el).display);
  const placeWidthHandle = () => {
    if (!widthTarget) return;
    const r = widthTarget.getBoundingClientRect();
    Object.assign(widthHandle.style, { left: `${r.right + 4}px`, top: `${r.top + r.height / 2 - 14}px` });
  };
  const showWidthHandle = (el) => {
    clearTimeout(widthHide);
    if (!editing || !el || !isBlock(el)) return;
    widthTarget = el;
    widthHandle.hidden = false;
    widthHandle.firstChild.textContent = '';
    placeWidthHandle();
  };
  document.addEventListener('mouseover', (event) => {
    if (!editing || dragging) return;
    if (event.target.closest?.('.ed-width')) { clearTimeout(widthHide); return; }
    const el = event.target.closest?.('[data-ed-text]');
    if (el) showWidthHandle(el);
    else widthHide = setTimeout(() => { if (!widthHandle.classList.contains('is-dragging')) widthHandle.hidden = true; }, 400);
  });
  document.addEventListener('focusin', (event) => {
    const el = event.target.closest?.('[data-ed-text]');
    if (el) showWidthHandle(el);
  });
  window.addEventListener('scroll', placeWidthHandle, { passive: true });

  const setWidth = (el, value) => {
    const original = el.dataset.edWidth;
    el.style.maxWidth = value || '';
    if ((value || '') === original) pending.widths.delete(el);
    else pending.widths.set(el, value || null);
    el.classList.toggle('ed-resized', pending.widths.has(el));
    refresh();
  };
  widthHandle.addEventListener('pointerdown', (event) => {
    if (!widthTarget) return;
    event.preventDefault();
    const el = widthTarget;
    if (el.dataset.edWidth === undefined) el.dataset.edWidth = el.style.maxWidth || '';
    const startX = event.clientX;
    const startW = el.getBoundingClientRect().width;
    widthHandle.setPointerCapture(event.pointerId);
    widthHandle.classList.add('is-dragging');
    const move = (e) => {
      const w = Math.max(80, Math.round(startW + e.clientX - startX));
      el.style.maxWidth = `${w}px`;
      widthHandle.firstChild.textContent = `max-width ${w}px`;
      placeWidthHandle();
    };
    const up = () => {
      widthHandle.removeEventListener('pointermove', move);
      widthHandle.classList.remove('is-dragging');
      setWidth(el, el.style.maxWidth);
    };
    widthHandle.addEventListener('pointermove', move);
    widthHandle.addEventListener('pointerup', up, { once: true });
  });
  widthHandle.addEventListener('dblclick', () => {
    if (!widthTarget) return;
    if (widthTarget.dataset.edWidth === undefined) widthTarget.dataset.edWidth = widthTarget.style.maxWidth || '';
    setWidth(widthTarget, '');
    widthHandle.firstChild.textContent = 'width reset';
    placeWidthHandle();
  });

  // ---- Spacing & color panel ----
  const panel = document.createElement('aside');
  panel.className = 'ed-panel';
  panel.hidden = true;
  panel.innerHTML = '<header><strong>Spacing &amp; color</strong><p>Design tokens from this page\'s stylesheets. Changes preview live; Save writes them to the CSS.</p></header><div class="ed-panel-body"></div>';
  document.body.appendChild(panel);
  const panelBody = panel.querySelector('.ed-panel-body');
  let panelLoaded = false;

  const stylesheets = () => [...document.querySelectorAll('link[rel="stylesheet"]')]
    .map((link) => new URL(link.href, location.href))
    .filter((url) => url.origin === location.origin && url.pathname.endsWith('.css'))
    .map((url) => url.pathname.replace(/^\//, ''));

  const setToken = (file, name, value, original, row) => {
    document.documentElement.style.setProperty(name, value);
    pending.tokens[file] = pending.tokens[file] || {};
    if (value === original) delete pending.tokens[file][name];
    else pending.tokens[file][name] = value;
    row.classList.toggle('ed-changed', value !== original);
    refresh();
  };

  const tokenRow = (file, token, all) => {
    const row = document.createElement('div');
    row.className = 'ed-row';
    const label = document.createElement('label');
    label.textContent = token.name.replace(/^--/, '');
    label.title = `${token.name}: ${token.value}`;
    row.appendChild(label);
    const update = (value) => setToken(file, token.name, value, token.value, row);

    const px = token.value.match(/^(-?\d*\.?\d+)px$/);
    const pct = token.value.match(/^(\d*\.?\d+)%$/);
    const ref = token.value.match(/^var\((--[\w-]+?-)[\w]+\)$/);
    const hex = /^#[0-9a-f]{3,8}$/i.test(token.value);

    if (px) {
      const value = parseFloat(px[1]);
      const number = Object.assign(document.createElement('input'), { type: 'number', value, step: 1 });
      const range = Object.assign(document.createElement('input'), { type: 'range', min: Math.min(0, value), max: Math.max(64, Math.ceil(value * 2.5)), step: 1, value });
      number.addEventListener('input', () => { range.value = number.value; update(`${number.value}px`); });
      range.addEventListener('input', () => { number.value = range.value; update(`${range.value}px`); });
      row.append(number, range);
    } else if (pct) {
      // Percentages (e.g. --dim-strength) get a 0-100 slider.
      const value = parseFloat(pct[1]);
      const number = Object.assign(document.createElement('input'), { type: 'number', value, min: 0, max: 100, step: 1 });
      const range = Object.assign(document.createElement('input'), { type: 'range', min: 0, max: 100, step: 1, value });
      number.addEventListener('input', () => { range.value = number.value; update(`${number.value}%`); });
      range.addEventListener('input', () => { number.value = range.value; update(`${range.value}%`); });
      row.append(number, range);
    } else if (ref) {
      // A role token pointing at a scale step: pick another step, not a raw number.
      const select = document.createElement('select');
      all.filter((t) => t.name.startsWith(ref[1])).forEach((t) => {
        const option = new Option(`${t.name.slice(ref[1].length)} (${t.value})`, `var(${t.name})`);
        option.selected = `var(${t.name})` === token.value;
        select.add(option);
      });
      select.addEventListener('change', () => update(select.value));
      row.appendChild(select);
    } else if (hex) {
      const wrap = document.createElement('div');
      wrap.className = 'ed-color';
      const picker = Object.assign(document.createElement('input'), { type: 'color', value: token.value.length === 4 ? `#${[...token.value.slice(1)].map((c) => c + c).join('')}` : token.value.slice(0, 7) });
      const text = Object.assign(document.createElement('input'), { type: 'text', value: token.value });
      picker.addEventListener('input', () => { text.value = picker.value; update(picker.value); });
      text.addEventListener('change', () => update(text.value.trim()));
      wrap.append(picker, text);
      row.appendChild(wrap);
    } else {
      const text = Object.assign(document.createElement('input'), { type: 'text', value: token.value });
      text.addEventListener('change', () => update(text.value.trim()));
      row.appendChild(text);
    }
    return row;
  };

  const loadPanel = async () => {
    panelLoaded = true;
    for (const file of stylesheets()) {
      try {
        const { tokens } = await api(`tokens?file=${encodeURIComponent(file)}`);
        if (!tokens.length) continue;
        panelBody.appendChild(Object.assign(document.createElement('p'), { className: 'ed-file', textContent: file }));
        let group = null;
        tokens.forEach((token) => {
          if (token.group !== group) {
            group = token.group;
            panelBody.appendChild(Object.assign(document.createElement('p'), { className: 'ed-group', textContent: group }));
          }
          panelBody.appendChild(tokenRow(file, token, tokens));
        });
      } catch (error) {
        toast(error.message, true);
      }
    }
  };

  // ---- Save / publish ----
  const range = (attr) => attr.split(':').map(Number);

  async function save() {
    const text = changedBlocks().map((el) => {
      const [start, end] = range(el.dataset.src);
      return { start, end, html: el.innerHTML };
    });
    if (!dirtyCount()) return;
    btn('save').disabled = true;
    btn('save').textContent = 'Saving…';
    try {
      // New image files go up first; the save then points each <img> at its upload.
      const images = [];
      for (const [img, state] of pending.images) {
        const [start, end] = range(img.dataset.img);
        let src = null;
        if (state.file) {
          const res = await fetch(`/__edit/upload?dir=${encodeURIComponent(folderOf(img.dataset.edSrc))}&name=${encodeURIComponent(state.file.name)}`, {
            method: 'POST',
            headers: { 'X-Edit-Token': CONFIG.token },
            body: state.file,
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Image upload failed');
          src = data.path;
        }
        images.push({ start, end, src, alt: state.alt });
      }
      const widths = [...pending.widths].map(([el, maxWidth]) => {
        const [start, end] = range(el.dataset.tag);
        return { start, end, maxWidth };
      });
      const reorder = orderChanged()
        ? containers.map((c) => ({ container: c.dataset.reorderSrc, blocks: [...c.children].filter((k) => k.dataset.block).map((k) => k.dataset.block) }))
        : [];
      await api('save', { file: CONFIG.file, hash: CONFIG.hash, text, widths, images, reorder, tokens: pending.tokens });
      pending.tokens = {};
      pending.widths.clear();
      pending.images.clear();
      originals.clear();
      originalOrder.splice(0, originalOrder.length, ...orderOf());
      try { sessionStorage.setItem(RESUME_KEY, JSON.stringify({ editing, spacing: !panel.hidden, y: scrollY })); } catch (e) { /* ignore */ }
      location.reload();
    } catch (error) {
      toast(error.message, true);
      refresh();
    }
  }

  const modal = (html) => {
    const wrap = document.createElement('div');
    wrap.className = 'ed-modal';
    wrap.innerHTML = `<div role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', (event) => { if (event.target === wrap || event.target.dataset.close !== undefined) wrap.remove(); });
    return wrap;
  };

  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const publish = async () => {
    if (dirtyCount()) {
      toast('Save your changes first - Publish only sends what has been saved.', true);
      return;
    }
    let status;
    try { status = await api('status'); } catch (error) { toast(error.message, true); return; }
    if (!status.files.length) {
      modal('<h2>Nothing to publish yet</h2><p>Publish sends the files you\'ve saved from this editor since it started. Make an edit, Save, then come back here.</p><div class="ed-actions"><button type="button" data-close>OK</button></div>');
      return;
    }
    const live = status.branch === 'main';
    const box = modal(`
      <h2>Publish ${status.files.length} file${status.files.length === 1 ? '' : 's'}</h2>
      <p>Commits these files and pushes the <strong>${escapeHtml(status.branch)}</strong> branch to GitHub.
      ${live ? 'This is <strong>main</strong>, so the live site updates in about a minute.' : 'The live site only changes once this branch is merged into main.'}</p>
      <ul>${status.files.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
      <label>What changed?<input type="text" value="Edit copy and spacing in the site editor"></label>
      <div class="ed-actions"><button type="button" data-close>Cancel</button><button type="button" class="ed-primary">Commit &amp; push</button></div>`);
    const go = box.querySelector('.ed-primary');
    go.addEventListener('click', async () => {
      go.disabled = true;
      go.textContent = 'Pushing…';
      try {
        const result = await api('publish', { message: box.querySelector('input').value });
        box.remove();
        toast(result.live ? 'Published - the live site updates in about a minute.' : `Pushed ${result.branch}. Merge it into main to go live.`);
      } catch (error) {
        box.remove();
        modal(`<h2>Publish didn't finish</h2><pre>${escapeHtml(error.message)}</pre><div class="ed-actions"><button type="button" data-close>OK</button></div>`);
      }
    });
  };

  btn('edit').addEventListener('click', () => setEditing(!editing));
  btn('spacing').addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    btn('spacing').setAttribute('aria-pressed', String(!panel.hidden));
    if (!panel.hidden && !panelLoaded) loadPanel();
  });
  btn('save').addEventListener('click', save);
  btn('publish').addEventListener('click', publish);

  window.addEventListener('beforeunload', (event) => {
    if (dirtyCount()) event.preventDefault();
  });

  // Pick up where a save-and-reload left off.
  let resume = null;
  try { resume = JSON.parse(sessionStorage.getItem(RESUME_KEY)); sessionStorage.removeItem(RESUME_KEY); } catch (e) { /* ignore */ }
  if (resume) {
    if (resume.editing) setEditing(true);
    if (resume.spacing) btn('spacing').click();
    scrollTo(0, resume.y || 0);
    toast('Saved to the source files.');
  }
})();
