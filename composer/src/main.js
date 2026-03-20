import './style.css';
import { refreshClipLibrary, initGeneratePanel } from './sidebar.js';
import {
  initTransport,
  setBpm,
  setLoop,
  play,
  stop,
} from './transport.js';
import { initTimeline, addTrackToTimeline } from './timeline.js';
import { saveProjectUI, loadProjectUI, exportMixUI } from './project.js';

console.log('Composer app loaded');

/** Shared project state — updated as user changes transport controls */
const projectState = {
  bpm: 120,
  keyNote: 'C',
  keyScale: 'minor',
  masterVolume: 1,
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
initTimeline(projectState);

// ── Drop zone: drag clips from sidebar onto timeline ──────────────────────────
const timelineContainer = document.getElementById('timeline-container');

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
