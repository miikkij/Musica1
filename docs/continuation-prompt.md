# Musica1 — Continuation Prompt

Use this prompt to resume development in a new Claude Code session. Copy-paste the relevant sections below.

---

## Full Context Prompt

```
I'm working on Musica1, an AI music composition suite. Read CLAUDE.md first for full project context.

Repository: e:\dev\GitHub\Musica1 (also at https://github.com/miikkij/Musica1)
Git remotes: origin = miikkij/Musica1, upstream = RoyalCities/RC-stable-audio-tools

## Architecture

Two services:
- Gradio app (port 7860) — AI audio generation from text prompts using Stable Audio models
- Composer app (port 8000) — FastAPI backend + custom Canvas-based DAW frontend

## How to Run

```bash
# Option 1: start.bat launches both
start.bat

# Option 2: manually
uv run python run_gradio.py                    # Terminal 1: Gradio on :7860
uv run python -m composer.server.app           # Terminal 2: Composer on :8000

# Dev mode (hot reload):
cd composer && npx vite                        # Terminal 3: Vite on :3000 (proxies /api to :8000)
```

## Frontend Build

```bash
cd composer && npm run build    # builds to composer/dist/, served by FastAPI
```

## Key Files

- `composer/src/engine.js` — Canvas DAW timeline engine (core of the composer)
- `composer/src/main.js` — app entry, state management, keyboard shortcuts, autosave
- `composer/src/sidebar.js` — generate panel, clip library, advanced options modal, prompt help
- `composer/src/minimap.js` — overview strip with draggable viewport
- `composer/src/toast.js` — toast notifications + dialog system (NO alert/prompt/confirm)
- `composer/src/style.css` — dark theme
- `composer/server/config.py` — shared config (all routes import from here, never from app.py)
- `composer/server/services/gradio_proxy.py` — Gradio API proxy (parameter order matters!)
- `stable_audio_tools/interface/gradio.py` — Gradio UI (modified with "Send to Composer" button)

## Critical Technical Details

1. Gradio API parameter order (gradio.py lines 965-983):
   prompt, negative_prompt, bars, bpm, note, scale, cfg_scale, steps, preview_every, seed, sampler_type, sigma_min, sigma_max, cfg_rescale, init_audio_checkbox, init_audio_input, init_noise_level

2. Backend config is in config.py (not app.py) to avoid circular imports

3. Gradio 6.x uses `js=` not `_js=` for JavaScript callbacks

4. Time-stretch uses librosa (not torchaudio.sox_effects — doesn't work on Windows)

5. Static file mount in app.py MUST be last (after all routers)

6. Never use alert()/prompt()/confirm() — use toast.js functions instead

## Current State (March 2026)

### Working
- Canvas-based DAW timeline with multi-clip tracks
- Drag-and-drop clips from library to timeline
- Clip move, delete, duplicate (right-click context menu)
- Loop-extend by dragging right edge
- BPM snap toggle
- Minimap with draggable viewport
- Zoom (Ctrl+scroll, +/- keys, buttons)
- Keyboard shortcuts (Space, 1/2/3, H, Delete, +/-)
- Advanced generation options modal (seed, steps, CFG, sampler, sigma, negative prompt)
- Prompt guide + random prompt generator
- Auto-save to localStorage
- Project save/load, mix export
- Send to Composer from Gradio

### Known Issues / TODO
- Clips cannot be dragged between tracks yet (only within same track)
- Select mode selects region but loop playback of region not fully wired
- LocalStorage restore can fail if WAV files were deleted
- No undo/redo system
- Track renaming/reordering/color picker not implemented (Phase 2)
- Per-track waveform colors not implemented (Phase 2)

## Design Documents
- Composer v1 spec: docs/superpowers/specs/2026-03-20-multi-track-composer-design.md
- Composer v2 spec: docs/superpowers/specs/2026-03-20-composer-v2-features-design.md
- Composer v1 plan: docs/superpowers/plans/2026-03-20-multi-track-composer.md
- Composer v2 plan: docs/superpowers/plans/2026-03-20-composer-v2-features.md

## User Preferences
- Finnish speaker, responds in Finnish or English depending on context
- Prefers direct implementation over lengthy planning when features are clear
- Wants visual dialogs instead of browser alert/prompt/confirm
- Prefers spacious, well-explained UI with descriptions
- Auto-save everything to localStorage
- Dark theme throughout
```

---

## Short Resume Prompt

For quick continuation when context is mostly preserved:

```
Continuing work on Musica1 (e:\dev\GitHub\Musica1). Read CLAUDE.md for context.
Two services: Gradio (:7860) + Composer (:8000). Canvas-based DAW in composer/src/engine.js.
Run with: start.bat or `uv run python run_gradio.py` + `uv run python -m composer.server.app`
Build frontend: cd composer && npm run build
```

---

## Bug Fix Prompt

```
Working on Musica1 (e:\dev\GitHub\Musica1). Read CLAUDE.md.
The composer is a Canvas-based DAW at localhost:8000. Key file: composer/src/engine.js
Build after changes: cd composer && npm run build
Restart server: kill port 8000 process, then: uv run python -m composer.server.app

Bug: [describe the bug here]
```

---

## Feature Addition Prompt

```
Working on Musica1 (e:\dev\GitHub\Musica1). Read CLAUDE.md.
I want to add a new feature to the multi-track composer.

Feature: [describe what you want]

Key files to modify:
- Timeline/clips: composer/src/engine.js
- UI/sidebar: composer/src/sidebar.js + composer/index.html
- Styling: composer/src/style.css
- Backend API: composer/server/routes/ + composer/server/services/
- App wiring: composer/src/main.js

After changes: cd composer && npm run build
Then restart: kill port 8000, uv run python -m composer.server.app
```
