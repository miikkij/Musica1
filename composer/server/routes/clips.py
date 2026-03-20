import wave
from pathlib import Path

import composer.server.config as _config
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter(prefix="/api/clips", tags=["clips"])

_notify_queue: list[str] = []


def _wav_metadata(filepath: Path) -> dict | None:
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
    generations_dir = _config.GENERATIONS_DIR
    clips = []
    if not generations_dir.exists():
        return clips
    for f in sorted(generations_dir.iterdir()):
        if f.suffix.lower() == ".wav" and f.is_file():
            meta = _wav_metadata(f)
            if meta:
                clips.append(meta)
    return clips


@router.get("/{filename}")
def serve_clip(filename: str):
    filepath = _config.GENERATIONS_DIR / filename
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(status_code=404, detail="Clip not found")
    return FileResponse(filepath, media_type="audio/wav")


@router.post("/notify")
def notify_new_clip(file: str = ""):
    _notify_queue.append(file)
    return {"status": "ok", "file": file}
