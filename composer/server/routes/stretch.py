import composer.server.config as _config
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from composer.server.services.audio import time_stretch_clip

router = APIRouter(prefix="/api", tags=["stretch"])


class StretchRequest(BaseModel):
    filename: str
    original_bpm: float
    target_bpm: float


@router.post("/stretch")
def stretch_clip(req: StretchRequest):
    generations_dir = _config.GENERATIONS_DIR
    filepath = generations_dir / req.filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    output_path = time_stretch_clip(filepath, req.original_bpm, req.target_bpm, generations_dir)
    return {"output_filename": output_path.name, "target_bpm": req.target_bpm}
