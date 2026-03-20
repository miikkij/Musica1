import './style.css';
import { refreshClipLibrary, initGeneratePanel } from './sidebar.js';
import { initToolbar, setMode as setToolbarMode } from './toolbar.js';
import { saveProjectUI, loadProjectUI, exportMixUI } from './project.js';
import { initContextMenu, showContextMenu } from './context-menu.js';
import { initMinimap, renderMinimap } from './minimap.js';
import { toast } from './toast.js';
import {
  initEngine,
  addTrack,
  addClipToTrack,
  removeClip,
  removeTrack,
  duplicateClip,
  getTracks,
  getSelectedClip,
  getSelectedTrack,
  getIsPlaying,
  setMode,
  setSnapBpm,
  setProjectBpm,
  setMasterVolume,
  setOnSelect,
  setOnChange,
  zoomIn,
  zoomOut,
  play,
  stopPlayback,
  seek,
  getState,
  restoreState,
} from './engine.js';

console.log('Composer app loaded');

const STORAGE_KEY = 'composer_autosave';

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

const projectState = {
  bpm: saved?.bpm ?? 120,
  keyNote: saved?.keyNote ?? 'C',
  keyScale: saved?.keyScale ?? 'minor',
  masterVolume: saved?.masterVolume ?? 1,
  targetLength: saved?.targetLength ?? null,
};

function autoSave() {
  try {
    const engineState = getState();
    const state = {
      ...projectState,
      engine: engineState,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Autosave failed:', e);
  }
}

setInterval(autoSave, 3000);
window.addEventListener('beforeunload', autoSave);

// ── Restore UI from saved state ───────────────────────────────────────────────
document.getElementById('input-bpm').value = projectState.bpm;
document.getElementById('select-key-note').value = projectState.keyNote;
document.getElementById('select-key-scale').value = projectState.keyScale;
document.getElementById('input-master-vol').value = projectState.masterVolume;
document.getElementById('input-length').value = projectState.targetLength
  ? `${Math.floor(projectState.targetLength / 60)}:${String(projectState.targetLength % 60).padStart(2, '0')}`
  : 'auto';

// ── BPM sync ──────────────────────────────────────────────────────────────────
const bpmInput = document.getElementById('input-bpm');
bpmInput.addEventListener('input', () => {
  const val = parseInt(bpmInput.value, 10);
  if (!isNaN(val) && val >= 40 && val <= 300) {
    projectState.bpm = val;
    setProjectBpm(val);
    autoSave();
  }
});

// ── Key sync ──────────────────────────────────────────────────────────────────
document.getElementById('select-key-note').addEventListener('change', (e) => {
  projectState.keyNote = e.target.value;
  autoSave();
});
document.getElementById('select-key-scale').addEventListener('change', (e) => {
  projectState.keyScale = e.target.value;
  autoSave();
});

// ── Master volume sync ────────────────────────────────────────────────────────
document.getElementById('input-master-vol').addEventListener('input', (e) => {
  projectState.masterVolume = parseFloat(e.target.value);
  setMasterVolume(projectState.masterVolume);
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
document.getElementById('chk-snap').addEventListener('change', (e) => {
  setSnapBpm(e.target.checked);
});

// ── Play / Stop / Loop ───────────────────────────────────────────────────────
document.getElementById('btn-play').addEventListener('click', () => play());
document.getElementById('btn-stop').addEventListener('click', () => stopPlayback());

document.getElementById('chk-loop').addEventListener('change', (e) => {
  // Loop region handling via engine's select callback
});

// ── Sidebar ───────────────────────────────────────────────────────────────────
initGeneratePanel(projectState);
document.getElementById('btn-refresh-clips').addEventListener('click', () => refreshClipLibrary());
refreshClipLibrary();

// ── Project save / load / export ──────────────────────────────────────────────
document.getElementById('btn-save').addEventListener('click', () => saveProjectUI(projectState));
document.getElementById('btn-load').addEventListener('click', () => loadProjectUI(projectState));
document.getElementById('btn-export').addEventListener('click', () => exportMixUI(projectState));

// ── Init Engine ──────────────────────────────────────────────────────────────
const playlistContainer = document.getElementById('playlist-container');
initEngine(playlistContainer);
setProjectBpm(projectState.bpm);
setMasterVolume(projectState.masterVolume);

// Notify on change for minimap updates
setOnChange(() => {
  const tracks = getTracks();
  if (tracks.length > 0) {
    const tracksInfo = tracks.map((t, i) => ({
      index: i,
      name: t.name,
      start: 0,
      duration: Math.max(...t.clips.map(c => c.startTime + c.duration * c.loopCount), 0),
      muted: t.muted,
      soloed: t.solo,
    }));
    renderMinimap(tracksInfo);
  }
});

setOnSelect((start, end) => {
  // Could wire to loop region here
});

// Restore engine state from autosave
if (saved?.engine) {
  restoreState(saved.engine).then(() => {
    toast(`Restored ${saved.engine.tracks?.length || 0} track(s)`, 'info', 3000);
  }).catch(err => {
    console.warn('Restore failed:', err);
  });
}

initMinimap(playlistContainer);

// Toolbar
initToolbar({
  onModeChange: (mode) => setMode(mode),
  onZoomIn: () => zoomIn(),
  onZoomOut: () => zoomOut(),
});

// ── Context menu ──────────────────────────────────────────────────────────────
playlistContainer.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const clip = getSelectedClip();
  if (clip) {
    showContextMenu(e.clientX, e.clientY);
  }
});

initContextMenu(async (action) => {
  const clip = getSelectedClip();

  switch (action) {
    case 'delete':
      if (clip) {
        removeClip(clip.id);
        autoSave();
      }
      break;

    case 'duplicate':
      if (clip) {
        duplicateClip(clip.id);
        autoSave();
      }
      break;

    case 'loop2':
    case 'loop4':
    case 'loopfill': {
      if (!clip) {
        toast('Click a clip first', 'warning');
        break;
      }
      const count = action === 'loop2' ? 2 : action === 'loop4' ? 4 : 8;
      clip.loopCount = count;
      autoSave();
      toast(`Loop set to x${count}`, 'success', 2000);
      break;
    }
  }
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  // Skip when typing in inputs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

  switch (e.key) {
    // Space = play/stop toggle
    case ' ':
      e.preventDefault();
      if (getIsPlaying()) stopPlayback();
      else play();
      break;

    // Delete/Backspace = remove selected clip
    case 'Delete':
    case 'Backspace':
      e.preventDefault();
      const clip = getSelectedClip();
      if (clip) { removeClip(clip.id); autoSave(); }
      break;

    // 1/2/3 = switch mode
    case '1': setToolbarMode('cursor'); break;
    case '2': setToolbarMode('move'); break;
    case '3': setToolbarMode('select'); break;

    // +/- = zoom
    case '+':
    case '=':
      zoomIn(); break;
    case '-':
      zoomOut(); break;

    // D = duplicate selected clip
    case 'd':
    case 'D':
      if (!e.ctrlKey) {
        const sel = getSelectedClip();
        if (sel) { duplicateClip(sel.id); autoSave(); }
      }
      break;

    // Home = seek to start
    case 'Home':
      seek(0); break;

    // Ctrl+S = save project
    case 's':
    case 'S':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        document.getElementById('btn-save').click();
      }
      break;
  }
});

// ── Ctrl+scroll zoom on timeline container ───────────────────────────────────
playlistContainer.addEventListener('wheel', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  }
}, { passive: false });
