// In-page editor. Only ever loaded by tools/edit-server.py, which injects it
// (plus window.__EDIT__ = { token, file, hash }) into pages it serves on
// 127.0.0.1 - no page on the live site references this file.
//
//   Edit (E)    every text block with a data-src range becomes typeable
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

  const pending = { tokens: {} };
  const changedBlocks = () => blocks.filter((el) => originals.has(el) && el.innerHTML !== originals.get(el));
  const tokenCount = () => Object.values(pending.tokens).reduce((n, values) => n + Object.keys(values).length, 0);
  const dirtyCount = () => changedBlocks().length + tokenCount();

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
    if (!on) {
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
    if (!editing || event.target.closest('.ed-dock, .ed-panel, .ed-modal')) return;
    if (event.target.closest('a, button')) event.preventDefault();
  }, true);

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
    const ref = token.value.match(/^var\((--[\w-]+?-)[\w]+\)$/);
    const hex = /^#[0-9a-f]{3,8}$/i.test(token.value);

    if (px) {
      const value = parseFloat(px[1]);
      const number = Object.assign(document.createElement('input'), { type: 'number', value, step: 1 });
      const range = Object.assign(document.createElement('input'), { type: 'range', min: Math.min(0, value), max: Math.max(64, Math.ceil(value * 2.5)), step: 1, value });
      number.addEventListener('input', () => { range.value = number.value; update(`${number.value}px`); });
      range.addEventListener('input', () => { number.value = range.value; update(`${range.value}px`); });
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
  async function save() {
    const text = changedBlocks().map((el) => {
      const [start, end] = el.dataset.src.split(':').map(Number);
      return { start, end, html: el.innerHTML };
    });
    if (!text.length && !tokenCount()) return;
    btn('save').disabled = true;
    btn('save').textContent = 'Saving…';
    try {
      await api('save', { file: CONFIG.file, hash: CONFIG.hash, text, tokens: pending.tokens });
      pending.tokens = {};
      originals.clear();
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
