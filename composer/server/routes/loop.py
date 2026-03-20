from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import composer.server.config as _config
from composer.server.services.audio import loop_clip

router = APIRouter(prefix="/api", tags=["loop"])

class LoopRequest(BaseModel):
    filename: str
    repeat_count: int = 2

@router.post("/loop")
def loop(req: LoopRequest):
    filepath = _config.GENERATIONS_DIR / req.filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    output_path = loop_clip(filepath, req.repeat_count, _config.GENERATIONS_DIR)
    return {"output_filename": output_path.name, "repeat_count": req.repeat_count}
