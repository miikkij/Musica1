# Multi-Track Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone browser-based multi-track composer/DAW that integrates with the existing RC Stable Audio Tools Gradio app.

**Architecture:** Two-service design — existing Gradio app (port 7860) for audio generation, new FastAPI + vanilla JS app (port 8000) for the composer. Frontend uses waveform-playlist for timeline rendering and Tone.js for BPM-aware transport. Backend handles clip management, BPM detection, project persistence, and mix export.

**Tech Stack:** Python (FastAPI, uvicorn, librosa, pydub, torchaudio), JavaScript (waveform-playlist, Tone.js, Vite)

**Spec:** `docs/superpowers/specs/2026-03-20-multi-track-composer-design.md`

---

## File Map

### New files to create

**Backend (`composer/server/`):**
- `composer/server/config.py` — shared configuration (GENERATIONS_DIR, PROJECTS_DIR) loaded from config.json
- `composer/server/app.py` — FastAPI application entry point, CORS, router mounting
- `composer/server/routes/clips.py` — GET `/api/clips`, GET `/api/clips/{filename}`, POST `/api/clips/notify`
- `composer/server/routes/bpm.py` — POST `/api/bpm`
- `composer/server/routes/project.py` — GET/PUT `/api/project`, GET/PUT `/api/project/{name}`
- `composer/server/routes/export.py` — POST `/api/export`
- `composer/server/routes/stretch.py` — POST `/api/stretch`
- `composer/server/routes/generate.py` — POST `/api/generate` (Gradio proxy)
- `composer/server/services/audio.py` — BPM detection, time-stretch, mix-down logic
- `composer/server/services/gradio_proxy.py` — Gradio API client wrapper

**Backend tests (`composer/tests/`):**
- `composer/tests/conftest.py` — shared fixtures (tmp_generations, tmp_projects, test WAV creation)
- `composer/tests/test_clips.py`
- `composer/tests/test_bpm.py`
- `composer/tests/test_project.py`
- `composer/tests/test_export.py`
- `composer/tests/test_stretch.py`
- `composer/tests/test_generate.py`

**Frontend (`composer/src/`):**
- `composer/package.json` — npm dependencies
- `composer/vite.config.js` — Vite build config with API proxy
- `composer/index.html` — app shell
- `composer/src/main.js` — app entry, init waveform-playlist + Tone.js
- `composer/src/api.js` — fetch wrappers for all FastAPI endpoints
- `composer/src/sidebar.js` — generate panel + clip library UI
- `composer/src/timeline.js` — waveform-playlist setup, track management
- `composer/src/transport.js` — Tone.js transport, play/stop/loop/seek
- `composer/src/project.js` — save/load project state
- `composer/src/style.css` — dark theme

**Existing file to modify:**
- `stable_audio_tools/interface/gradio.py:917` — add "Send to Composer" button

---

## Task 1: Project Scaffolding & FastAPI Shell

**Files:**
- Create: `composer/server/config.py`
- Create: `composer/server/app.py`
- Create: `composer/server/__init__.py`
- Create: `composer/server/routes/__init__.py`
- Create: `composer/server/services/__init__.py`
- Create: `composer/tests/conftest.py`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p composer/server/routes composer/server/services composer/tests
touch composer/server/__init__.py composer/server/routes/__init__.py composer/server/services/__init__.py composer/tests/__init__.py
```

- [ ] **Step 2: Install FastAPI and uvicorn**

```bash
cd e:/dev/GitHub/Musica1 && uv pip install fastapi uvicorn
```

- [ ] **Step 3: Write the shared config module**

Create `composer/server/config.py` (all route/service modules import from here — never from app.py):

```python
import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = ROOT_DIR / "config.json"


def load_config():
    with open(CONFIG_PATH) as f:
        return json.load(f)


config = load_config()
GENERATIONS_DIR = ROOT_DIR / config.get("generations_directory", "generations")
PROJECTS_DIR = ROOT_DIR / "projects"
PROJECTS_DIR.mkdir(exist_ok=True)
```

- [ ] **Step 4: Write the FastAPI app shell**

Create `composer/server/app.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Composer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:7860", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
```

- [ ] **Step 5: Write shared test fixtures**

Create `composer/tests/conftest.py`:

```python
import struct
import wave

import pytest
from fastapi.testclient import TestClient


def create_test_wav(path, duration_s=1.0, sample_rate=44100, value=0):
    """Create a minimal valid WAV file."""
    n_samples = int(duration_s * sample_rate)
    with wave.open(str(path), "w") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sample_rate)
        f.writeframes(struct.pack(f"<{n_samples}h", *([value] * n_samples)))


@pytest.fixture
def tmp_generations(tmp_path, monkeypatch):
    """Patch GENERATIONS_DIR to a temp directory."""
    gen_dir = tmp_path / "generations"
    gen_dir.mkdir()

    import composer.server.config as config_module
    monkeypatch.setattr(config_module, "GENERATIONS_DIR", gen_dir)
    return gen_dir


@pytest.fixture
def tmp_projects(tmp_path, monkeypatch):
    """Patch PROJECTS_DIR to a temp directory."""
    proj_dir = tmp_path / "projects"
    proj_dir.mkdir()

    import composer.server.config as config_module
    monkeypatch.setattr(config_module, "PROJECTS_DIR", proj_dir)
    return proj_dir


@pytest.fixture
def client(tmp_generations, tmp_projects):
    from composer.server.app import app
    return TestClient(app)
```

- [ ] **Step 6: Test the server starts**

```bash
cd e:/dev/GitHub/Musica1 && uv run python composer/server/app.py &
curl http://localhost:8000/api/health
# Expected: {"status":"ok"}
```

Kill the server after verifying.

- [ ] **Step 7: Commit**

```bash
git add composer/server/ composer/tests/
git commit -m "feat: scaffold FastAPI composer backend with config module and shared test fixtures"
```

---

## Task 2: Clips API — List and Serve Audio Files

**Files:**
- Create: `composer/server/routes/clips.py`
- Create: `composer/tests/test_clips.py`
- Modify: `composer/server/app.py`

- [ ] **Step 1: Write the failing test for clip listing**

Create `composer/tests/test_clips.py` (uses shared fixtures from `conftest.py`):

```python
import pytest
from conftest import create_test_wav


@pytest.fixture(autouse=True)
def setup_clips(tmp_generations):
    """Add test WAVs to the temp generations dir."""
    create_test_wav(tmp_generations / "drums_120bpm.wav", duration_s=2.0)
    create_test_wav(tmp_generations / "bass_120bpm.wav", duration_s=1.0)
    (tmp_generations / "notes.txt").write_text("not audio")


def test_list_clips_returns_only_wav_files(client):
    resp = client.get("/api/clips")
    assert resp.status_code == 200
    data = resp.json()
    filenames = [c["filename"] for c in data]
    assert "drums_120bpm.wav" in filenames
    assert "bass_120bpm.wav" in filenames
    assert "notes.txt" not in filenames


def test_list_clips_includes_metadata(client):
    resp = client.get("/api/clips")
    clip = next(c for c in resp.json() if c["filename"] == "drums_120bpm.wav")
    assert "duration" in clip
    assert "file_size" in clip
    assert clip["duration"] == pytest.approx(2.0, abs=0.1)


def test_serve_clip(client):
    resp = client.get("/api/clips/drums_120bpm.wav")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/wav"


def test_serve_missing_clip_returns_404(client):
    resp = client.get("/api/clips/nonexistent.wav")
    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd e:/dev/GitHub/Musica1 && uv pip install pytest httpx
uv run pytest composer/tests/test_clips.py -v
# Expected: FAIL — routes not implemented yet
```

- [ ] **Step 3: Implement clips route**

Create `composer/server/routes/clips.py` (imports from `config`, not `app`):

```python
import wave
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from composer.server.config import GENERATIONS_DIR

router = APIRouter(prefix="/api/clips", tags=["clips"])

_notify_queue: list[str] = []


def _wav_metadata(filepath: Path) -> dict | None:
    """Extract duration and file size from a WAV file."""
    try:
        with wave.open(str(filepath), "r") as f:
            frames = f.getnframes()
            rate = f.getframerate()
            duration = frames / rate
        return {
            "filename": filepath.name,
            "duration": round(duration, 2),
            "file_size": filepath.stat().st_size,
        }
    except Exception:
        return None


@router.get("")
def list_clips():
    clips = []
    if not GENERATIONS_DIR.exists():
        return clips
    for f in sorted(GENERATIONS_DIR.iterdir()):
        if f.suffix.lower() == ".wav" and f.is_file():
            meta = _wav_metadata(f)
            if meta:
                clips.append(meta)
    return clips


@router.get("/{filename}")
def serve_clip(filename: str):
    filepath = GENERATIONS_DIR / filename
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(status_code=404, detail="Clip not found")
    return FileResponse(filepath, media_type="audio/wav")


@router.post("/notify")
def notify_new_clip(file: str = ""):
    _notify_queue.append(file)
    return {"status": "ok", "file": file}
```

- [ ] **Step 4: Register the router in app.py**

Add to `composer/server/app.py` after the health endpoint:

```python
from composer.server.routes.clips import router as clips_router
app.include_router(clips_router)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
uv run pytest composer/tests/test_clips.py -v
# Expected: all 4 tests PASS
```

- [ ] **Step 6: Commit**

```bash
git add composer/
git commit -m "feat: add clips API — list and serve WAV files from generations directory"
```

---

## Task 3: BPM Detection API

**Files:**
- Create: `composer/server/services/audio.py`
- Create: `composer/server/routes/bpm.py`
- Create: `composer/tests/test_bpm.py`
- Modify: `composer/server/app.py`

- [ ] **Step 1: Write the failing test**

Create `composer/tests/test_bpm.py`:

```python
import struct
import wave

import pytest


def create_click_track_wav(path, bpm=120, duration_s=4.0, sample_rate=44100):
    """Create a WAV with clicks at regular intervals to simulate a beat."""
    n_samples = int(duration_s * sample_rate)
    samples_per_beat = int(60 / bpm * sample_rate)
    data = [16000 if (i % samples_per_beat < 100) else 0 for i in range(n_samples)]
    with wave.open(str(path), "w") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sample_rate)
        f.writeframes(struct.pack(f"<{n_samples}h", *data))


@pytest.fixture(autouse=True)
def setup_bpm_clips(tmp_generations):
    create_click_track_wav(tmp_generations / "click_120.wav", bpm=120, duration_s=4.0)


def test_detect_bpm_returns_reasonable_value(client):
    resp = client.post("/api/bpm", json={"filename": "click_120.wav"})
    assert resp.status_code == 200
    data = resp.json()
    assert "bpm" in data
    assert 60 < data["bpm"] < 240


def test_detect_bpm_missing_file_returns_404(client):
    resp = client.post("/api/bpm", json={"filename": "nonexistent.wav"})
    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest composer/tests/test_bpm.py -v
# Expected: FAIL
```

- [ ] **Step 3: Implement audio service with BPM detection**

Create `composer/server/services/audio.py`:

```python
import librosa
import numpy as np
from pathlib import Path


def detect_bpm(filepath: Path) -> float | None:
    """Detect BPM of a WAV file using librosa.

    Returns None if detection fails or result is unreasonable (<40 or >300).
    """
    try:
        y, sr = librosa.load(str(filepath), sr=None)
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(np.atleast_1d(tempo)[0])
        if bpm < 40 or bpm > 300 or np.isnan(bpm):
            return None
        return round(bpm, 1)
    except Exception:
        return None
```

- [ ] **Step 4: Implement BPM route**

Create `composer/server/routes/bpm.py`:

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from composer.server.config import GENERATIONS_DIR
from composer.server.services.audio import detect_bpm

router = APIRouter(prefix="/api", tags=["bpm"])


class BpmRequest(BaseModel):
    filename: str


@router.post("/bpm")
def get_bpm(req: BpmRequest):
    filepath = GENERATIONS_DIR / req.filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    bpm = detect_bpm(filepath)
    return {"filename": req.filename, "bpm": bpm, "status": "unknown" if bpm is None else "detected"}
```

- [ ] **Step 5: Register router in app.py**

Add to `composer/server/app.py`:

```python
from composer.server.routes.bpm import router as bpm_router
app.include_router(bpm_router)
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
uv run pytest composer/tests/test_bpm.py -v
# Expected: PASS
```

- [ ] **Step 7: Commit**

```bash
git add composer/
git commit -m "feat: add BPM detection API using librosa"
```

---

## Task 4: Project Save/Load API

**Files:**
- Create: `composer/server/routes/project.py`
- Create: `composer/tests/test_project.py`
- Modify: `composer/server/app.py`

- [ ] **Step 1: Write the failing test**

Create `composer/tests/test_project.py`:

```python
import pytest


SAMPLE_PROJECT = {
    "version": 1,
    "name": "test-project",
    "bpm": 120,
    "key": "C min",
    "tracks": [
        {
            "name": "Drums",
            "color": "#e94560",
            "volume": 0.75,
            "muted": False,
            "solo": False,
            "clips": []
        }
    ]
}


def test_list_projects_empty(client):
    resp = client.get("/api/project")
    assert resp.status_code == 200
    assert resp.json() == []


def test_save_and_load_project(client):
    resp = client.put("/api/project/test-project", json=SAMPLE_PROJECT)
    assert resp.status_code == 200

    resp = client.get("/api/project/test-project")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "test-project"
    assert data["bpm"] == 120
    assert len(data["tracks"]) == 1


def test_list_projects_after_save(client):
    client.put("/api/project/test-project", json=SAMPLE_PROJECT)
    resp = client.get("/api/project")
    assert resp.status_code == 200
    assert "test-project" in resp.json()


def test_load_missing_project_returns_404(client):
    resp = client.get("/api/project/nonexistent")
    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest composer/tests/test_project.py -v
```

- [ ] **Step 3: Implement project routes**

Create `composer/server/routes/project.py`:

```python
import json

from fastapi import APIRouter, Body, HTTPException

from composer.server.config import PROJECTS_DIR

router = APIRouter(prefix="/api/project", tags=["project"])


@router.get("")
def list_projects():
    if not PROJECTS_DIR.exists():
        return []
    return [f.stem for f in sorted(PROJECTS_DIR.glob("*.json"))]


@router.get("/{name}")
def load_project(name: str):
    filepath = PROJECTS_DIR / f"{name}.json"
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    with open(filepath) as f:
        return json.load(f)


@router.put("/{name}")
def save_project(name: str, project: dict = Body(...)):
    PROJECTS_DIR.mkdir(exist_ok=True)
    filepath = PROJECTS_DIR / f"{name}.json"
    with open(filepath, "w") as f:
        json.dump(project, f, indent=2)
    return {"status": "saved", "name": name}
```

- [ ] **Step 4: Register router in app.py**

```python
from composer.server.routes.project import router as project_router
app.include_router(project_router)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
uv run pytest composer/tests/test_project.py -v
```

- [ ] **Step 6: Commit**

```bash
git add composer/
git commit -m "feat: add project save/load API with JSON persistence"
```

---

## Task 5: Export Mix API

**Files:**
- Create: `composer/server/routes/export.py`
- Create: `composer/tests/test_export.py`
- Modify: `composer/server/app.py`
- Modify: `composer/server/services/audio.py`

- [ ] **Step 1: Write the failing test**

Create `composer/tests/test_export.py`:

```python
import pytest
from conftest import create_test_wav


@pytest.fixture(autouse=True)
def setup_export_clips(tmp_generations):
    create_test_wav(tmp_generations / "drums.wav", duration_s=2.0, value=1000)
    create_test_wav(tmp_generations / "bass.wav", duration_s=2.0, value=1000)


def test_export_mix(client):
    project = {
        "version": 1,
        "name": "test",
        "bpm": 120,
        "key": "C min",
        "tracks": [
            {
                "name": "Drums",
                "volume": 1.0,
                "muted": False,
                "solo": False,
                "clips": [{"file": "drums.wav", "startBar": 1, "duration": 2.0, "bpm": 120}]
            },
            {
                "name": "Bass",
                "volume": 0.5,
                "muted": False,
                "solo": False,
                "clips": [{"file": "bass.wav", "startBar": 1, "duration": 2.0, "bpm": 120}]
            }
        ]
    }
    resp = client.post("/api/export", json=project)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/wav"
    assert len(resp.content) > 0


def test_export_respects_mute(client):
    project = {
        "version": 1,
        "name": "test",
        "bpm": 120,
        "key": "C min",
        "tracks": [
            {
                "name": "Drums",
                "volume": 1.0,
                "muted": True,
                "solo": False,
                "clips": [{"file": "drums.wav", "startBar": 1, "duration": 2.0, "bpm": 120}]
            }
        ]
    }
    resp = client.post("/api/export", json=project)
    assert resp.status_code == 200
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest composer/tests/test_export.py -v
```

- [ ] **Step 3: Add mix_down function to audio service**

Add to `composer/server/services/audio.py`:

```python
from pydub import AudioSegment


def bar_to_ms(bar: int, bpm: float) -> int:
    """Convert a bar number (1-indexed) to milliseconds offset."""
    beats_per_bar = 4  # 4/4 time
    ms_per_beat = 60_000 / bpm
    return int((bar - 1) * beats_per_bar * ms_per_beat)


def mix_down(tracks: list[dict], generations_dir: Path, bpm: float) -> AudioSegment:
    """Mix all tracks into a single AudioSegment.

    Respects mute/solo and volume. Peak-normalizes to -1 dBFS.
    """
    # Determine which tracks to include
    any_solo = any(t.get("solo", False) for t in tracks)
    active_tracks = []
    for t in tracks:
        if t.get("muted", False):
            continue
        if any_solo and not t.get("solo", False):
            continue
        active_tracks.append(t)

    if not active_tracks:
        # Return 1 second of silence
        return AudioSegment.silent(duration=1000)

    # Find total duration needed
    max_end_ms = 0
    for track in active_tracks:
        volume = track.get("volume", 1.0)
        for clip in track.get("clips", []):
            filepath = generations_dir / clip["file"]
            if not filepath.exists():
                continue
            audio = AudioSegment.from_wav(str(filepath))
            start_ms = bar_to_ms(clip["startBar"], bpm)
            end_ms = start_ms + len(audio)
            if end_ms > max_end_ms:
                max_end_ms = end_ms

    # Create silent base
    mix = AudioSegment.silent(duration=max_end_ms, frame_rate=44100)

    # Overlay each track
    for track in active_tracks:
        volume = track.get("volume", 1.0)
        volume_db = 20 * np.log10(max(volume, 0.001))  # Convert linear to dB
        for clip in track.get("clips", []):
            filepath = generations_dir / clip["file"]
            if not filepath.exists():
                continue
            audio = AudioSegment.from_wav(str(filepath))
            # Ensure stereo
            if audio.channels == 1:
                audio = audio.set_channels(2)
            # Resample to 44100 if needed
            if audio.frame_rate != 44100:
                audio = audio.set_frame_rate(44100)
            # Apply volume
            audio = audio + volume_db
            start_ms = bar_to_ms(clip["startBar"], bpm)
            mix = mix.overlay(audio, position=start_ms)

    # Peak normalize to -1 dBFS
    if mix.dBFS != float("-inf"):
        change_in_dBFS = -1.0 - mix.max_dBFS
        mix = mix.apply_gain(change_in_dBFS)

    return mix
```

- [ ] **Step 4: Implement export route**

Create `composer/server/routes/export.py`:

```python
import io

from fastapi import APIRouter, Body
from fastapi.responses import StreamingResponse

from composer.server.config import GENERATIONS_DIR
from composer.server.services.audio import mix_down

router = APIRouter(prefix="/api", tags=["export"])


@router.post("/export")
def export_mix(project: dict = Body(...)):
    tracks = project.get("tracks", [])
    bpm = project.get("bpm", 120)

    mix = mix_down(tracks, GENERATIONS_DIR, bpm)

    buf = io.BytesIO()
    mix.export(buf, format="wav")
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="audio/wav",
        headers={"Content-Disposition": 'attachment; filename="mix.wav"'}
    )
```

- [ ] **Step 5: Register router in app.py**

```python
from composer.server.routes.export import router as export_router
app.include_router(export_router)
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
uv run pytest composer/tests/test_export.py -v
```

- [ ] **Step 7: Commit**

```bash
git add composer/
git commit -m "feat: add mix export API with volume, mute/solo, and normalization"
```

---

## Task 6: Time-Stretch API

**Files:**
- Create: `composer/server/routes/stretch.py`
- Create: `composer/tests/test_stretch.py`
- Modify: `composer/server/services/audio.py`
- Modify: `composer/server/app.py`

- [ ] **Step 1: Write the failing test**

Create `composer/tests/test_stretch.py`:

```python
import pytest
from conftest import create_test_wav


@pytest.fixture(autouse=True)
def setup_stretch_clips(tmp_generations):
    create_test_wav(tmp_generations / "clip_100bpm.wav", duration_s=2.0, value=1000)


def test_stretch_creates_new_file(client, tmp_generations):
    resp = client.post("/api/stretch", json={
        "filename": "clip_100bpm.wav",
        "original_bpm": 100,
        "target_bpm": 120
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "output_filename" in data
    assert (tmp_generations / data["output_filename"]).exists()


def test_stretch_missing_file_returns_404(client):
    resp = client.post("/api/stretch", json={
        "filename": "nonexistent.wav",
        "original_bpm": 100,
        "target_bpm": 120
    })
    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest composer/tests/test_stretch.py -v
```

- [ ] **Step 3: Add time_stretch function to audio service**

Add to `composer/server/services/audio.py`:

```python
import soundfile as sf


def time_stretch_clip(filepath: Path, original_bpm: float, target_bpm: float, output_dir: Path) -> Path:
    """Time-stretch a WAV file to match target BPM.

    Uses librosa phase vocoder (works on Windows, no SoX/rubberband needed).
    Returns the path to the new stretched file.
    """
    y, sr = librosa.load(str(filepath), sr=None, mono=False)

    # librosa time_stretch rate: >1 = faster, <1 = slower
    rate = target_bpm / original_bpm

    # Handle mono and stereo
    if y.ndim == 1:
        stretched = librosa.effects.time_stretch(y, rate=rate)
    else:
        # Stretch each channel
        channels = [librosa.effects.time_stretch(y[ch], rate=rate) for ch in range(y.shape[0])]
        stretched = np.stack(channels)

    output_name = f"{filepath.stem}_stretched_{int(target_bpm)}bpm.wav"
    output_path = output_dir / output_name
    sf.write(str(output_path), stretched.T if stretched.ndim > 1 else stretched, sr)
    return output_path
```

Note: `librosa.effects.time_stretch` uses a phase vocoder internally (no external dependencies). The `soundfile` library (already installed as a librosa dependency) writes the output. If `librosa.effects.time_stretch` is unavailable in the installed version, use `librosa.effects.time_stretch(y, rate=rate)` with explicit `rate` kwarg (required in librosa 0.10.x).

- [ ] **Step 4: Implement stretch route**

Create `composer/server/routes/stretch.py`:

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from composer.server.config import GENERATIONS_DIR
from composer.server.services.audio import time_stretch_clip

router = APIRouter(prefix="/api", tags=["stretch"])


class StretchRequest(BaseModel):
    filename: str
    original_bpm: float
    target_bpm: float


@router.post("/stretch")
def stretch_clip(req: StretchRequest):
    filepath = GENERATIONS_DIR / req.filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")

    output_path = time_stretch_clip(filepath, req.original_bpm, req.target_bpm, GENERATIONS_DIR)
    return {"output_filename": output_path.name, "target_bpm": req.target_bpm}
```

- [ ] **Step 5: Register router in app.py**

```python
from composer.server.routes.stretch import router as stretch_router
app.include_router(stretch_router)
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
uv run pytest composer/tests/test_stretch.py -v
```

- [ ] **Step 7: Commit**

```bash
git add composer/
git commit -m "feat: add time-stretch API using librosa phase vocoder"
```

---

## Task 7: Frontend Scaffolding & Vite Setup

**Files:**
- Create: `composer/package.json`
- Create: `composer/vite.config.js`
- Create: `composer/index.html`
- Create: `composer/src/main.js`
- Create: `composer/src/style.css`
- Create: `composer/src/api.js`

- [ ] **Step 1: Initialize npm project**

```bash
cd e:/dev/GitHub/Musica1/composer
npm init -y
npm install waveform-playlist tone
npm install -D vite
```

- [ ] **Step 2: Create Vite config**

Create `composer/vite.config.js`:

```js
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 3: Create the HTML shell**

Create `composer/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Composer — RC Stable Audio Tools</title>
  <link rel="stylesheet" href="/src/style.css" />
</head>
<body>
  <div id="app">
    <!-- Transport bar -->
    <header id="transport">
      <div class="transport-left">
        <span class="logo">COMPOSER</span>
        <button id="btn-play">&#9654; Play</button>
        <button id="btn-stop">&#9632; Stop</button>
        <label><input type="checkbox" id="chk-loop"> Loop</label>
      </div>
      <div class="transport-center">
        <label>BPM: <input type="number" id="input-bpm" value="120" min="40" max="300" step="1"></label>
        <label>Key:
          <select id="select-key-note">
            <option>C</option><option>C#</option><option>D</option><option>D#</option>
            <option>E</option><option>F</option><option>F#</option><option>G</option>
            <option>G#</option><option>A</option><option>A#</option><option>B</option>
          </select>
          <select id="select-key-scale">
            <option>minor</option><option>major</option>
          </select>
        </label>
        <label>Master: <input type="range" id="input-master-vol" min="0" max="1" step="0.01" value="1"></label>
      </div>
      <div class="transport-right">
        <button id="btn-export">Export Mix</button>
        <button id="btn-save">Save Project</button>
        <button id="btn-load">Load Project</button>
      </div>
    </header>

    <div id="main">
      <!-- Sidebar -->
      <aside id="sidebar">
        <div id="generate-panel">
          <h3>Generate</h3>
          <textarea id="gen-prompt" placeholder="Enter prompt... (e.g. funky bass groove)" rows="3"></textarea>
          <div class="gen-controls">
            <label>Bars: <select id="gen-bars"><option>4</option><option>8</option></select></label>
            <label>Steps: <input type="number" id="gen-steps" value="100" min="10" max="250" step="10"></label>
          </div>
          <button id="btn-generate">Generate</button>
          <div id="gen-status"></div>
        </div>
        <div id="clip-library">
          <h3>Clip Library</h3>
          <button id="btn-refresh-clips">Refresh</button>
          <ul id="clip-list"></ul>
        </div>
      </aside>

      <!-- Timeline -->
      <section id="timeline-container">
        <div id="track-controls"></div>
        <div id="playlist-container"></div>
      </section>
    </div>
  </div>

  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create the CSS**

Create `composer/src/style.css`:

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg-dark: #1a1a2e;
  --bg-mid: #16213e;
  --bg-track: #1e1e3a;
  --text: #e0e0e0;
  --accent: #e94560;
  --accent2: #533483;
  --accent3: #0f3460;
  --border: #333;
}

body {
  background: var(--bg-dark);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  height: 100vh;
  overflow: hidden;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

/* Transport */
#transport {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--bg-mid);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.transport-left, .transport-center, .transport-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo {
  color: var(--accent);
  font-weight: bold;
  font-size: 16px;
  margin-right: 8px;
}

button {
  background: var(--accent3);
  color: var(--text);
  border: none;
  padding: 5px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

button:hover { opacity: 0.85; }

#btn-generate { background: var(--accent); width: 100%; padding: 8px; }
#btn-export { background: var(--accent2); }

input[type="number"], select, textarea {
  background: var(--bg-dark);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 12px;
}

textarea { width: 100%; resize: vertical; }

/* Main layout */
#main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Sidebar */
#sidebar {
  width: 220px;
  background: var(--bg-mid);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex-shrink: 0;
}

#generate-panel, #clip-library {
  padding: 12px;
  border-bottom: 1px solid var(--border);
}

#generate-panel h3, #clip-library h3 {
  color: var(--accent);
  font-size: 12px;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.gen-controls {
  display: flex;
  gap: 8px;
  margin: 8px 0;
}

#clip-list {
  list-style: none;
  max-height: 400px;
  overflow-y: auto;
}

#clip-list li {
  padding: 6px 8px;
  background: var(--bg-dark);
  border: 1px solid var(--border);
  border-radius: 4px;
  margin-bottom: 4px;
  cursor: grab;
  font-size: 11px;
  display: flex;
  justify-content: space-between;
}

#clip-list li:hover {
  border-color: var(--accent);
}

/* Timeline */
#timeline-container {
  flex: 1;
  overflow: auto;
  position: relative;
}

#playlist-container {
  min-height: 300px;
}

/* waveform-playlist overrides */
.playlist .channel-wrapper .waveform {
  background: var(--bg-track) !important;
}
```

- [ ] **Step 5: Create the API wrapper**

Create `composer/src/api.js`:

```js
const BASE = '';  // Same origin during dev (proxied by Vite)

export async function fetchClips() {
  const res = await fetch(`${BASE}/api/clips`);
  return res.json();
}

export async function detectBpm(filename) {
  const res = await fetch(`${BASE}/api/bpm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  });
  return res.json();
}

export async function generateClip({ prompt, bars, bpm, key, seed, steps }) {
  const res = await fetch(`${BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, bars, bpm, key, seed, steps }),
  });
  return res.json();
}

export async function saveProject(name, project) {
  const res = await fetch(`${BASE}/api/project/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
  return res.json();
}

export async function loadProject(name) {
  const res = await fetch(`${BASE}/api/project/${encodeURIComponent(name)}`);
  return res.json();
}

export async function listProjects() {
  const res = await fetch(`${BASE}/api/project`);
  return res.json();
}

export async function exportMix(project) {
  const res = await fetch(`${BASE}/api/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
  return res.blob();
}

export async function stretchClip(filename, originalBpm, targetBpm) {
  const res = await fetch(`${BASE}/api/stretch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, original_bpm: originalBpm, target_bpm: targetBpm }),
  });
  return res.json();
}

export function clipUrl(filename) {
  return `${BASE}/api/clips/${encodeURIComponent(filename)}`;
}
```

- [ ] **Step 6: Create main.js entry point (minimal — just verifies the app loads)**

Create `composer/src/main.js`:

```js
import './style.css';
import { fetchClips } from './api.js';

console.log('Composer app loaded');

// Verify API connection
fetchClips()
  .then(clips => console.log(`Found ${clips.length} clips`))
  .catch(err => console.warn('API not available:', err.message));
```

- [ ] **Step 7: Test the dev server starts**

```bash
cd e:/dev/GitHub/Musica1/composer && npx vite --open
# Expected: Opens browser at http://localhost:3000 with the dark UI shell
```

- [ ] **Step 8: Commit**

```bash
cd e:/dev/GitHub/Musica1
git add composer/package.json composer/package-lock.json composer/vite.config.js composer/index.html composer/src/
echo "node_modules/" >> composer/.gitignore
echo "dist/" >> composer/.gitignore
git add composer/.gitignore
git commit -m "feat: scaffold composer frontend with Vite, HTML shell, and API wrapper"
```

---

## Task 8: Clip Library Sidebar

**Files:**
- Create: `composer/src/sidebar.js`
- Modify: `composer/src/main.js`

- [ ] **Step 1: Implement sidebar with clip library**

Create `composer/src/sidebar.js`:

```js
import { fetchClips, clipUrl, generateClip } from './api.js';

let onClipDragStart = null;

export function setClipDragHandler(handler) {
  onClipDragStart = handler;
}

export async function refreshClipLibrary() {
  const listEl = document.getElementById('clip-list');
  listEl.innerHTML = '<li>Loading...</li>';

  try {
    const clips = await fetchClips();
    listEl.innerHTML = '';

    if (clips.length === 0) {
      listEl.innerHTML = '<li style="color:#666">No clips yet. Generate one!</li>';
      return;
    }

    for (const clip of clips) {
      const li = document.createElement('li');
      li.draggable = true;
      li.dataset.filename = clip.filename;
      li.dataset.duration = clip.duration;

      const name = document.createElement('span');
      name.textContent = clip.filename.length > 25
        ? clip.filename.slice(0, 22) + '...'
        : clip.filename;
      name.title = clip.filename;

      const dur = document.createElement('span');
      dur.textContent = `${clip.duration.toFixed(1)}s`;
      dur.style.color = '#888';

      li.appendChild(name);
      li.appendChild(dur);

      li.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/json', JSON.stringify(clip));
        e.dataTransfer.effectAllowed = 'copy';
      });

      listEl.appendChild(li);
    }
  } catch (err) {
    listEl.innerHTML = '<li style="color:#e94560">Failed to load clips</li>';
  }
}

export function initGeneratePanel(projectState) {
  const btn = document.getElementById('btn-generate');
  const status = document.getElementById('gen-status');

  btn.addEventListener('click', async () => {
    const prompt = document.getElementById('gen-prompt').value.trim();
    if (!prompt) {
      status.textContent = 'Enter a prompt first';
      return;
    }

    const bars = parseInt(document.getElementById('gen-bars').value);
    const steps = parseInt(document.getElementById('gen-steps').value);
    const bpm = projectState.bpm;
    const key = `${projectState.keyNote} ${projectState.keyScale}`;

    btn.disabled = true;
    status.textContent = 'Generating...';

    try {
      const result = await generateClip({ prompt, bars, bpm, key, seed: -1, steps });
      status.textContent = result.error || 'Done! Clip added to library.';
      await refreshClipLibrary();
    } catch (err) {
      status.textContent = `Error: ${err.message}`;
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('btn-refresh-clips').addEventListener('click', refreshClipLibrary);
}
```

- [ ] **Step 2: Update main.js to initialize sidebar**

Replace `composer/src/main.js` with:

```js
import './style.css';
import { refreshClipLibrary, initGeneratePanel } from './sidebar.js';

const projectState = {
  version: 1,
  name: 'untitled',
  bpm: 120,
  keyNote: 'C',
  keyScale: 'minor',
  tracks: [],
};

// Sync BPM/key inputs with state
document.getElementById('input-bpm').addEventListener('change', (e) => {
  projectState.bpm = parseInt(e.target.value);
});
document.getElementById('select-key-note').addEventListener('change', (e) => {
  projectState.keyNote = e.target.value;
});
document.getElementById('select-key-scale').addEventListener('change', (e) => {
  projectState.keyScale = e.target.value;
});

// Init
initGeneratePanel(projectState);
refreshClipLibrary();

console.log('Composer initialized');
```

- [ ] **Step 3: Test in browser**

```bash
cd e:/dev/GitHub/Musica1/composer && npx vite
# Open http://localhost:3000
# Verify: sidebar shows clips from /generations/, refresh button works
```

- [ ] **Step 4: Commit**

```bash
cd e:/dev/GitHub/Musica1
git add composer/src/
git commit -m "feat: add clip library sidebar with drag support and generate panel"
```

---

## Task 9: Timeline with waveform-playlist + Tone.js Transport

**Files:**
- Create: `composer/src/timeline.js`
- Create: `composer/src/transport.js`
- Modify: `composer/src/main.js`

- [ ] **Step 1: Implement transport module (Tone.js master clock)**

Create `composer/src/transport.js`:

```js
import * as Tone from 'tone';

let isPlaying = false;
let onPlayCallback = null;
let onStopCallback = null;

export function initTransport(bpm) {
  Tone.getTransport().bpm.value = bpm;
  Tone.getTransport().loop = false;
}

export function setBpm(bpm) {
  Tone.getTransport().bpm.value = bpm;
}

export function setLoop(enabled, startTime = 0, endTime = 0) {
  const transport = Tone.getTransport();
  transport.loop = enabled;
  if (enabled && endTime > startTime) {
    transport.loopStart = startTime;
    transport.loopEnd = endTime;
  }
}

export function onPlay(callback) { onPlayCallback = callback; }
export function onStop(callback) { onStopCallback = callback; }

export async function play() {
  await Tone.start();  // Required: unlock AudioContext on user gesture
  if (onPlayCallback) onPlayCallback();
  isPlaying = true;
}

export function stop() {
  if (onStopCallback) onStopCallback();
  isPlaying = false;
}

export function getIsPlaying() { return isPlaying; }

export function barToSeconds(bar, bpm) {
  const beatsPerBar = 4;  // 4/4 time
  return (bar - 1) * beatsPerBar * (60 / bpm);
}
```

- [ ] **Step 2: Implement timeline module**

Create `composer/src/timeline.js`:

```js
import WaveformPlaylist from 'waveform-playlist';
import { clipUrl } from './api.js';
import { onPlay, onStop } from './transport.js';

let playlist = null;
let ee = null;

export async function initTimeline(projectState) {
  const container = document.getElementById('playlist-container');

  playlist = WaveformPlaylist.init({
    container,
    timescale: true,
    mono: false,
    exclSolo: true,
    samplesPerPixel: 1000,
    waveHeight: 80,
    isAutomaticScroll: true,
    seekStyle: 'line',
    colors: {
      waveOutlineColor: '#e94560',
      timeColor: '#e0e0e0',
      fadeColor: 'rgba(233,69,96,0.5)',
    },
    controls: {
      show: true,
      width: 180,
    },
    zoomLevels: [250, 500, 1000, 2000, 4000],
  });

  ee = playlist.getEventEmitter();

  // Wire Tone.js transport to waveform-playlist playback
  onPlay(() => { if (ee) ee.emit('play'); });
  onStop(() => { if (ee) ee.emit('stop'); });

  return playlist;
}

export function getEventEmitter() { return ee; }

export function addTrackToTimeline(filename, startTime = 0) {
  if (!ee) return;
  ee.emit('newtrack', {
    src: clipUrl(filename),
    name: filename.replace('.wav', ''),
    start: startTime,
    gain: 1,
  });
}
```

- [ ] **Step 3: Update main.js to initialize timeline and transport**

Update `composer/src/main.js`:

```js
import './style.css';
import { refreshClipLibrary, initGeneratePanel } from './sidebar.js';
import { initTimeline, addTrackToTimeline } from './timeline.js';
import { initTransport, setBpm, play, stop, setLoop } from './transport.js';

const projectState = {
  version: 1,
  name: 'untitled',
  bpm: 120,
  keyNote: 'C',
  keyScale: 'minor',
  tracks: [],
};

// Sync BPM/key inputs with state
document.getElementById('input-bpm').addEventListener('change', (e) => {
  projectState.bpm = parseInt(e.target.value);
  setBpm(projectState.bpm);
});
document.getElementById('select-key-note').addEventListener('change', (e) => {
  projectState.keyNote = e.target.value;
});
document.getElementById('select-key-scale').addEventListener('change', (e) => {
  projectState.keyScale = e.target.value;
});

// Transport buttons
document.getElementById('btn-play').addEventListener('click', play);
document.getElementById('btn-stop').addEventListener('click', stop);
document.getElementById('chk-loop').addEventListener('change', (e) => {
  setLoop(e.target.checked);
});

// Drop zone: allow dropping clips onto timeline
const timelineContainer = document.getElementById('timeline-container');
timelineContainer.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});

timelineContainer.addEventListener('drop', (e) => {
  e.preventDefault();
  try {
    const clip = JSON.parse(e.dataTransfer.getData('application/json'));
    addTrackToTimeline(clip.filename);
  } catch (err) {
    console.error('Drop failed:', err);
  }
});

// Init
async function init() {
  initTransport(projectState.bpm);
  await initTimeline(projectState);
  initGeneratePanel(projectState);
  await refreshClipLibrary();
  console.log('Composer initialized');
}

init();
```

- [ ] **Step 3: Test in browser**

```bash
cd e:/dev/GitHub/Musica1/composer && npx vite
# Open http://localhost:3000
# With FastAPI running on port 8000:
# 1. Verify timeline container renders
# 2. Drag a clip from sidebar onto the timeline
# 3. Click Play — verify audio plays
# 4. Click Stop — verify audio stops
```

- [ ] **Step 4: Commit**

```bash
cd e:/dev/GitHub/Musica1
git add composer/src/
git commit -m "feat: add waveform-playlist timeline with drag-and-drop and transport controls"
```

---

## Task 10: Project Save/Load & Export in Frontend

**Files:**
- Create: `composer/src/project.js`
- Modify: `composer/src/main.js`

- [ ] **Step 1: Implement project save/load module**

Create `composer/src/project.js`:

```js
import { saveProject, loadProject, listProjects, exportMix } from './api.js';

export function initProjectControls(projectState, getTimelineState) {
  document.getElementById('btn-save').addEventListener('click', async () => {
    const name = prompt('Project name:', projectState.name);
    if (!name) return;
    projectState.name = name;

    const fullProject = {
      ...projectState,
      key: `${projectState.keyNote} ${projectState.keyScale}`,
    };

    try {
      await saveProject(name, fullProject);
      alert(`Project "${name}" saved.`);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    }
  });

  document.getElementById('btn-load').addEventListener('click', async () => {
    try {
      const projects = await listProjects();
      if (projects.length === 0) {
        alert('No saved projects.');
        return;
      }
      const name = prompt(`Load project:\n${projects.join('\n')}`);
      if (!name) return;

      const data = await loadProject(name);
      Object.assign(projectState, data);

      // Sync UI
      document.getElementById('input-bpm').value = projectState.bpm;
      if (data.key) {
        const [note, scale] = data.key.split(' ');
        document.getElementById('select-key-note').value = note;
        document.getElementById('select-key-scale').value = scale;
        projectState.keyNote = note;
        projectState.keyScale = scale;
      }

      alert(`Project "${name}" loaded. Reload the page to apply track layout.`);
    } catch (err) {
      alert(`Load failed: ${err.message}`);
    }
  });

  document.getElementById('btn-export').addEventListener('click', async () => {
    const fullProject = {
      ...projectState,
      key: `${projectState.keyNote} ${projectState.keyScale}`,
    };

    try {
      document.getElementById('btn-export').textContent = 'Exporting...';
      const blob = await exportMix(fullProject);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectState.name || 'mix'}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    } finally {
      document.getElementById('btn-export').textContent = 'Export Mix';
    }
  });
}
```

- [ ] **Step 2: Wire into main.js**

Add to `composer/src/main.js` after imports:

```js
import { initProjectControls } from './project.js';
```

And in the `init()` function, after `initTimeline`:

```js
initProjectControls(projectState, null);
```

- [ ] **Step 3: Test in browser**

```bash
# With both FastAPI (port 8000) and Vite (port 3000) running:
# 1. Click Save — enter project name — verify no errors
# 2. Click Load — see project listed — load it
# 3. Add some clips to timeline, click Export Mix — verify WAV downloads
```

- [ ] **Step 4: Commit**

```bash
cd e:/dev/GitHub/Musica1
git add composer/src/
git commit -m "feat: add project save/load and mix export to frontend"
```

---

## Task 11: Gradio "Send to Composer" Button

**Files:**
- Modify: `stable_audio_tools/interface/gradio.py:917`

- [ ] **Step 1: Add the Send to Composer button**

In `stable_audio_tools/interface/gradio.py`, after line 917 (`send_to_init_button = gr.Button("Send to Style Transfer", scale=1)`), add:

```python
            send_to_composer_button = gr.Button("Send to Composer", scale=1)
```

- [ ] **Step 2: Wire the button with JS to POST to composer**

After the `send_to_init_button.click(...)` line (line 997), add:

```python
    send_to_composer_button.click(
        fn=lambda audio: audio,
        inputs=[audio_output],
        outputs=[audio_output],
        _js="""
        (audio) => {
            if (audio) {
                const filename = audio.split('/').pop().split('\\\\').pop();
                fetch('http://localhost:8000/api/clips/notify', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({file: filename})
                }).then(() => {
                    alert('Sent to Composer!');
                }).catch(() => {
                    alert('Composer not running. Start it on port 8000.');
                });
            }
            return audio;
        }
        """
    )
```

Note: `outputs=[audio_output]` must match the lambda return value. The button simply passes audio through unchanged while the `_js` sends the notification.

- [ ] **Step 3: Test manually**

```bash
# 1. Start Gradio: uv run python run_gradio.py
# 2. Start Composer: uv run python composer/server/app.py
# 3. Generate audio in Gradio
# 4. Click "Send to Composer" — verify alert says "Sent to Composer!"
```

- [ ] **Step 4: Commit**

```bash
cd e:/dev/GitHub/Musica1
git add stable_audio_tools/interface/gradio.py
git commit -m "feat: add Send to Composer button in Gradio UI"
```

---

## Task 12: Generate Proxy Route

**Files:**
- Create: `composer/server/routes/generate.py`
- Create: `composer/server/services/gradio_proxy.py`
- Create: `composer/tests/test_generate.py`
- Modify: `composer/server/app.py`

- [ ] **Step 1: Write the failing test (mocked Gradio client)**

Create `composer/tests/test_generate.py`:

```python
from unittest.mock import patch, MagicMock
import pytest


def test_generate_returns_audio_path(client):
    mock_result = ("/path/to/audio.wav", [], None, None)
    with patch("composer.server.services.gradio_proxy.Client") as MockClient:
        MockClient.return_value.predict.return_value = mock_result
        resp = client.post("/api/generate", json={
            "prompt": "test drums",
            "bars": 4,
            "bpm": 120,
            "key": "C minor",
            "steps": 10
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "audio_path" in data


def test_generate_handles_connection_error(client):
    with patch("composer.server.services.gradio_proxy.Client") as MockClient:
        MockClient.side_effect = ConnectionError("Connection refused")
        resp = client.post("/api/generate", json={
            "prompt": "test",
            "bars": 4,
            "bpm": 120,
            "key": "C minor"
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "error"
    assert "7860" in data["error"]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest composer/tests/test_generate.py -v
```

- [ ] **Step 3: Install gradio_client**

```bash
uv pip install gradio_client
```

- [ ] **Step 4: Implement Gradio proxy service**

Create `composer/server/services/gradio_proxy.py`.

The Gradio API parameter order (from `gradio.py` lines 965-983) is:
`prompt, negative_prompt, bars, bpm, note, scale, cfg_scale, steps, preview_every, seed, sampler_type, sigma_min, sigma_max, cfg_rescale, init_audio_checkbox, init_audio_input, init_noise_level`

```python
from gradio_client import Client


def generate_audio(
    prompt: str,
    bars: int = 4,
    bpm: int = 120,
    key_note: str = "C",
    key_scale: str = "minor",
    seed: int = -1,
    steps: int = 100,
    gradio_url: str = "http://localhost:7860",
    auth: tuple | None = None,
) -> dict:
    """Call the Gradio generation API and return result info."""
    try:
        client = Client(gradio_url, auth=auth)
        result = client.predict(
            prompt,           # prompt
            "",               # negative_prompt
            bars,             # bars
            bpm,              # bpm
            key_note,         # note
            key_scale,        # scale
            7.0,              # cfg_scale
            steps,            # steps
            0,                # preview_every
            seed,             # seed
            "dpmpp-3m-sde",   # sampler_type
            0.03,             # sigma_min
            1000,             # sigma_max
            0.0,              # cfg_rescale
            False,            # init_audio_checkbox
            None,             # init_audio_input
            0.9,              # init_noise_level
            api_name="/generate"
        )
        # result is a tuple: (audio_path, spectrograms, piano_roll, midi_path)
        audio_path = result[0] if isinstance(result, (list, tuple)) else result
        return {"status": "ok", "audio_path": str(audio_path)}
    except Exception as e:
        return {"status": "error", "error": str(e)}
```

- [ ] **Step 5: Implement generate route**

Create `composer/server/routes/generate.py`:

```python
from fastapi import APIRouter
from pydantic import BaseModel

from composer.server.services.gradio_proxy import generate_audio

router = APIRouter(prefix="/api", tags=["generate"])


class GenerateRequest(BaseModel):
    prompt: str
    bars: int = 4
    bpm: int = 120
    key: str = "C minor"
    seed: int = -1
    steps: int = 100


@router.post("/generate")
def generate(req: GenerateRequest):
    parts = req.key.split(" ", 1)
    key_note = parts[0] if parts else "C"
    key_scale = parts[1] if len(parts) > 1 else "minor"

    result = generate_audio(
        prompt=req.prompt,
        bars=req.bars,
        bpm=req.bpm,
        key_note=key_note,
        key_scale=key_scale,
        seed=req.seed,
        steps=req.steps,
    )

    if result["status"] == "error":
        if "connect" in result.get("error", "").lower():
            result["error"] = "Generation service not available — start the Gradio app on port 7860"

    return result
```

- [ ] **Step 6: Register router in app.py**

Add to `composer/server/app.py`:

```python
from composer.server.routes.generate import router as generate_router
app.include_router(generate_router)
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
uv run pytest composer/tests/test_generate.py -v
```

- [ ] **Step 8: Commit**

```bash
cd e:/dev/GitHub/Musica1
git add composer/
git commit -m "feat: add Gradio generation proxy route with correct API parameter order"
```

---

## Task 13: Static File Serving & Production Build

**Files:**
- Modify: `composer/server/app.py`
- Create: `composer/start.sh` (launch script)

**Important:** The static file mount MUST be the last thing registered in `app.py` so API routes take precedence over the catch-all.

- [ ] **Step 1: Build the frontend**

```bash
cd e:/dev/GitHub/Musica1/composer && npx vite build
# Expected: creates composer/dist/ with built files
```

- [ ] **Step 2: Add static file serving to FastAPI**

Add to the **very end** of `composer/server/app.py` (after ALL routers are registered):

```python
from pathlib import Path
from fastapi.staticfiles import StaticFiles

# Serve built frontend — MUST be last so API routes take precedence
dist_dir = Path(__file__).parent.parent / "dist"
if dist_dir.exists():
    app.mount("/", StaticFiles(directory=str(dist_dir), html=True), name="frontend")
```

- [ ] **Step 3: Create a launch script**

Create `composer/start.sh`:

```bash
#!/bin/bash
# Launch the Composer backend (serves both API and frontend)
cd "$(dirname "$0")"

# Build frontend if dist doesn't exist
if [ ! -d "dist" ]; then
  echo "Building frontend..."
  npm run build
fi

echo "Starting Composer on http://localhost:8000"
cd .. && uv run python composer/server/app.py
```

- [ ] **Step 4: Add build script to package.json**

Add to `composer/package.json` scripts:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
}
```

- [ ] **Step 5: Add projects/ to .gitignore**

```bash
echo "projects/" >> e:/dev/GitHub/Musica1/.gitignore
```

- [ ] **Step 6: Test production mode**

```bash
cd e:/dev/GitHub/Musica1 && uv run python composer/server/app.py
# Open http://localhost:8000 — should serve the full composer app
```

- [ ] **Step 7: Commit**

```bash
cd e:/dev/GitHub/Musica1
git add composer/ .gitignore
git commit -m "feat: add production build, static file serving, and launch script"
```

---

## Task 14: Integration Testing & Polish

**Files:**
- Modify: various files for fixes discovered during testing

- [ ] **Step 1: Run all backend tests**

```bash
cd e:/dev/GitHub/Musica1 && uv run pytest composer/tests/ -v
# Expected: all tests pass
```

- [ ] **Step 2: Manual end-to-end test**

```bash
# Terminal 1: Start Gradio
uv run python run_gradio.py

# Terminal 2: Start Composer backend
uv run python composer/server/app.py

# Terminal 3: Start Composer frontend (dev mode)
cd composer && npx vite
```

Test checklist:
1. Open http://localhost:3000 — composer loads with dark theme
2. Clip library shows WAVs from `/generations/`
3. Drag a clip onto the timeline — waveform appears
4. Click Play — audio plays
5. Click Stop — audio stops
6. Generate a clip via sidebar — status shows progress, clip appears in library
7. In Gradio (port 7860), generate audio, click "Send to Composer" — alert confirms
8. Save project — enter name — no errors
9. Load project — data restores
10. Export Mix — WAV file downloads

- [ ] **Step 3: Fix any issues discovered during testing**

Address bugs found in step 2. Common issues to watch for:
- CORS errors between Gradio and Composer
- waveform-playlist CSS conflicts
- Audio file paths not resolving correctly
- Gradio API parameter mismatch

- [ ] **Step 4: Final commit**

```bash
cd e:/dev/GitHub/Musica1
git add -A
git commit -m "fix: integration fixes from end-to-end testing"
```
