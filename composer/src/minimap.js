let canvas = null;
let ctx = null;
let container = null;
let playlistEl = null;
let viewportDiv = null;
let isDragging = false;
let dragStartX = 0;

const TRACK_COLORS = ['#e94560', '#533483', '#0f3460', '#4caf82', '#fbbc04', '#17a2b8', '#dc3545'];

export function initMinimap(playlistContainer) {
  container = document.getElementById('minimap-container');
  canvas = document.getElementById('minimap-canvas');
  ctx = canvas.getContext('2d');
  playlistEl = playlistContainer;

  viewportDiv = document.createElement('div');
  viewportDiv.className = 'minimap-viewport';
  container.appendChild(viewportDiv);

  const label = document.createElement('div');
  label.className = 'minimap-label';
  label.textContent = 'MINIMAP';
  container.appendChild(label);

  container.addEventListener('mousedown', (e) => {
    if (e.target === viewportDiv) {
      isDragging = true;
      dragStartX = e.clientX - viewportDiv.offsetLeft;
      return;
    }
    const rect = container.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (playlistEl) {
      playlistEl.scrollLeft = ratio * (playlistEl.scrollWidth - playlistEl.clientWidth);
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const rect = container.getBoundingClientRect();
    let newLeft = e.clientX - dragStartX;
    newLeft = Math.max(0, Math.min(newLeft, rect.width - viewportDiv.offsetWidth));
    const ratio = newLeft / (rect.width - viewportDiv.offsetWidth || 1);
    if (playlistEl) {
      playlistEl.scrollLeft = ratio * (playlistEl.scrollWidth - playlistEl.clientWidth);
    }
  });

  document.addEventListener('mouseup', () => { isDragging = false; });

  if (playlistEl) {
    playlistEl.addEventListener('scroll', () => updateViewport());
    new ResizeObserver(() => updateViewport()).observe(playlistEl);
  }

  updateViewport();
}

function updateViewport() {
  if (!playlistEl || !container) return;
  const containerW = container.clientWidth;
  const scrollW = playlistEl.scrollWidth || 1;
  const clientW = playlistEl.clientWidth;
  const vpWidth = Math.max(20, (clientW / scrollW) * containerW);
  const vpLeft = (playlistEl.scrollLeft / (scrollW - clientW || 1)) * (containerW - vpWidth);
  viewportDiv.style.width = vpWidth + 'px';
  viewportDiv.style.left = Math.max(0, vpLeft) + 'px';
}

export function renderMinimap(tracks) {
  if (!canvas || !ctx) return;
  const w = canvas.width = canvas.clientWidth * window.devicePixelRatio;
  const h = canvas.height = canvas.clientHeight * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  const displayW = canvas.clientWidth;
  const displayH = canvas.clientHeight;
  ctx.clearRect(0, 0, displayW, displayH);
  if (!tracks || tracks.length === 0) return;
  const trackH = Math.min(8, (displayH - 4) / tracks.length);
  const gap = 2;
  tracks.forEach((track, i) => {
    const y = 2 + i * (trackH + gap);
    ctx.fillStyle = TRACK_COLORS[i % TRACK_COLORS.length];
    ctx.globalAlpha = 0.5;
    ctx.fillRect(4, y, displayW - 8, trackH);
  });
  ctx.globalAlpha = 1;
}
