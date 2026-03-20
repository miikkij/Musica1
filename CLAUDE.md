# CLAUDE.md — Musica1

## Project Overview

Musica1 is an AI music composition suite built on top of [RC Stable Audio Tools](https://github.com/RoyalCities/RC-stable-audio-tools). It combines a Gradio-based audio generation UI with a custom-built browser-based multi-track composer/DAW.

**Two services run side by side:**
- **Gradio app** (port 7860) — AI audio generation from text prompts
- **Composer app** (port 8000) — FastAPI backend + Canvas-based DAW frontend

## Repository Structure

```
Musica1/
├── run_gradio.py                    # Gradio app entry point
├── stable_audio_tools/              # Core audio generation library
│   └── interface/gradio.py          # Gradio UI (modified: "Send to Composer" button)
├── composer/                        # Multi-track composer (our addition)
│   ├── server/                      # FastAPI backend
│   │   ├── app.py                   # App entry, router mounting, static serving
│   │   ├── config.py                # Shared config (GENERATIONS_DIR, PROJECTS_DIR)
│   │   ├── routes/                  # API endpoints
│   │   │   ├── clips.py             # List/serve WAV files
│   │   │   ├── bpm.py               # BPM detection (librosa)
│   │   │   ├── generate.py          # Proxy to Gradio generation API
│   │   │   ├── project.py           # Save/load project JSON
│   │   │   ├── export.py            # Mix tracks to single WAV
│   │   │   ├── stretch.py           # Time-stretch clips
│   │   │   └── loop.py              # Repeat/loop clips
│   │   └── services/
│   │       ├── audio.py             # BPM detection, time-stretch, mix-down
│   │       └── gradio_proxy.py      # Gradio API client
│   ├── src/                         # Frontend (vanilla JS + Vite)
│   │   ├── main.js                  # App entry, state management, keyboard shortcuts
│   │   ├── engine.js                # Canvas-based DAW timeline engine (core)
│   │   ├── sidebar.js               # Generate panel + clip library
│   │   ├── minimap.js               # Overview strip with draggable viewport
│   │   ├── toolbar.js               # Mode buttons (cursor/move/select)
│   │   ├── transport.js             # Play/stop/loop via Web Audio API
│   │   ├── context-menu.js          # Right-click menu on clips
│   │   ├── project.js               # Save/load/export UI
│   │   ├── toast.js                 # Toast notifications + dialog system
│   │   ├── api.js                   # Fetch wrappers for all backend endpoints
│   │   └── style.css                # Dark theme CSS
│   ├── index.html                   # App shell
│   ├── vite.config.js               # Vite build config with API proxy
│   ├── package.json                 # npm dependencies
│   └── dist/                        # Built frontend (served by FastAPI)
├── models/                          # Downloaded AI models
├── generations/                     # Generated WAV files (shared between both apps)
├── projects/                        # Saved composer projects (JSON)
├── config.json                      # Shared config (models_directory, generations_directory)
├── start.bat                        # Windows launcher for both services
└── docs/superpowers/                # Design specs and implementation plans
    ├── specs/                       # Feature design documents
    └── plans/                       # Step-by-step implementation plans
```

## Key Technical Decisions

- **Canvas-based timeline** — waveform-playlist was used initially but replaced with a custom Canvas engine (`engine.js`) because waveform-playlist doesn't support multiple clips per track or drag-between-tracks
- **No circular imports** — backend config lives in `composer/server/config.py`, not `app.py`. All routes import from config, never from app
- **Gradio API parameter order** matters — see `gradio_proxy.py` for the exact order matching `gradio.py` lines 965-983: `prompt, negative_prompt, bars, bpm, note, scale, cfg_scale, steps, preview_every, seed, sampler_type, sigma_min, sigma_max, cfg_rescale, init_audio_checkbox, init_audio_input, init_noise_level`
- **Windows compatibility** — time-stretch uses `librosa.effects.time_stretch` (phase vocoder), NOT `torchaudio.sox_effects` which requires SoX
- **Gradio 6.x** — uses `js=` parameter, not `_js=` for JavaScript callbacks on buttons
- **Static file mount must be last** in `app.py` so API routes take precedence

## Development Workflow

### Running in development

```bash
# Terminal 1: Gradio
uv run python run_gradio.py

# Terminal 2: Composer backend
uv run python -m composer.server.app

# Terminal 3: Vite dev server (hot reload, proxies /api to port 8000)
cd composer && npx vite
```

### Building for production

```bash
cd composer && npm run build
# Then just run the backend — it serves dist/ automatically
uv run python -m composer.server.app
```

### Running tests

```bash
uv run pytest composer/tests/ -v
```

## Git Remotes

- **origin** → `miikkij/Musica1` (this repo, push here)
- **upstream** → `RoyalCities/RC-stable-audio-tools` (original, pull updates from here)

```bash
git pull upstream main   # sync with upstream
git push origin main     # push to our repo
```

## Current State (March 2026)

### Completed
- FastAPI backend with all APIs (clips, BPM, generate proxy, project, export, stretch, loop)
- Canvas-based DAW timeline engine with multi-clip tracks
- Drag-and-drop clips from library to timeline
- Clip move, delete, duplicate via context menu
- Loop-extend by dragging right edge of clips
- BPM snap toggle
- Minimap with draggable viewport
- Zoom (Ctrl+scroll, +/- keys)
- Keyboard shortcuts (Space, 1/2/3, H, Delete, +/-)
- Help dialog
- Advanced generation options modal with all sampler parameters
- Prompt guide with Foundation-1 tag reference
- Random prompt generator
- Auto-save to localStorage
- Send to Composer button in Gradio UI
- Project save/load
- Mix export

### Known Limitations
- Loop-extend snaps to whole loop multiples (design says free-form, implementation rounds)
- Clips cannot be dragged between tracks (within same track only)
- Select mode selects a region but loop playback of selected region not fully wired
- LocalStorage restore of tracks can fail if clip files were deleted
- No undo/redo system yet

## Coding Conventions

- **Frontend**: Vanilla JS, no framework. ES modules. Vite for bundling.
- **Backend**: FastAPI with Pydantic models. Routes import config from `config.py`.
- **CSS**: CSS custom properties for theming. Dark theme only.
- **Commits**: Conventional commits (feat/fix/refactor). Co-authored with Claude.
- **No alerts**: Use `toast()`, `dialogInfo()`, `dialogPrompt()`, `dialogSelect()`, or `showDialog()` from `toast.js` instead of `alert()`/`prompt()`/`confirm()`.
