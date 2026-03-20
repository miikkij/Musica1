import 'waveform-playlist/styles/playlist.css';
import './style.css';
import { refreshClipLibrary, initGeneratePanel } from './sidebar.js';
import {
  initTransport,
  setBpm,
  setLoop,
  setLoopRegion,
  play,
  stop,
} from './transport.js';
import {
  initTimeline,
  addTrackToTimeline,
  setTimelineState,
  zoomIn,
  zoomOut,
  onSelect,
  getActiveTrack,
  getTrackFilename,
  removeActiveTrack,
  duplicateActiveTrack,
  getTracksInfo,
  setSnapBpm,
  setProjectBpm,
} from './timeline.js';
import { initToolbar } from './toolbar.js';
import { saveProjectUI, loadProjectUI, exportMixUI } from './project.js';
import { initContextMenu, showContextMenu } from './context-menu.js';
import { initMinimap, renderMinimap } from './minimap.js';
import { loopClip } from './api.js';
import { toast } from './toast.js';

console.log('Composer app loaded');

const STORAGE_KEY = 'composer_autosave';

/** Load saved state from localStorage, or use defaults */
function loadSavedState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Failed to load saved state:', e);
  }
  return null;
}

const saved = loadSavedState();

/** Shared project state — updated as user changes transport controls */
const projectState = {
  bpm: saved?.bpm ?? 120,
  keyNote: saved?.keyNote ?? 'C',
  keyScale: saved?.keyScale ?? 'minor',
  masterVolume: saved?.masterVolume ?? 1,
  targetLength: saved?.targetLength ?? null,
  tracks: saved?.tracks ?? [],
};

/** Auto-save project state + track info to localStorage */
function autoSave() {
  try {
    const tracksInfo = getTracksInfo();
    const state = {
      ...projectState,
      tracksInfo, // waveform-playlist track positions/names for reload
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // localStorage full or unavailable — ignore silently
  }
}

// Auto-save every 3 seconds
setInterval(autoSave, 3000);

// ── Restore UI from saved state ───────────────────────────────────────────────
document.getElementById('input-bpm').value = projectState.bpm;
document.getElementById('select-key-note').value = projectState.keyNote;
document.getElementById('select-key-scale').value = projectState.keyScale;
document.getElementById('input-master-vol').value = projectState.masterVolume;
document.getElementById('input-length').value = projectState.targetLength
  ? `${Math.floor(projectState.targetLength / 60)}:${String(projectState.targetLength % 60).padStart(2, '0')}`
  : 'auto';

// ── Transport init ────────────────────────────────────────────────────────────
initTransport(projectState.bpm);

// ── BPM sync ──────────────────────────────────────────────────────────────────
const bpmInput = document.getElementById('input-bpm');
bpmInput.addEventListener('input', () => {
  const val = parseInt(bpmInput.value, 10);
  if (!isNaN(val) && val >= 40 && val <= 300) {
    projectState.bpm = val;
    setBpm(val);
    setProjectBpm(val);
    autoSave();
  }
});

// ── Key sync ──────────────────────────────────────────────────────────────────
const keyNoteSelect = document.getElementById('select-key-note');
const keyScaleSelect = document.getElementById('select-key-scale');

keyNoteSelect.addEventListener('change', () => {
  projectState.keyNote = keyNoteSelect.value;
  autoSave();
});
keyScaleSelect.addEventListener('change', () => {
  projectState.keyScale = keyScaleSelect.value;
  autoSave();
});

// ── Master volume sync ────────────────────────────────────────────────────────
const masterVolInput = document.getElementById('input-master-vol');
masterVolInput.addEventListener('input', () => {
  projectState.masterVolume = parseFloat(masterVolInput.value);
  autoSave();
});

// ── Song length sync ─────────────────────────────────────────────────────────
const lengthInput = document.getElementById('input-length');
lengthInput.addEventListener('change', () => {
  const val = lengthInput.value.trim();
  if (val === '' || val.toLowerCase() === 'auto') {
    projectState.targetLength = null;
    lengthInput.value = 'auto';
    return;
  }
  const parts = val.split(':');
  let seconds = 0;
  if (parts.length === 2) {
    seconds = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  } else {
    seconds = parseInt(parts[0], 10);
  }
  if (!isNaN(seconds) && seconds > 0) {
    projectState.targetLength = seconds;
  }
});

// ── BPM snap toggle ──────────────────────────────────────────────────────────
const snapCheckbox = document.getElementById('chk-snap');
snapCheckbox.addEventListener('change', () => {
  setSnapBpm(snapCheckbox.checked);
});

// ── Play / Stop / Loop buttons ────────────────────────────────────────────────
document.getElementById('btn-play').addEventListener('click', () => play());
document.getElementById('btn-stop').addEventListener('click', () => stop());

const loopCheckbox = document.getElementById('chk-loop');
loopCheckbox.addEventListener('change', () => {
  setLoop(loopCheckbox.checked);
});

// ── Sidebar ───────────────────────────────────────────────────────────────────
initGeneratePanel(projectState);

document.getElementById('btn-refresh-clips').addEventListener('click', () => {
  refreshClipLibrary();
});

// Initial clip load
refreshClipLibrary();

// ── Project save / load / export ──────────────────────────────────────────────
document.getElementById('btn-save').addEventListener('click', () => saveProjectUI(projectState));
document.getElementById('btn-load').addEventListener('click', () => loadProjectUI(projectState));
document.getElementById('btn-export').addEventListener('click', () => exportMixUI(projectState));

// ── Timeline init ─────────────────────────────────────────────────────────────
initTimeline(projectState).then(() => {
  console.log('Timeline ready');
  initMinimap(document.getElementById('playlist-container'));

  onSelect((start, end) => {
    setLoopRegion(start, end);
  });

  // Restore tracks from saved state
  if (saved?.tracksInfo && saved.tracksInfo.length > 0) {
    console.log(`Restoring ${saved.tracksInfo.length} tracks from autosave`);
    // Reload each saved track by finding its WAV in the clip library
    for (const track of saved.tracksInfo) {
      // Track name was stored without .wav extension
      const filename = track.name.endsWith('.wav') ? track.name : track.name + '.wav';
      addTrackToTimeline(filename, track.start || 0);
    }
  }

  // Periodically update minimap with track info
  setInterval(() => {
    const tracks = getTracksInfo();
    if (tracks.length > 0) renderMinimap(tracks);
  }, 2000);
}).catch(err => {
  console.error('Timeline init failed:', err);
});

initToolbar({
  onModeChange: (mode) => setTimelineState(mode),
  onZoomIn: () => zoomIn(),
  onZoomOut: () => zoomOut(),
});

// ── Context menu with real actions ───────────────────────────────────────────
document.getElementById('playlist-container').addEventListener('contextmenu', (e) => {
  e.preventDefault();
  showContextMenu(e.clientX, e.clientY);
});

initContextMenu(async (action) => {
  const track = getActiveTrack();

  switch (action) {
    case 'delete':
      removeActiveTrack();
      autoSave();
      break;

    case 'duplicate':
      duplicateActiveTrack();
      autoSave();
      break;

    case 'loop2':
    case 'loop4':
    case 'loopfill': {
      if (!track) {
        toast('No active track to loop — click a track first', 'warning');
        break;
      }
      const filename = getTrackFilename(track);
      if (!filename) {
        toast('Cannot determine clip filename', 'error');
        break;
      }
      const repeatCount = action === 'loop2' ? 2 : action === 'loop4' ? 4 : 8;

      try {
        toast(`Looping ${filename} x${repeatCount}...`, 'info', 2000);
        const result = await loopClip(filename, repeatCount);
        if (result.output_filename) {
          const startTime = track.getStartTime();
          removeActiveTrack();
          addTrackToTimeline(result.output_filename, startTime);
          toast(`Loop created: ${result.output_filename}`, 'success');
        }
      } catch (err) {
        console.error('Loop failed:', err);
        toast('Loop failed: ' + err.message, 'error');
      }
      break;
    }
  }
});

// ── Delete key removes active track ──────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    // Don't delete if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    removeActiveTrack();
  }
});

// ── Drop zone: drag clips from sidebar onto timeline ──────────────────────────
const timelineContainer = document.getElementById('timeline-container');

timelineContainer.addEventListener('wheel', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  }
}, { passive: false });

timelineContainer.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  timelineContainer.classList.add('drag-over');
});

timelineContainer.addEventListener('dragleave', (e) => {
  if (!timelineContainer.contains(e.relatedTarget)) {
    timelineContainer.classList.remove('drag-over');
  }
});

timelineContainer.addEventListener('drop', (e) => {
  e.preventDefault();
  timelineContainer.classList.remove('drag-over');

  let clipData;
  try {
    clipData = JSON.parse(e.dataTransfer.getData('application/json'));
  } catch {
    return;
  }

  if (!clipData || !clipData.filename) return;

  // Calculate drop position in seconds based on X position in the playlist
  const playlistEl = document.getElementById('playlist-container');
  const rect = playlistEl.getBoundingClientRect();
  const xInPlaylist = e.clientX - rect.left + playlistEl.scrollLeft;

  // Estimate time from pixel position (samplesPerPixel * pixels / sampleRate)
  // This is approximate — waveform-playlist uses 1000 samples/pixel at 44100 Hz
  const pixelsToSeconds = 1000 / 44100;
  const dropTime = Math.max(0, xInPlaylist * pixelsToSeconds);

  addTrackToTimeline(clipData.filename, dropTime);

  projectState.tracks.push({
    filename: clipData.filename,
    startTime: dropTime,
    gain: 1,
  });
});
