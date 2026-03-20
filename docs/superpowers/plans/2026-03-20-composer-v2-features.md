# Composer v2 Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add DAW-standard timeline interactions to the composer: mode toolbar, clip looping, multi-clip tracks, minimap, loop regions, song length target, and right-click context menu.

**Architecture:** Extend waveform-playlist's built-in state system (cursor/shift/select) via a mode toolbar. Add a custom minimap canvas, context menu overlay, and loop API endpoint. All new frontend modules are small single-purpose JS files wired through main.js.

**Tech Stack:** JavaScript (waveform-playlist, Tone.js, Canvas API, Vite), Python (FastAPI, pydub)

**Spec:** `docs/superpowers/specs/2026-03-20-composer-v2-features-design.md`

---

## File Map

### New files
- `composer/src/toolbar.js` — mode toolbar (Cursor/Move/Select) + zoom buttons, emits state changes to waveform-playlist
- `composer/src/minimap.js` — canvas-based overview strip, viewport rectangle, click-to-jump
- `composer/src/context-menu.js` — right-click menu overlay for clips (duplicate, loop, delete)
- `composer/server/routes/loop.py` — POST `/api/loop` endpoint
- `composer/tests/test_loop.py` — loop endpoint tests

### Modified files
- `composer/index.html` — add toolbar div, minimap div, song length input
- `composer/src/main.js` — initialize toolbar/minimap/context-menu, update drop logic for multi-clip tracks, wire song length
- `composer/src/timeline.js` — expose playlist/ee for external use, add helpers for track detection and clip management
- `composer/src/transport.js` — add loop region storage and setLoopRegion()
- `composer/src/api.js` — add loopClip() function
- `composer/src/style.css` — toolbar, minimap, context menu, loop region, song length marker styles
- `composer/server/services/audio.py` — add loop_clip() function
- `composer/server/app.py` — register loop router

---

## Task 1: Loop Clip Backend API

**Files:**
- Modify: `composer/server/services/audio.py`
- Create: `composer/server/routes/loop.py`
- Create: `composer/tests/test_loop.py`
- Modify: `composer/server/app.py`

- [ ] **Step 1: Write the failing test**

Create `composer/tests/test_loop.py`:

```python
import wave
import pytest
from conftest import create_test_wav


@pytest.fixture
def setup_loop_clip(tmp_generations):
    create_test_wav(tmp_generations / "drums.wav", duration_s=2.0, value=1000)


def test_loop_creates_repeated_file(client, tmp_generations, setup_loop_clip):
    resp = client.post("/api/loop", json={
        "filename": "drums.wav",
        "repeat_count": 3
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "output_filename" in data
    output = tmp_generations / data["output_filename"]
    assert output.exists()
    # Looped file should be ~3x the original duration
    with wave.open(str(output), "r") as f:
        duration = f.getnframes() / f.getframerate()
    assert duration == pytest.approx(6.0, abs=0.5)


def test_loop_repeat_count_1_returns_original(client, tmp_generations, setup_loop_clip):
    resp = client.post("/api/loop", json={
        "filename": "drums.wav",
        "repeat_count": 1
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["output_filename"] == "drums.wav"


def test_loop_missing_file_returns_404(client):
    resp = client.post("/api/loop", json={
        "filename": "nonexistent.wav",
        "repeat_count": 2
    })
    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd e:/dev/GitHub/Musica1 && uv run pytest composer/tests/test_loop.py -v
```

- [ ] **Step 3: Implement loop_clip in audio.py**

Add to `composer/server/services/audio.py`:

```python
def loop_clip(filepath: Path, repeat_count: int, output_dir: Path) -> Path:
    """Repeat a WAV file N times and save as a new file.

    If repeat_count is 1, returns the original path unchanged.
    """
    if repeat_count <= 1:
        return filepath

    audio = AudioSegment.from_wav(str(filepath))
    looped = audio * repeat_count

    output_name = f"{filepath.stem}_loop{repeat_count}.wav"
    output_path = output_dir / output_name
    looped.export(str(output_path), format="wav")
    return output_path
```

- [ ] **Step 4: Implement loop route**

Create `composer/server/routes/loop.py`:

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import composer.server.config as _config
from composer.server.services.audio import loop_clip

router = APIRouter(prefix="/api", tags=["loop"])


class LoopRequest(BaseModel):
    filename: str
    repeat_count: int = 2


@router.post("/loop")
def loop(req: LoopRequest):
    filepath = _config.GENERATIONS_DIR / req.filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")

    output_path = loop_clip(filepath, req.repeat_count, _config.GENERATIONS_DIR)
    return {"output_filename": output_path.name, "repeat_count": req.repeat_count}
```

- [ ] **Step 5: Register router in app.py**

Add to `composer/server/app.py` after the generate router import:

```python
from composer.server.routes.loop import router as loop_router  # noqa: E402
```

And after the generate include:

```python
app.include_router(loop_router)
```

- [ ] **Step 6: Add loopClip to api.js**

Add to `composer/src/api.js`:

```js
export async function loopClip(filename, repeatCount) {
  const res = await fetch(`${BASE}/loop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, repeat_count: repeatCount }),
  });
  return handleResponse(res);
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
uv run pytest composer/tests/test_loop.py -v
```

- [ ] **Step 8: Commit**

```bash
git add composer/server/ composer/tests/test_loop.py composer/src/api.js
git commit -m "feat: add clip loop API endpoint"
```

---

## Task 2: HTML Structure Updates — Toolbar, Minimap, Song Length

**Files:**
- Modify: `composer/index.html`

- [ ] **Step 1: Add toolbar, minimap container, and song length input**

In `composer/index.html`, replace the `<section id="timeline-container">` block with:

```html
      <section id="timeline-container">
        <!-- Mode toolbar -->
        <div id="toolbar">
          <div class="toolbar-modes">
            <button class="toolbar-btn active" data-mode="cursor" id="btn-mode-cursor">&#9654; Cursor</button>
            <button class="toolbar-btn" data-mode="shift" id="btn-mode-move">&#8596; Move</button>
            <button class="toolbar-btn" data-mode="select" id="btn-mode-select">&#9634; Select</button>
          </div>
          <div class="toolbar-right">
            <span class="toolbar-label">Zoom:</span>
            <button class="toolbar-btn" id="btn-zoom-out">-</button>
            <button class="toolbar-btn" id="btn-zoom-in">+</button>
          </div>
        </div>
        <!-- Minimap -->
        <div id="minimap-container">
          <canvas id="minimap-canvas"></canvas>
        </div>
        <!-- Waveform playlist -->
        <div id="playlist-container"></div>
      </section>
```

Also add song length input to the transport center section, after the Master volume label:

```html
        <label>Length: <input type="text" id="input-length" value="auto" placeholder="m:ss" style="width:50px;"></label>
```

Remove the `<div id="track-controls"></div>` line (waveform-playlist renders its own controls).

- [ ] **Step 2: Commit**

```bash
git add composer/index.html
git commit -m "feat: add toolbar, minimap, and song length HTML structure"
```

---

## Task 3: Toolbar Styles + Minimap + Context Menu CSS

**Files:**
- Modify: `composer/src/style.css`

- [ ] **Step 1: Add all new CSS at the end of style.css**

```css
/* ── Mode Toolbar ──────────────────────────────────────────────────────────── */
#toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
  background: #121a30;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  height: 32px;
}

.toolbar-modes, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 2px;
}

.toolbar-label {
  color: #888;
  font-size: 10px;
  margin-right: 4px;
}

.toolbar-btn {
  background: var(--accent3);
  color: var(--text);
  border: 1px solid var(--border);
  padding: 3px 10px;
  border-radius: 3px;
  font-size: 10px;
  cursor: pointer;
}

.toolbar-btn:hover {
  background: var(--accent2);
  border-color: var(--accent);
}

.toolbar-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}

/* ── Minimap ───────────────────────────────────────────────────────────────── */
#minimap-container {
  height: 32px;
  background: #0d0d1a;
  border-bottom: 1px solid #444;
  position: relative;
  flex-shrink: 0;
}

#minimap-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.minimap-viewport {
  position: absolute;
  top: 0;
  bottom: 0;
  border: 2px solid var(--accent);
  background: rgba(233, 69, 96, 0.08);
  border-radius: 2px;
  cursor: grab;
  z-index: 2;
}

.minimap-viewport:active {
  cursor: grabbing;
}

.minimap-label {
  position: absolute;
  right: 4px;
  top: 2px;
  font-size: 8px;
  color: #666;
  pointer-events: none;
  z-index: 3;
}

/* ── Context Menu ──────────────────────────────────────────────────────────── */
#context-menu {
  display: none;
  position: fixed;
  background: var(--bg-mid);
  border: 1px solid #444;
  border-radius: 4px;
  padding: 4px 0;
  min-width: 160px;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

#context-menu.visible {
  display: block;
}

.ctx-item {
  padding: 6px 16px;
  font-size: 12px;
  color: var(--text);
  cursor: pointer;
  white-space: nowrap;
}

.ctx-item:hover {
  background: var(--accent3);
}

.ctx-item.danger {
  color: var(--accent);
}

.ctx-item.danger:hover {
  background: rgba(233, 69, 96, 0.15);
}

.ctx-separator {
  border-top: 1px solid #444;
  margin: 4px 0;
}

/* ── Loop Region Markers ───────────────────────────────────────────────────── */
.playlist .selection.segment {
  background: rgba(76, 175, 130, 0.2) !important;
  border-left: 2px solid #4caf82;
  border-right: 2px solid #4caf82;
}

/* ── Song Length End Marker ─────────────────────────────────────────────────── */
.song-end-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  border-left: 2px dashed #666;
  pointer-events: none;
  z-index: 4;
}
```

- [ ] **Step 2: Commit**

```bash
git add composer/src/style.css
git commit -m "feat: add toolbar, minimap, context menu, and loop region CSS"
```

---

## Task 4: Mode Toolbar Module

**Files:**
- Create: `composer/src/toolbar.js`
- Modify: `composer/src/main.js`
- Modify: `composer/src/timeline.js`

- [ ] **Step 1: Create toolbar.js**

```js
/**
 * Mode toolbar — switches waveform-playlist between cursor/shift/select states
 * and provides zoom in/out buttons.
 */

let currentMode = 'cursor';
let onModeChangeCallback = null;
let onZoomInCallback = null;
let onZoomOutCallback = null;

const MODE_BUTTONS = ['btn-mode-cursor', 'btn-mode-move', 'btn-mode-select'];

export function initToolbar({ onModeChange, onZoomIn, onZoomOut }) {
  onModeChangeCallback = onModeChange;
  onZoomInCallback = onZoomIn;
  onZoomOutCallback = onZoomOut;

  // Mode buttons
  MODE_BUTTONS.forEach(id => {
    const btn = document.getElementById(id);
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      setMode(mode);
    });
  });

  // Zoom buttons
  document.getElementById('btn-zoom-in').addEventListener('click', () => {
    if (onZoomInCallback) onZoomInCallback();
  });
  document.getElementById('btn-zoom-out').addEventListener('click', () => {
    if (onZoomOutCallback) onZoomOutCallback();
  });
}

export function setMode(mode) {
  currentMode = mode;

  // Update button styles
  MODE_BUTTONS.forEach(id => {
    const btn = document.getElementById(id);
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  if (onModeChangeCallback) onModeChangeCallback(mode);
}

export function getMode() {
  return currentMode;
}
```

- [ ] **Step 2: Add state change and zoom to timeline.js**

Add these exported functions to the end of `composer/src/timeline.js`:

```js
export function setTimelineState(state) {
  if (ee) ee.emit('statechange', state);
}

export function zoomIn() {
  if (ee) ee.emit('zoomin');
}

export function zoomOut() {
  if (ee) ee.emit('zoomout');
}

export function getPlaylist() {
  return playlist;
}
```

- [ ] **Step 3: Wire toolbar in main.js**

Add import at top of `composer/src/main.js`:

```js
import { initToolbar } from './toolbar.js';
```

Add after the timeline init `.then()`:

```js
import { setTimelineState, zoomIn, zoomOut } from './timeline.js';

// In the init .then() callback or after it:
initToolbar({
  onModeChange: (mode) => setTimelineState(mode),
  onZoomIn: () => zoomIn(),
  onZoomOut: () => zoomOut(),
});
```

Also add Ctrl+scroll zoom on the timeline container:

```js
timelineContainer.addEventListener('wheel', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  }
}, { passive: false });
```

- [ ] **Step 4: Commit**

```bash
git add composer/src/toolbar.js composer/src/timeline.js composer/src/main.js
git commit -m "feat: add mode toolbar with cursor/move/select and zoom controls"
```

---

## Task 5: Context Menu Module

**Files:**
- Create: `composer/src/context-menu.js`
- Modify: `composer/index.html`
- Modify: `composer/src/main.js`

- [ ] **Step 1: Add context menu HTML to index.html**

Add just before `</body>`:

```html
  <div id="context-menu">
    <div class="ctx-item" data-action="duplicate">Duplicate Clip</div>
    <div class="ctx-item" data-action="loop2">Loop x2</div>
    <div class="ctx-item" data-action="loop4">Loop x4</div>
    <div class="ctx-item" data-action="loopfill">Loop to Fill...</div>
    <div class="ctx-separator"></div>
    <div class="ctx-item danger" data-action="delete">Delete Clip</div>
  </div>
```

- [ ] **Step 2: Create context-menu.js**

```js
/**
 * Right-click context menu for clips on the timeline.
 * Only active in Move mode.
 */
import { getMode } from './toolbar.js';

const menu = document.getElementById('context-menu');
let actionCallback = null;

export function initContextMenu(onAction) {
  actionCallback = onAction;

  // Handle menu item clicks
  menu.querySelectorAll('.ctx-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      hideContextMenu();
      if (actionCallback) actionCallback(action);
    });
  });

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) {
      hideContextMenu();
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideContextMenu();
  });
}

export function showContextMenu(x, y) {
  if (getMode() !== 'shift') return; // Only in Move mode

  // Position within viewport
  const menuW = 160;
  const menuH = 200;
  const posX = Math.min(x, window.innerWidth - menuW - 8);
  const posY = Math.min(y, window.innerHeight - menuH - 8);

  menu.style.left = posX + 'px';
  menu.style.top = posY + 'px';
  menu.classList.add('visible');
}

export function hideContextMenu() {
  menu.classList.remove('visible');
}
```

- [ ] **Step 3: Wire context menu in main.js**

Add import:

```js
import { initContextMenu, showContextMenu } from './context-menu.js';
import { loopClip } from './api.js';
```

Add after toolbar init:

```js
// Right-click on timeline shows context menu (Move mode only)
document.getElementById('playlist-container').addEventListener('contextmenu', (e) => {
  e.preventDefault();
  showContextMenu(e.clientX, e.clientY);
});

initContextMenu((action) => {
  // TODO: implement actions in later task when we have clip selection tracking
  console.log('Context menu action:', action);
});
```

- [ ] **Step 4: Commit**

```bash
git add composer/src/context-menu.js composer/index.html composer/src/main.js
git commit -m "feat: add right-click context menu for timeline clips"
```

---

## Task 6: Minimap Module

**Files:**
- Create: `composer/src/minimap.js`
- Modify: `composer/src/main.js`

- [ ] **Step 1: Create minimap.js**

```js
/**
 * Minimap — canvas overview of the full composition.
 * Shows colored bars for each track's clips and a draggable viewport rectangle.
 */

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

  // Create viewport rectangle
  viewportDiv = document.createElement('div');
  viewportDiv.className = 'minimap-viewport';
  container.appendChild(viewportDiv);

  // Label
  const label = document.createElement('div');
  label.className = 'minimap-label';
  label.textContent = 'MINIMAP';
  container.appendChild(label);

  // Click to jump
  container.addEventListener('mousedown', (e) => {
    if (e.target === viewportDiv) {
      isDragging = true;
      dragStartX = e.clientX - viewportDiv.offsetLeft;
      return;
    }
    // Click on minimap = jump
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
    const ratio = newLeft / (rect.width - viewportDiv.offsetWidth);
    if (playlistEl) {
      playlistEl.scrollLeft = ratio * (playlistEl.scrollWidth - playlistEl.clientWidth);
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Update on scroll
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
    const color = TRACK_COLORS[i % TRACK_COLORS.length];
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.5;

    // For now, draw a bar for the full track width
    // This will be enhanced when we have clip position data
    ctx.fillRect(4, y, displayW - 8, trackH);
  });

  ctx.globalAlpha = 1;
}
```

- [ ] **Step 2: Wire minimap in main.js**

Add import:

```js
import { initMinimap, renderMinimap } from './minimap.js';
```

In the timeline init `.then()` callback:

```js
initMinimap(document.getElementById('playlist-container'));
```

- [ ] **Step 3: Commit**

```bash
git add composer/src/minimap.js composer/src/main.js
git commit -m "feat: add minimap overview with draggable viewport"
```

---

## Task 7: Loop Region & Seeking in Transport

**Files:**
- Modify: `composer/src/transport.js`
- Modify: `composer/src/timeline.js`
- Modify: `composer/src/main.js`

- [ ] **Step 1: Add loop region to transport.js**

Add to `composer/src/transport.js`:

```js
let loopRegion = { start: 0, end: 0 };

export function setLoopRegion(start, end) {
  loopRegion = { start, end };
  const transport = Tone.getTransport();
  if (transport.loop && end > start) {
    transport.loopStart = start;
    transport.loopEnd = end;
  }
}

export function getLoopRegion() {
  return loopRegion;
}
```

Update the existing `setLoop` function to use the stored region:

```js
export function setLoop(enabled) {
  const transport = Tone.getTransport();
  transport.loop = enabled;
  if (enabled && loopRegion.end > loopRegion.start) {
    transport.loopStart = loopRegion.start;
    transport.loopEnd = loopRegion.end;
  }
}
```

- [ ] **Step 2: Listen for select events in timeline.js**

Add to `initTimeline()` after `ee = playlist.getEventEmitter()`:

```js
  // Emit loop region when user selects a range
  ee.on('select', (start, end) => {
    if (onSelectCallback) onSelectCallback(start, end);
  });
```

Add module-level variable and setter:

```js
let onSelectCallback = null;

export function onSelect(callback) {
  onSelectCallback = callback;
}
```

- [ ] **Step 3: Wire in main.js**

Add imports:

```js
import { setLoopRegion } from './transport.js';
import { onSelect } from './timeline.js';
```

After timeline init:

```js
onSelect((start, end) => {
  setLoopRegion(start, end);
});
```

Update the loop checkbox handler to use the new signature:

```js
loopCheckbox.addEventListener('change', () => {
  setLoop(loopCheckbox.checked);
});
```

- [ ] **Step 4: Commit**

```bash
git add composer/src/transport.js composer/src/timeline.js composer/src/main.js
git commit -m "feat: add loop region selection and seeking"
```

---

## Task 8: Song Length Target

**Files:**
- Modify: `composer/src/main.js`

- [ ] **Step 1: Wire song length input**

Add to `composer/src/main.js` after the master volume sync:

```js
// ── Song length sync ─────────────────────────────────────────────────────────
const lengthInput = document.getElementById('input-length');
lengthInput.addEventListener('change', () => {
  const val = lengthInput.value.trim();
  if (val === '' || val.toLowerCase() === 'auto') {
    projectState.targetLength = null;
    lengthInput.value = 'auto';
    return;
  }
  // Parse mm:ss or m:ss
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
```

- [ ] **Step 2: Add targetLength to projectState**

Update the projectState initialization:

```js
const projectState = {
  bpm: 120,
  keyNote: 'C',
  keyScale: 'minor',
  masterVolume: 1,
  targetLength: null,
  tracks: [],
};
```

- [ ] **Step 3: Commit**

```bash
git add composer/src/main.js
git commit -m "feat: add song length target input (mm:ss or auto)"
```

---

## Task 9: Build, Test & Integration

**Files:**
- Modify: various for fixes

- [ ] **Step 1: Run all backend tests**

```bash
cd e:/dev/GitHub/Musica1 && uv run pytest composer/tests/ -v
```

- [ ] **Step 2: Rebuild frontend**

```bash
cd e:/dev/GitHub/Musica1/composer && npx vite build
```

- [ ] **Step 3: Manual integration test**

Start the server and test in browser:

```bash
cd e:/dev/GitHub/Musica1 && uv run python -m composer.server.app
```

Test checklist:
1. Open http://localhost:8000
2. Mode toolbar visible — click Cursor/Move/Select, verify active state toggles
3. Zoom +/- buttons work — waveforms scale
4. Ctrl+scroll zooms
5. Minimap shows viewport rectangle, drag it to scroll
6. Right-click in Move mode shows context menu
7. Context menu closes on click outside or Escape
8. Song length input accepts "3:30" format
9. Drag clip from sidebar to timeline — still works
10. Play/Stop still works

- [ ] **Step 4: Fix any issues found during testing**

- [ ] **Step 5: Final commit**

```bash
cd e:/dev/GitHub/Musica1
git add -A
git commit -m "fix: integration fixes for composer v2 features"
```
