import wave
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from composer.server.config import GENERATIONS_DIR

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
