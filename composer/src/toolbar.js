let currentMode = 'cursor';
let onModeChangeCallback = null;
let onZoomInCallback = null;
let onZoomOutCallback = null;

const MODE_BUTTONS = ['btn-mode-cursor', 'btn-mode-move', 'btn-mode-select'];

export function initToolbar({ onModeChange, onZoomIn, onZoomOut }) {
  onModeChangeCallback = onModeChange;
  onZoomInCallback = onZoomIn;
  onZoomOutCallback = onZoomOut;

  MODE_BUTTONS.forEach(id => {
    const btn = document.getElementById(id);
    btn.addEventListener('click', () => {
      setMode(btn.dataset.mode);
    });
  });

  document.getElementById('btn-zoom-in').addEventListener('click', () => {
    if (onZoomInCallback) onZoomInCallback();
  });
  document.getElementById('btn-zoom-out').addEventListener('click', () => {
    if (onZoomOutCallback) onZoomOutCallback();
  });
}

export function setMode(mode) {
  currentMode = mode;
  MODE_BUTTONS.forEach(id => {
    const btn = document.getElementById(id);
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  if (onModeChangeCallback) onModeChangeCallback(mode);
}

export function getMode() {
  return currentMode;
}
