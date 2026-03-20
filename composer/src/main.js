import './style.css';
import { refreshClipLibrary, initGeneratePanel } from './sidebar.js';

console.log('Composer app loaded');

/** Shared project state — updated as user changes transport controls */
const projectState = {
  bpm: 120,
  keyNote: 'C',
  keyScale: 'minor',
  masterVolume: 1,
  tracks: [],
};

// ── BPM sync ──────────────────────────────────────────────────────────────────
const bpmInput = document.getElementById('input-bpm');
bpmInput.addEventListener('input', () => {
  const val = parseInt(bpmInput.value, 10);
  if (!isNaN(val) && val >= 40 && val <= 300) {
    projectState.bpm = val;
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

// ── Sidebar ───────────────────────────────────────────────────────────────────
initGeneratePanel(projectState);

document.getElementById('btn-refresh-clips').addEventListener('click', () => {
  refreshClipLibrary();
});

// Initial clip load
refreshClipLibrary();
