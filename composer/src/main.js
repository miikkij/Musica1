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
import { initTimeline, addTrackToTimeline, setTimelineState, zoomIn, zoomOut, onSelect } from './timeline.js';
import { initToolbar } from './toolbar.js';
import { saveProjectUI, loadProjectUI, exportMixUI } from './project.js';
import { initContextMenu, showContextMenu } from './context-menu.js';
import { initMinimap } from './minimap.js';

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
}).catch(err => {
  console.error('Timeline init failed:', err);
});

initToolbar({
  onModeChange: (mode) => setTimelineState(mode),
  onZoomIn: () => zoomIn(),
  onZoomOut: () => zoomOut(),
});

document.getElementById('playlist-container').addEventListener('contextmenu', (e) => {
  e.preventDefault();
  showContextMenu(e.clientX, e.clientY);
});

initContextMenu((action) => {
  console.log('Context menu action:', action);
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
  // Only remove when truly leaving the container (not a child element)
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

  // Add the track at time 0 (can be repositioned in playlist)
  addTrackToTimeline(clipData.filename, 0);

  // Track in project state
  projectState.tracks.push({
    filename: clipData.filename,
    startTime: 0,
    gain: 1,
  });
});
