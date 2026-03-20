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
