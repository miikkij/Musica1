/**
 * Custom Canvas-based DAW timeline engine.
 * Supports multiple clips per track, drag/move, loop-extend, and Web Audio playback.
 */

import { clipUrl } from './api.js';
import { toast, dialogPrompt } from './toast.js';

// ── State ────────────────────────────────────────────────────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const audioBufferCache = new Map(); // filename -> AudioBuffer

let tracks = [];       // Array of { id, name, color, volume, muted, solo, clips[] }
let nextTrackId = 1;
let nextClipId = 1;

// Each clip: { id, trackId, filename, startTime, duration, loopCount, buffer, peaks }

let pixelsPerSecond = 80;
let scrollX = 0;
let playheadTime = 0;
let isPlaying = false;
let playStartWallTime = 0;
let playStartOffset = 0;
let scheduledSources = [];
let animFrameId = null;

let snapToBpm = true;
let projectBpm = 120;
let masterVolume = 1;
let masterGain = null;

// Interaction state
let mode = 'cursor';  // 'cursor' | 'move' | 'select'
let selectedClip = null;
let selectedTrack = null;
let dragState = null;  // { type: 'move'|'resize'|'loop', clip, track, offsetX, originalStart, originalDuration }
let selectRegion = null; // { start, end }
let onSelectCallback = null;
let onChangeCallback = null;

// Layout constants
const TRACK_HEIGHT = 90;
const TRACK_HEADER_WIDTH = 160;
const TRACK_GAP = 2;
const RULER_HEIGHT = 28;
const CLIP_PADDING = 2;
const RESIZE_HANDLE_WIDTH = 8;

const TRACK_COLORS = ['#e94560', '#533483', '#0f3460', '#4caf82', '#fbbc04', '#17a2b8', '#dc3545', '#ff6b35'];

// DOM elements
let container = null;
let canvas = null;
let ctx = null;
let headerCanvas = null;
let headerCtx = null;

// ── Audio Buffer Loading ─────────────────────────────────────────────────────
async function loadAudioBuffer(filename) {
  if (audioBufferCache.has(filename)) return audioBufferCache.get(filename);
  const url = window.location.origin + clipUrl(filename);
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = await audioCtx.decodeAudioData(arrayBuffer);
  audioBufferCache.set(filename, buffer);
  return buffer;
}

function computePeaks(buffer, samplesPerPixel = 512) {
  const channel = buffer.getChannelData(0);
  const numPeaks = Math.ceil(channel.length / samplesPerPixel);
  const peaks = new Float32Array(numPeaks * 2); // min, max pairs
  for (let i = 0; i < numPeaks; i++) {
    let min = 1, max = -1;
    const start = i * samplesPerPixel;
    const end = Math.min(start + samplesPerPixel, channel.length);
    for (let j = start; j < end; j++) {
      const val = channel[j];
      if (val < min) min = val;
      if (val > max) max = val;
    }
    peaks[i * 2] = min;
    peaks[i * 2 + 1] = max;
  }
  return peaks;
}

// ── Snap ─────────────────────────────────────────────────────────────────────
function snap(time) {
  if (!snapToBpm || !projectBpm) return Math.max(0, time);
  const barDur = (4 * 60) / projectBpm;
  return Math.max(0, Math.round(time / barDur) * barDur);
}

// ── Track/Clip Management ────────────────────────────────────────────────────
export function addTrack(name) {
  const track = {
    id: nextTrackId++,
    name: name || `Track ${tracks.length + 1}`,
    color: TRACK_COLORS[(tracks.length) % TRACK_COLORS.length],
    volume: 1,
    muted: false,
    solo: false,
    clips: [],
  };
  tracks.push(track);
  notifyChange();
  draw();
  return track;
}

export async function addClipToTrack(trackId, filename, startTime = 0) {
  const track = tracks.find(t => t.id === trackId);
  if (!track) return null;

  try {
    const buffer = await loadAudioBuffer(filename);
    const peaks = computePeaks(buffer);
    const clip = {
      id: nextClipId++,
      trackId,
      filename,
      startTime: snap(startTime),
      duration: buffer.duration,
      originalDuration: buffer.duration,
      loopCount: 1,
      buffer,
      peaks,
    };
    track.clips.push(clip);
    notifyChange();
    draw();
    return clip;
  } catch (err) {
    toast(`Failed to load ${filename}: ${err.message}`, 'error');
    return null;
  }
}

export function removeClip(clipId) {
  for (const track of tracks) {
    const idx = track.clips.findIndex(c => c.id === clipId);
    if (idx !== -1) {
      track.clips.splice(idx, 1);
      if (selectedClip?.id === clipId) selectedClip = null;
      notifyChange();
      draw();
      return;
    }
  }
}

export function removeTrack(trackId) {
  const idx = tracks.findIndex(t => t.id === trackId);
  if (idx !== -1) {
    tracks.splice(idx, 1);
    if (selectedTrack?.id === trackId) selectedTrack = null;
    notifyChange();
    draw();
  }
}

export function duplicateClip(clipId) {
  for (const track of tracks) {
    const clip = track.clips.find(c => c.id === clipId);
    if (clip) {
      const newClip = {
        ...clip,
        id: nextClipId++,
        startTime: snap(clip.startTime + clip.duration * clip.loopCount),
      };
      track.clips.push(newClip);
      selectedClip = newClip;
      notifyChange();
      draw();
      return newClip;
    }
  }
  return null;
}

export function moveClipToTrack(clipId, newTrackId) {
  let clip = null;
  for (const track of tracks) {
    const idx = track.clips.findIndex(c => c.id === clipId);
    if (idx !== -1) {
      clip = track.clips.splice(idx, 1)[0];
      break;
    }
  }
  if (clip) {
    const newTrack = tracks.find(t => t.id === newTrackId);
    if (newTrack) {
      clip.trackId = newTrackId;
      newTrack.clips.push(clip);
      notifyChange();
      draw();
    }
  }
}

// ── Getters / Setters ────────────────────────────────────────────────────────
export function getTracks() { return tracks; }
export function getSelectedClip() { return selectedClip; }
export function getSelectedTrack() { return selectedTrack; }

export function setMode(m) { mode = m; draw(); }
export function setSnapBpm(enabled) { snapToBpm = enabled; }
export function setProjectBpm(bpm) { projectBpm = bpm; draw(); }
export function setMasterVolume(v) { masterVolume = v; if (masterGain) masterGain.gain.value = v; }
export function getIsPlaying() { return isPlaying; }
export function setOnSelect(cb) { onSelectCallback = cb; }
export function setOnChange(cb) { onChangeCallback = cb; }

export function zoomIn() {
  pixelsPerSecond = Math.min(400, pixelsPerSecond * 1.3);
  draw();
}
export function zoomOut() {
  pixelsPerSecond = Math.max(10, pixelsPerSecond / 1.3);
  draw();
}

// ── Serialization (for autosave/restore) ─────────────────────────────────────
export function getPixelsPerSecond() { return pixelsPerSecond; }
export function setPixelsPerSecond(pps) { pixelsPerSecond = pps; draw(); }

export function getState() {
  return {
    pixelsPerSecond,
    tracks: tracks.map(t => ({
      id: t.id,
      name: t.name,
      color: t.color,
      volume: t.volume,
      muted: t.muted,
      solo: t.solo,
      clips: t.clips.map(c => ({
        filename: c.filename,
        startTime: c.startTime,
        loopCount: c.loopCount,
      })),
    })),
    nextTrackId,
    nextClipId,
  };
}

export async function restoreState(state) {
  if (!state?.tracks) return;
  if (state.pixelsPerSecond) pixelsPerSecond = state.pixelsPerSecond;
  tracks = [];
  nextTrackId = state.nextTrackId || 1;
  nextClipId = state.nextClipId || 1;

  for (const tData of state.tracks) {
    const track = {
      id: tData.id || nextTrackId++,
      name: tData.name,
      color: tData.color || TRACK_COLORS[tracks.length % TRACK_COLORS.length],
      volume: tData.volume ?? 1,
      muted: tData.muted ?? false,
      solo: tData.solo ?? false,
      clips: [],
    };
    tracks.push(track);

    for (const cData of (tData.clips || [])) {
      try {
        const buffer = await loadAudioBuffer(cData.filename);
        const peaks = computePeaks(buffer);
        track.clips.push({
          id: nextClipId++,
          trackId: track.id,
          filename: cData.filename,
          startTime: cData.startTime || 0,
          duration: buffer.duration,
          originalDuration: buffer.duration,
          loopCount: cData.loopCount || 1,
          buffer,
          peaks,
        });
      } catch (e) {
        console.warn(`Failed to restore clip ${cData.filename}:`, e);
      }
    }
  }
  draw();
}

function notifyChange() {
  if (onChangeCallback) onChangeCallback();
}

// ── Playback (Web Audio API) ─────────────────────────────────────────────────
export function play(fromTime) {
  if (isPlaying) stopPlayback();
  audioCtx.resume();

  masterGain = audioCtx.createGain();
  masterGain.gain.value = masterVolume;
  masterGain.connect(audioCtx.destination);

  const anySolo = tracks.some(t => t.solo);
  const startFrom = fromTime ?? playheadTime;

  for (const track of tracks) {
    if (track.muted) continue;
    if (anySolo && !track.solo) continue;

    const trackGain = audioCtx.createGain();
    trackGain.gain.value = track.volume;
    trackGain.connect(masterGain);

    for (const clip of track.clips) {
      const totalDuration = clip.duration * clip.loopCount;
      const clipEnd = clip.startTime + totalDuration;
      if (clipEnd <= startFrom) continue;

      // Schedule enough full/partial loops to fill totalDuration
      const fullLoops = Math.ceil(clip.loopCount);
      for (let loop = 0; loop < fullLoops; loop++) {
        const loopStart = clip.startTime + loop * clip.duration;
        // Don't play past the total clip end
        const loopEnd = Math.min(loopStart + clip.duration, clipEnd);
        const loopDur = loopEnd - loopStart;

        if (loopEnd <= startFrom || loopDur <= 0) continue;

        const source = audioCtx.createBufferSource();
        source.buffer = clip.buffer;
        source.connect(trackGain);

        const offset = Math.max(0, startFrom - loopStart);
        const when = Math.max(0, loopStart - startFrom);

        source.start(audioCtx.currentTime + when, offset, loopDur - offset);
        scheduledSources.push(source);
      }
    }
  }

  isPlaying = true;
  playStartWallTime = audioCtx.currentTime;
  playStartOffset = startFrom;
  animFrameId = requestAnimationFrame(updatePlayhead);
}

function updatePlayhead() {
  if (!isPlaying) return;
  playheadTime = playStartOffset + (audioCtx.currentTime - playStartWallTime);
  draw();
  animFrameId = requestAnimationFrame(updatePlayhead);
}

export function stopPlayback() {
  isPlaying = false;
  if (animFrameId) cancelAnimationFrame(animFrameId);
  for (const src of scheduledSources) {
    try { src.stop(); } catch {}
  }
  scheduledSources = [];
  if (masterGain) { masterGain.disconnect(); masterGain = null; }
  draw();
}

export function seek(time) {
  playheadTime = Math.max(0, time);
  if (isPlaying) {
    stopPlayback();
    play(playheadTime);
  } else {
    draw();
  }
}

// ── Drawing ──────────────────────────────────────────────────────────────────
function timeToX(time) {
  return TRACK_HEADER_WIDTH + (time * pixelsPerSecond) - scrollX;
}

function xToTime(x) {
  return ((x - TRACK_HEADER_WIDTH) + scrollX) / pixelsPerSecond;
}

function trackAtY(y) {
  const ty = y - RULER_HEIGHT;
  if (ty < 0) return { track: null, index: -1 };
  const idx = Math.floor(ty / (TRACK_HEIGHT + TRACK_GAP));
  if (idx < 0 || idx >= tracks.length) return { track: null, index: idx };
  return { track: tracks[idx], index: idx };
}

function clipAtPos(x, y) {
  const { track } = trackAtY(y);
  if (!track) return null;
  const time = xToTime(x);
  for (const clip of track.clips) {
    const totalDur = clip.duration * clip.loopCount;
    if (time >= clip.startTime && time <= clip.startTime + totalDur) {
      return clip;
    }
  }
  return null;
}

function draw() {
  if (!canvas || !ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const dpr = window.devicePixelRatio || 1;
  const displayW = w / dpr;
  const displayH = h / dpr;

  ctx.clearRect(0, 0, displayW, displayH);

  // Ruler
  drawRuler(displayW);

  // Tracks
  for (let i = 0; i < tracks.length; i++) {
    drawTrack(tracks[i], i, displayW);
  }

  // "Add Track" drop zone
  const addTrackY = RULER_HEIGHT + tracks.length * (TRACK_HEIGHT + TRACK_GAP);
  ctx.fillStyle = '#111';
  ctx.globalAlpha = 0.3;
  ctx.fillRect(TRACK_HEADER_WIDTH, addTrackY, displayW - TRACK_HEADER_WIDTH, TRACK_HEIGHT);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#555';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Drop clip here to add new track', displayW / 2 + TRACK_HEADER_WIDTH / 2, addTrackY + TRACK_HEIGHT / 2 + 4);

  // Select region
  if (selectRegion && selectRegion.end > selectRegion.start) {
    const x1 = timeToX(selectRegion.start);
    const x2 = timeToX(selectRegion.end);
    ctx.fillStyle = 'rgba(76, 175, 130, 0.15)';
    ctx.fillRect(x1, RULER_HEIGHT, x2 - x1, displayH - RULER_HEIGHT);
    ctx.strokeStyle = '#4caf82';
    ctx.lineWidth = 1;
    ctx.strokeRect(x1, RULER_HEIGHT, x2 - x1, displayH - RULER_HEIGHT);
  }

  // Playhead
  const phX = timeToX(playheadTime);
  if (phX >= TRACK_HEADER_WIDTH && phX <= displayW) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(phX, 0);
    ctx.lineTo(phX, displayH);
    ctx.stroke();
    // Triangle
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(phX - 5, 0);
    ctx.lineTo(phX + 5, 0);
    ctx.lineTo(phX, 8);
    ctx.fill();
  }
}

function drawRuler(displayW) {
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, displayW, RULER_HEIGHT);

  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, RULER_HEIGHT);
  ctx.lineTo(displayW, RULER_HEIGHT);
  ctx.stroke();

  ctx.fillStyle = '#888';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';

  // Draw time markers
  const secPerTick = pixelsPerSecond > 100 ? 1 : pixelsPerSecond > 40 ? 2 : 5;
  const startTime = Math.floor(xToTime(TRACK_HEADER_WIDTH) / secPerTick) * secPerTick;
  const endTime = xToTime(displayW);

  for (let t = Math.max(0, startTime); t <= endTime; t += secPerTick) {
    const x = timeToX(t);
    if (x < TRACK_HEADER_WIDTH) continue;
    ctx.beginPath();
    ctx.moveTo(x, RULER_HEIGHT - 8);
    ctx.lineTo(x, RULER_HEIGHT);
    ctx.stroke();

    const min = Math.floor(t / 60);
    const sec = Math.floor(t % 60);
    ctx.fillText(`${min}:${String(sec).padStart(2, '0')}`, x, RULER_HEIGHT - 12);
  }

  // BPM bar markers
  if (projectBpm) {
    const barDur = (4 * 60) / projectBpm;
    const startBar = Math.floor(xToTime(TRACK_HEADER_WIDTH) / barDur);
    const endBar = Math.ceil(endTime / barDur);
    ctx.strokeStyle = '#444';
    for (let b = Math.max(0, startBar); b <= endBar; b++) {
      const x = timeToX(b * barDur);
      if (x < TRACK_HEADER_WIDTH) continue;
      ctx.beginPath();
      ctx.moveTo(x, RULER_HEIGHT);
      ctx.lineTo(x, RULER_HEIGHT + tracks.length * (TRACK_HEIGHT + TRACK_GAP));
      ctx.stroke();
    }
  }
}

function drawTrack(track, index, displayW) {
  const y = RULER_HEIGHT + index * (TRACK_HEIGHT + TRACK_GAP);

  // Track header background
  ctx.fillStyle = track === selectedTrack ? '#1e2a4a' : '#111828';
  ctx.fillRect(0, y, TRACK_HEADER_WIDTH, TRACK_HEIGHT);

  // Track color bar
  ctx.fillStyle = track.color;
  ctx.fillRect(0, y, 4, TRACK_HEIGHT);

  // Track name
  ctx.fillStyle = track.muted ? '#555' : '#ccc';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  const displayName = track.name.length > 16 ? track.name.slice(0, 14) + '...' : track.name;
  ctx.fillText(displayName, 10, y + 16);

  // Mute/Solo indicators
  ctx.font = '9px sans-serif';
  ctx.fillStyle = track.muted ? '#e94560' : '#555';
  ctx.fillText('M', 10, y + 32);
  ctx.fillStyle = track.solo ? '#4caf82' : '#555';
  ctx.fillText('S', 24, y + 32);

  // Volume bar
  ctx.fillStyle = '#333';
  ctx.fillRect(10, y + 38, TRACK_HEADER_WIDTH - 20, 4);
  ctx.fillStyle = track.color;
  ctx.fillRect(10, y + 38, (TRACK_HEADER_WIDTH - 20) * track.volume, 4);

  // Track body background
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(TRACK_HEADER_WIDTH, y, displayW - TRACK_HEADER_WIDTH, TRACK_HEIGHT);

  // Draw clips
  for (const clip of track.clips) {
    drawClip(clip, track, y);
  }

  // Track bottom border
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y + TRACK_HEIGHT);
  ctx.lineTo(displayW, y + TRACK_HEIGHT);
  ctx.stroke();
}

function drawClip(clip, track, trackY) {
  const totalDur = clip.duration * clip.loopCount;
  const x1 = timeToX(clip.startTime);
  const x2 = timeToX(clip.startTime + totalDur);
  const clipW = x2 - x1;
  if (clipW < 1) return;

  const isSelected = selectedClip?.id === clip.id;
  const clipY = trackY + CLIP_PADDING;
  const clipH = TRACK_HEIGHT - CLIP_PADDING * 2;

  // Clip background
  ctx.fillStyle = isSelected ? '#1e3a5f' : '#141e30';
  ctx.fillRect(x1, clipY, clipW, clipH);

  // Clip border
  ctx.strokeStyle = isSelected ? '#4dabf7' : track.color;
  ctx.lineWidth = isSelected ? 2 : 1;
  ctx.strokeRect(x1, clipY, clipW, clipH);

  // Draw waveform for each loop iteration
  if (clip.peaks) {
    const oneDurPx = clip.duration * pixelsPerSecond;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x1, clipY, clipW, clipH);
    ctx.clip();

    const loopIterations = Math.ceil(clip.loopCount);
    for (let loop = 0; loop < loopIterations; loop++) {
      const loopX = x1 + loop * oneDurPx;

      // Loop divider line (after first)
      if (loop > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(loopX, clipY);
        ctx.lineTo(loopX, clipY + clipH);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw waveform
      const peaksPerPixel = clip.peaks.length / 2 / oneDurPx;
      ctx.fillStyle = track.color;
      ctx.globalAlpha = loop === 0 ? 0.8 : 0.5;
      const mid = clipY + clipH / 2;
      const halfH = clipH / 2 - 4;

      for (let px = 0; px < oneDurPx && (loopX + px) < x2; px++) {
        const peakIdx = Math.floor(px * peaksPerPixel);
        if (peakIdx * 2 + 1 >= clip.peaks.length) break;
        const min = clip.peaks[peakIdx * 2];
        const max = clip.peaks[peakIdx * 2 + 1];
        const drawX = loopX + px;
        ctx.fillRect(drawX, mid + min * halfH, 1, (max - min) * halfH);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Right edge resize/loop handle
  ctx.fillStyle = isSelected ? '#4dabf7' : 'rgba(255,255,255,0.3)';
  ctx.fillRect(x2 - RESIZE_HANDLE_WIDTH, clipY, RESIZE_HANDLE_WIDTH, clipH);

  // Clip name
  if (clipW > 40) {
    ctx.fillStyle = '#ddd';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    const name = clip.filename.replace('.wav', '');
    const maxChars = Math.floor((clipW - 10) / 6);
    const displayName = name.length > maxChars ? name.slice(0, maxChars - 2) + '..' : name;
    ctx.fillText(displayName, x1 + 4, clipY + 12);
  }
}

// ── Mouse Interaction ────────────────────────────────────────────────────────
function setupInteraction() {
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('dblclick', onDblClick);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', onWheel, { passive: false });

  // Drag & drop from sidebar
  canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  canvas.addEventListener('drop', onDrop);
}

function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  return {
    x: (e.clientX - rect.left),
    y: (e.clientY - rect.top),
  };
}

function onMouseDown(e) {
  const pos = getCanvasPos(e);

  // Track header clicks (mute/solo/volume)
  if (pos.x < TRACK_HEADER_WIDTH) {
    const { track } = trackAtY(pos.y);
    if (track) {
      const relY = (pos.y - RULER_HEIGHT) % (TRACK_HEIGHT + TRACK_GAP);
      if (relY >= 24 && relY <= 36 && pos.x >= 10 && pos.x < 20) {
        track.muted = !track.muted;
        notifyChange();
        draw();
      } else if (relY >= 24 && relY <= 36 && pos.x >= 24 && pos.x < 40) {
        track.solo = !track.solo;
        notifyChange();
        draw();
      } else if (relY >= 36 && relY <= 44) {
        // Volume
        track.volume = Math.max(0, Math.min(1, (pos.x - 10) / (TRACK_HEADER_WIDTH - 20)));
        notifyChange();
        draw();
      }
      selectedTrack = track;
    }
    return;
  }

  // Ruler click = seek
  if (pos.y < RULER_HEIGHT) {
    const time = xToTime(pos.x);
    seek(time);
    if (mode === 'select') {
      selectRegion = { start: time, end: time };
    }
    return;
  }

  const clip = clipAtPos(pos.x, pos.y);
  const { track } = trackAtY(pos.y);

  if (mode === 'cursor') {
    const time = xToTime(pos.x);
    seek(time);
    selectedClip = clip;
    selectedTrack = track;
    draw();
  } else if (mode === 'move') {
    if (clip) {
      selectedClip = clip;
      selectedTrack = track;

      // Check if clicking on resize handle (right edge)
      const clipEndX = timeToX(clip.startTime + clip.duration * clip.loopCount);
      if (pos.x >= clipEndX - RESIZE_HANDLE_WIDTH && pos.x <= clipEndX) {
        dragState = {
          type: 'loop',
          clip,
          track,
          originalLoopCount: clip.loopCount,
          startX: pos.x,
        };
      } else {
        dragState = {
          type: 'move',
          clip,
          track,
          offsetX: pos.x - timeToX(clip.startTime),
          originalStart: clip.startTime,
          originalTrack: track,
        };
      }
      draw();
    } else {
      selectedClip = null;
      selectedTrack = track;
      draw();
    }
  } else if (mode === 'select') {
    const time = xToTime(pos.x);
    selectRegion = { start: time, end: time };
    selectedClip = clip;
    selectedTrack = track;
    draw();
  }
}

function onMouseMove(e) {
  const pos = getCanvasPos(e);

  if (dragState) {
    if (dragState.type === 'move') {
      const newTime = xToTime(pos.x - dragState.offsetX);
      dragState.clip.startTime = snap(newTime);

      // Check if dragged to different track
      const { track: hoverTrack } = trackAtY(pos.y);
      if (hoverTrack && hoverTrack.id !== dragState.clip.trackId) {
        moveClipToTrack(dragState.clip.id, hoverTrack.id);
        dragState.track = hoverTrack;
      }

      draw();
    } else if (dragState.type === 'loop') {
      const deltaX = pos.x - dragState.startX;
      const deltaSec = deltaX / pixelsPerSecond;
      const originalTotalDur = dragState.clip.duration * dragState.originalLoopCount;
      // Minimum 0.5s, no maximum — audio loops to fill
      const newTotalDur = Math.max(0.5, originalTotalDur + deltaSec);
      dragState.clip.loopCount = newTotalDur / dragState.clip.duration;
      draw();
    }
  } else if (selectRegion && mode === 'select') {
    selectRegion.end = xToTime(pos.x);
    draw();
  }

  // Cursor style
  if (mode === 'move' && !dragState) {
    const clip = clipAtPos(pos.x, pos.y);
    if (clip) {
      const clipEndX = timeToX(clip.startTime + clip.duration * clip.loopCount);
      if (pos.x >= clipEndX - RESIZE_HANDLE_WIDTH && pos.x <= clipEndX) {
        canvas.style.cursor = 'ew-resize';
      } else {
        canvas.style.cursor = 'grab';
      }
    } else {
      canvas.style.cursor = 'default';
    }
  }
}

function onMouseUp(e) {
  if (dragState) {
    notifyChange();
    dragState = null;
    draw();
  }
  if (selectRegion && mode === 'select') {
    if (selectRegion.end < selectRegion.start) {
      [selectRegion.start, selectRegion.end] = [selectRegion.end, selectRegion.start];
    }
    if (onSelectCallback && selectRegion.end > selectRegion.start) {
      onSelectCallback(selectRegion.start, selectRegion.end);
    }
  }
}

function onDblClick(e) {
  const pos = getCanvasPos(e);
  // Double-click track header to rename
  if (pos.x < TRACK_HEADER_WIDTH) {
    const { track } = trackAtY(pos.y);
    if (track) {
      dialogPrompt('Track name:', track.name).then(name => {
        if (name) { track.name = name; notifyChange(); draw(); }
      });
    }
  }
}

function onWheel(e) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  } else {
    scrollX = Math.max(0, scrollX + e.deltaX + e.deltaY);
    draw();
  }
}

async function onDrop(e) {
  e.preventDefault();
  let clipData;
  try {
    clipData = JSON.parse(e.dataTransfer.getData('application/json'));
  } catch { return; }
  if (!clipData?.filename) return;

  const pos = getCanvasPos(e);
  const dropTime = Math.max(0, xToTime(pos.x));
  const { track, index } = trackAtY(pos.y);

  if (track) {
    // Drop on existing track
    await addClipToTrack(track.id, clipData.filename, dropTime);
    toast(`Added to ${track.name}`, 'success', 2000);
  } else if (index >= tracks.length) {
    // Drop below all tracks = new track
    const newTrack = addTrack(clipData.filename.replace('.wav', '').slice(0, 20));
    await addClipToTrack(newTrack.id, clipData.filename, dropTime);
    toast(`New track: ${newTrack.name}`, 'success', 2000);
  }
}

// ── Init ─────────────────────────────────────────────────────────────────────
export function initEngine(containerEl) {
  container = containerEl;

  // Create canvas
  canvas = document.createElement('canvas');
  canvas.id = 'timeline-canvas';
  container.innerHTML = '';
  container.appendChild(canvas);

  ctx = canvas.getContext('2d');

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = Math.max(400, rect.height) * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = Math.max(400, rect.height) + 'px';
    ctx.scale(dpr, dpr);
    draw();
  }

  new ResizeObserver(resize).observe(container);
  resize();

  setupInteraction();
}
