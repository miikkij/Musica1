/**
 * Minimap — overview of all tracks/clips with draggable viewport.
 * Syncs with the Canvas engine's scroll position and zoom level.
 */
import {
  getTracks,
  getTotalDuration,
  getScrollX,
  setScrollX,
  getPixelsPerSecond,
  getCanvasWidth,
  getTrackHeaderWidth,
  seek,
  getIsPlaying,
} from './engine.js';

let canvas = null;
let ctx = null;
let container = null;
let isDragging = false;
let dragStartX = 0;
let dragStartScrollX = 0;
let rafId = null;

const TRACK_COLORS = ['#e94560', '#533483', '#0f3460', '#4caf82', '#fbbc04', '#17a2b8', '#dc3545', '#ff6b35'];

export function initMinimap(playlistContainer) {
  container = document.getElementById('minimap-container');
  canvas = document.getElementById('minimap-canvas');
  ctx = canvas.getContext('2d');

  container.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  // Start render loop
  function tick() {
    renderMinimap();
    rafId = requestAnimationFrame(tick);
  }
  tick();
}

function getViewport() {
  const totalDur = getTotalDuration();
  const pps = getPixelsPerSecond();
  const canvasW = getCanvasWidth();
  const headerW = getTrackHeaderWidth();
  const scrollX = getScrollX();

  const visibleWidth = canvasW - headerW;
  const visibleDuration = visibleWidth / pps;
  const scrollTime = scrollX / pps;

  return { totalDur, scrollTime, visibleDuration };
}

function onMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const w = rect.width;

  const { totalDur, scrollTime, visibleDuration } = getViewport();

  // Viewport position on minimap
  const vpLeft = (scrollTime / totalDur) * w;
  const vpWidth = Math.max(10, (visibleDuration / totalDur) * w);

  // Check if clicking on viewport handle
  if (x >= vpLeft && x <= vpLeft + vpWidth) {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartScrollX = getScrollX();
  } else {
    // Click = jump to position
    const ratio = x / w;
    const newScrollTime = ratio * totalDur - getViewport().visibleDuration / 2;
    setScrollX(Math.max(0, newScrollTime * getPixelsPerSecond()));
  }
}

function onMouseMove(e) {
  if (!isDragging) return;
  const rect = canvas.getBoundingClientRect();
  const deltaX = e.clientX - dragStartX;
  const { totalDur } = getViewport();
  const deltaTime = (deltaX / rect.width) * totalDur;
  setScrollX(Math.max(0, dragStartScrollX + deltaTime * getPixelsPerSecond()));
}

function onMouseUp() {
  isDragging = false;
}

export function renderMinimap() {
  if (!canvas || !ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const displayW = canvas.clientWidth;
  const displayH = canvas.clientHeight;

  if (canvas.width !== displayW * dpr || canvas.height !== displayH * dpr) {
    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  ctx.clearRect(0, 0, displayW, displayH);

  const tracks = getTracks();
  const { totalDur, scrollTime, visibleDuration } = getViewport();

  if (totalDur <= 0) return;

  // Background
  ctx.fillStyle = '#0a0a18';
  ctx.fillRect(0, 0, displayW, displayH);

  // Draw clips
  const trackCount = tracks.length || 1;
  const trackH = Math.min(8, (displayH - 4) / trackCount);
  const gap = 1;

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const y = 2 + i * (trackH + gap);
    const color = track.color || TRACK_COLORS[i % TRACK_COLORS.length];

    for (const clip of track.clips) {
      const clipEnd = clip.startTime + clip.duration * clip.loopCount;
      const x1 = (clip.startTime / totalDur) * displayW;
      const x2 = (clipEnd / totalDur) * displayW;

      ctx.fillStyle = color;
      ctx.globalAlpha = track.muted ? 0.2 : 0.7;
      ctx.fillRect(x1, y, Math.max(2, x2 - x1), trackH);
    }
  }
  ctx.globalAlpha = 1;

  // Viewport rectangle
  const vpLeft = (scrollTime / totalDur) * displayW;
  const vpWidth = Math.max(10, (visibleDuration / totalDur) * displayW);

  ctx.strokeStyle = '#4dabf7';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(vpLeft, 0, vpWidth, displayH);
  ctx.fillStyle = 'rgba(77, 171, 247, 0.08)';
  ctx.fillRect(vpLeft, 0, vpWidth, displayH);

  // Playhead on minimap
  // (imported getIsPlaying but we can get playheadTime indirectly via engine)
  // For simplicity, skip playhead on minimap for now

  // Label
  ctx.fillStyle = '#444';
  ctx.font = '8px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('MINIMAP', displayW - 4, displayH - 2);
}
