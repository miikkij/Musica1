/**
 * Custom toast notifications and dialog prompts.
 * Replaces all alert() and prompt() usage.
 */

let container = null;

function ensureContainer() {
  if (container) return container;
  container = document.createElement('div');
  container.id = 'toast-container';
  document.body.appendChild(container);
  return container;
}

/**
 * Show a toast notification (auto-dismisses).
 * @param {string} message
 * @param {'info'|'success'|'error'|'warning'} type
 * @param {number} durationMs
 */
export function toast(message, type = 'info', durationMs = 4000) {
  const c = ensureContainer();
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;

  // Close button
  const close = document.createElement('span');
  close.className = 'toast-close';
  close.textContent = '\u00d7';
  close.addEventListener('click', () => el.remove());
  el.appendChild(close);

  c.appendChild(el);

  // Auto-dismiss
  setTimeout(() => {
    el.classList.add('toast-fade');
    setTimeout(() => el.remove(), 300);
  }, durationMs);
}

/**
 * Show a modal dialog with an input field (replaces prompt()).
 * @param {string} title
 * @param {string} defaultValue
 * @returns {Promise<string|null>} — resolved with input value, or null if cancelled
 */
export function dialogPrompt(title, defaultValue = '') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog-box';

    const label = document.createElement('div');
    label.className = 'dialog-title';
    label.textContent = title;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'dialog-input';
    input.value = defaultValue;

    const btnRow = document.createElement('div');
    btnRow.className = 'dialog-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'dialog-btn dialog-cancel';
    cancelBtn.textContent = 'Cancel';

    const okBtn = document.createElement('button');
    okBtn.className = 'dialog-btn dialog-ok';
    okBtn.textContent = 'OK';

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(okBtn);
    dialog.appendChild(label);
    dialog.appendChild(input);
    dialog.appendChild(btnRow);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    input.focus();
    input.select();

    function close(val) {
      overlay.remove();
      resolve(val);
    }

    cancelBtn.addEventListener('click', () => close(null));
    okBtn.addEventListener('click', () => close(input.value));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') close(input.value);
      if (e.key === 'Escape') close(null);
    });
  });
}

/**
 * Show an info dialog with HTML content and an OK button.
 * @param {string} title
 * @param {string} htmlContent
 * @returns {Promise<void>}
 */
export function dialogInfo(title, htmlContent) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog-box dialog-wide';

    const titleEl = document.createElement('div');
    titleEl.className = 'dialog-title';
    titleEl.textContent = title;

    const body = document.createElement('div');
    body.className = 'dialog-body';
    body.innerHTML = htmlContent;

    const okBtn = document.createElement('button');
    okBtn.className = 'dialog-btn dialog-ok';
    okBtn.textContent = 'OK';
    okBtn.style.marginTop = '12px';

    dialog.appendChild(titleEl);
    dialog.appendChild(body);
    dialog.appendChild(okBtn);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    function close() { overlay.remove(); resolve(); }

    okBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape' || e.key === 'Enter') { close(); document.removeEventListener('keydown', handler); }
    });
    okBtn.focus();
  });
}

/**
 * Show a selection dialog (replaces prompt() with numbered list).
 * @param {string} title
 * @param {string[]} options
 * @returns {Promise<string|null>} — resolved with selected option, or null
 */
export function dialogSelect(title, options) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog-box';

    const label = document.createElement('div');
    label.className = 'dialog-title';
    label.textContent = title;
    dialog.appendChild(label);

    const list = document.createElement('div');
    list.className = 'dialog-list';

    for (const opt of options) {
      const item = document.createElement('div');
      item.className = 'dialog-list-item';
      item.textContent = opt;
      item.addEventListener('click', () => {
        overlay.remove();
        resolve(opt);
      });
      list.appendChild(item);
    }

    dialog.appendChild(list);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'dialog-btn dialog-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.marginTop = '8px';
    cancelBtn.addEventListener('click', () => { overlay.remove(); resolve(null); });
    dialog.appendChild(cancelBtn);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); resolve(null); } });
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') { overlay.remove(); resolve(null); document.removeEventListener('keydown', handler); }
    });
  });
}

/**
 * Show a dialog with custom HTML content and action buttons.
 * @param {string} title
 * @param {string} htmlContent
 * @param {Array<{label: string, primary?: boolean, action: Function}>} buttons
 */
export function showDialog(title, htmlContent, buttons = []) {
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'dialog-box dialog-wide';

  const titleEl = document.createElement('div');
  titleEl.className = 'dialog-title';
  titleEl.textContent = title;

  const body = document.createElement('div');
  body.className = 'dialog-body';
  body.innerHTML = htmlContent;

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;margin-top:12px;justify-content:flex-end;';

  dialog.appendChild(titleEl);
  dialog.appendChild(body);

  function close() { overlay.remove(); }

  for (const btn of buttons) {
    const el = document.createElement('button');
    el.className = btn.primary ? 'dialog-btn dialog-ok' : 'dialog-btn dialog-cancel';
    el.textContent = btn.label;
    el.addEventListener('click', () => {
      btn.action();
      close();
    });
    btnRow.appendChild(el);
  }

  dialog.appendChild(btnRow);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function handler(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
  });
}
