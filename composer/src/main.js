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

console.log('Composer app loaded');

/** Shared project state — updated as user changes transport controls */
const projectState = {
  bpm: 120,
  keyNote: 'C',
  keyScale: 'minor',
  masterVolume: 1,
  targetLength: null,
  tracks: [],
};

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
  }
});

// ── Key sync ──────────────────────────────────────────────────────────────────
const keyNoteSelect = document.getElementById('select-key-note');
const keyScaleSelect = document.getElementById('select-key-scale');

keyNoteSelect.addEventListener('change', () => {
  projectState.keyNote = keyNoteSelect.value;
});
keyScaleSelect.addEventListener('change', () => {
  projectState.keyScale = keyScaleSelect.value;
});

// ── Master volume sync ────────────────────────────────────────────────────────
const masterVolInput = document.getElementById('input-master-vol');
masterVolInput.addEventListener('input', () => {
  projectState.masterVolume = parseFloat(masterVolInput.value);
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
      break;

    case 'duplicate':
      duplicateActiveTrack();
      break;

    case 'loop2':
    case 'loop4':
    case 'loopfill': {
      if (!track) {
        console.warn('No active track to loop');
        break;
      }
      const name = track.getName ? track.getName() : '';
      const filename = name.endsWith('.wav') ? name : name + '.wav';
      const repeatCount = action === 'loop2' ? 2 : action === 'loop4' ? 4 : 8;

      try {
        const result = await loopClip(filename, repeatCount);
        if (result.output_filename) {
          // Add the looped clip as a new track at the same start position
          const startTime = track.getStartTime();
          removeActiveTrack();
          addTrackToTimeline(result.output_filename, startTime);
        }
      } catch (err) {
        console.error('Loop failed:', err);
        alert('Loop failed: ' + err.message);
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
