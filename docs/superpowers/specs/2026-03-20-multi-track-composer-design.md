# Multi-Track Composer for RC Stable Audio Tools

## Overview

A standalone browser-based multi-track composer/DAW that integrates with the existing RC Stable Audio Tools Gradio app. Users generate audio clips in either the Gradio UI or the composer's built-in generation panel, then arrange them on a timeline to build full compositions.

## Architecture

Two separate services running side by side:

- **Gradio app** (port 7860) — existing audio generation UI, unchanged except for a "Send to Composer" button
- **Composer app** (port 8000) — FastAPI backend serving a standalone frontend + REST API

```
Browser
├── Gradio UI (port 7860) ──"Send to Composer"──┐
└── Composer App (port 8000)                     │
    ├── Frontend (waveform-playlist + Tone.js)   │
    └── FastAPI Backend ◄────────────────────────┘
        ├── /api/generate  (proxies to Gradio API)
        ├── /api/clips     (list /generations/)
        ├── /api/bpm       (librosa detection)
        ├── /api/project   (save/load compositions)
        ├── /api/export    (mix down to WAV)
        └── /api/stretch   (time-stretch to match BPM)

File System
├── /generations/  (generated audio clips)
└── /projects/     (composition JSON files)
```

### Why two services

The composer is a fundamentally different UI from the generation tool — a DAW timeline with drag-and-drop, continuous playback, and real-time mixing. Gradio wasn't built for this. A standalone app gives full control over the frontend, and waveform-playlist works natively as an npm library. FastAPI is lightweight and can call the Gradio generation API directly.

## Frontend

**Tech stack:** Vanilla JS + Vite (or esbuild), waveform-playlist, Tone.js. No heavy framework.

### Layout: Sidebar + Timeline

**Left sidebar** has two panels:

1. **Generate panel** — prompt textarea, bars dropdown, key signature (locked to project key), steps slider, generate button. BPM is locked to project BPM. Calls `/api/generate` which proxies to Gradio's generation endpoint. Generated clip appears in clip library.

2. **Clip library** — lists all WAVs in `/generations/`. Shows filename, duration, detected BPM. Clips are draggable onto timeline tracks. Can also click "+" on a track to browse clips.

**Timeline** (powered by waveform-playlist):

- Bar/beat ruler at top derived from project BPM (4/4 time)
- Unlimited tracks, each with: name, color, volume slider, mute button, solo button
- Clips rendered as waveforms, draggable left/right to set position on the timeline
- Clips snap to bar boundaries when dragged
- Playhead moves during playback across all tracks
- Zoom in/out on the timeline

**Transport bar** at top:

- Play / Stop / Loop toggle
- Project BPM (editable, warns if existing clips don't match new BPM)
- Project key signature
- Master volume
- Export Mix button

### State management

Single JS object holding the full project state — tracks, clips, positions, volumes. Persisted via `/api/project` endpoints. No complex state library needed.

## Backend API

FastAPI application serving both the static frontend files and REST endpoints.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/clips` | GET | List all WAVs in `/generations/` with metadata (duration, detected BPM, file size) |
| `/api/clips/{filename}` | GET | Serve a WAV file for browser playback |
| `/api/bpm` | POST | Detect BPM of a given WAV using librosa |
| `/api/generate` | POST | Proxy generation request to Gradio API (see Gradio Proxy section) |
| `/api/clips/notify` | POST | Called by Gradio "Send to Composer" button to signal a new clip is available |
| `/api/project` | GET | List saved projects |
| `/api/project/{name}` | GET | Load a project JSON |
| `/api/project/{name}` | PUT | Save a project JSON |
| `/api/export` | POST | Mix all tracks to a single WAV |
| `/api/stretch` | POST | Time-stretch a clip to match project BPM |

### Gradio proxy mechanism

The `/api/generate` endpoint uses `gradio_client.Client` to call the Gradio app's generation API. Parameter mapping:

| Composer param | Gradio param | Notes |
|---|---|---|
| `prompt` | `prompt` | Text prompt |
| `bars` | `bars` | Number of bars |
| `bpm` | `bpm` | Beats per minute |
| `key` | `key_note` + `key_scale` | Split into note and scale |
| `seed` | `seed` | Random seed (-1 for random) |
| `steps` | `steps` | Diffusion steps |

Remaining Gradio parameters use defaults: `cfg_scale=7.0`, `sampler_type="dpmpp-3m-sde"`, `sigma_min=0.03`, `sigma_max=1000`. If the Gradio app has auth enabled (`--username`/`--password`), the proxy must pass credentials to `gradio_client.Client(auth=(...))`.

### CORS

The FastAPI app must include `CORSMiddleware` allowing the Gradio origin (`http://localhost:7860`) for cross-origin requests from the "Send to Composer" button. Configuration:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:7860"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Project JSON format

```json
{
  "version": 1,
  "name": "my-track",
  "bpm": 120,
  "key": "C min",
  "tracks": [
    {
      "name": "Drums",
      "color": "#e94560",
      "volume": 0.75,
      "muted": false,
      "solo": false,
      "clips": [
        {
          "file": "drums_loop_42.wav",
          "startBar": 1,
          "duration": 4.0,
          "bpm": 120
        }
      ]
    }
  ]
}
```

### Export logic

For each track: position audio at the correct sample offset based on `startBar + BPM`, apply track volume, sum all tracks, peak-normalize to -1 dBFS, save as 16-bit WAV using pydub (already installed).

- All clips are resampled to the model's output sample rate (44100 Hz for Foundation-1) before mixing
- Solo/mute state is respected — muted tracks are excluded, and if any track is soloed, only soloed tracks are included
- Output is stereo (mono clips are duplicated to both channels)

## BPM Detection & Sync

**Detection:** `librosa.beat.beat_track()` — already installed. Called automatically when a clip is added to the library. Sufficient accuracy for constant-tempo AI-generated clips.

**Grid snapping:** Clips snap to bar boundaries when dragged on the timeline.

```
bar_position_seconds = (bar_number - 1) * (beats_per_bar * 60 / bpm)
```

The composer assumes 4/4 time (4 beats per bar). Other time signatures are out of scope for v1. This matches the existing Gradio app which hardcodes `BEATS_PER_BAR = 4`.

**BPM mismatch handling:**

1. When adding a clip whose detected BPM differs from project BPM by more than 2 BPM, show a warning
2. Offer to time-stretch via `torchaudio.functional.speed()` (more reliable on Windows than librosa's rubberband dependency) — creates a new WAV at the correct BPM, saved alongside the original
3. User can ignore the warning and place the clip as-is

**Playback:** waveform-playlist handles both rendering and playback via its built-in Web Audio API engine. Tone.js Transport provides the BPM-aware master clock, driving waveform-playlist's `play()`/`stop()`/`setCurrentTime()` methods. This avoids double-playback conflicts — waveform-playlist owns the audio nodes, Tone.js owns the timing.

1. `Tone.Transport.bpm.value = projectBPM`
2. For each track, for each clip: `player.start(clipStartTimeInSeconds)`
3. Transport controls play, pause, seek, and loop through one clock

## Dependencies

### Python (add to existing environment)

- `fastapi` — API server
- `uvicorn` — ASGI server for FastAPI
- No new audio libraries needed (librosa, pydub, torchaudio already installed)

### JavaScript (new npm project in `/composer/`)

- `waveform-playlist` — multi-track timeline UI
- `tone` — Web Audio API framework, transport/scheduling
- `vite` — build tool and dev server (dev dependency)

## File structure

```
/composer/
├── package.json
├── vite.config.js
├── index.html
├── src/
│   ├── main.js          (app entry, init waveform-playlist + Tone.js)
│   ├── sidebar.js       (generate panel + clip library)
│   ├── timeline.js      (waveform-playlist setup, track management)
│   ├── transport.js     (Tone.js transport, play/stop/loop)
│   ├── api.js           (fetch wrappers for FastAPI endpoints)
│   ├── project.js       (save/load project state)
│   └── style.css        (dark theme matching Gradio app)
├── server/
│   ├── app.py           (FastAPI application)
│   ├── routes/
│   │   ├── clips.py     (clip listing and serving)
│   │   ├── generate.py  (proxy to Gradio)
│   │   ├── bpm.py       (BPM detection)
│   │   ├── project.py   (project save/load)
│   │   ├── export.py    (mix export)
│   │   └── stretch.py   (time-stretch endpoint)
│   └── services/
│       ├── audio.py     (BPM detection, time-stretch, mixing)
│       └── gradio_proxy.py  (Gradio API client)
└── dist/                (built frontend, served by FastAPI)
```

## Integration with Gradio

Minimal change to the existing Gradio app: add a "Send to Composer" button next to the audio output. Implemented via Gradio's `_js` parameter on the button click — a small JavaScript function that POSTs `{file: filename}` to `http://localhost:8000/api/clips/notify`. This avoids adding Python HTTP dependencies to the Gradio app. The composer refreshes its clip library on receiving the notification.

The FastAPI app reads `config.json` to discover `generations_directory` rather than hardcoding the path, keeping both services in sync.

## Constraints

- **4/4 time only** — other time signatures out of scope for v1
- **Single user** — no concurrent access controls, local-only usage
- **WAV only** — no MP3/FLAC import (generated clips are always WAV)

## Error Handling

- **Gradio unavailable:** If the Gradio app is not running when the composer tries to proxy a generation request, return a clear error message ("Generation service not available — start the Gradio app on port 7860")
- **BPM detection failure:** If librosa returns NaN or an unreasonable value (<40 or >300 BPM), set BPM to "unknown" and skip auto-stretch. User can manually set clip BPM.
- **File I/O:** Non-WAV files in `/generations/` are silently skipped. Corrupted WAVs that fail to load are shown with an error icon in the clip library. Export failures show a toast notification with the error.

## Launch

Both services launched from a single script:

```bash
# Terminal 1 (or background): Gradio
uv run python run_gradio.py

# Terminal 2 (or background): Composer
cd composer && uv run python server/app.py
```

Or a combined launcher script that starts both.
