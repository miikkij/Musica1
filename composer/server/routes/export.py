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
    return StreamingResponse(buf, media_type="audio/wav", headers={"Content-Disposition": 'attachment; filename="mix.wav"'})
