import io

import composer.server.config as _config
from fastapi import APIRouter, Body
from fastapi.responses import StreamingResponse

from composer.server.services.audio import mix_down

router = APIRouter(prefix="/api", tags=["export"])


@router.post("/export")
def export_mix(project: dict = Body(...)):
    tracks = project.get("tracks", [])
    bpm = project.get("bpm", 120)
    mix = mix_down(tracks, _config.GENERATIONS_DIR, bpm)
    buf = io.BytesIO()
    mix.export(buf, format="wav")
    buf.seek(0)
    return StreamingResponse(buf, media_type="audio/wav", headers={"Content-Disposition": 'attachment; filename="mix.wav"'})
