from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from composer.server.services.gradio_proxy import generate_audio

router = APIRouter(prefix="/api", tags=["generate"])


class GenerateRequest(BaseModel):
    prompt: str
    bars: int = 4
    bpm: int = 120
    key: str = "C minor"
    seed: int = -1
    steps: int = 100
    cfg_scale: float = 7.0
    sampler_type: str = "dpmpp-3m-sde"
    sigma_min: float = 0.03
    sigma_max: float = 500.0
    cfg_rescale: float = 0.0
    negative_prompt: str = ""


@router.post("/generate")
def generate(req: GenerateRequest):
    parts = req.key.split(" ", 1)
    key_note = parts[0] if parts else "C"
    key_scale = parts[1] if len(parts) > 1 else "minor"

    result = generate_audio(
        prompt=req.prompt,
        negative_prompt=req.negative_prompt,
        bars=req.bars,
        bpm=req.bpm,
        key_note=key_note,
        key_scale=key_scale,
        seed=req.seed,
        steps=req.steps,
        cfg_scale=req.cfg_scale,
        sampler_type=req.sampler_type,
        sigma_min=req.sigma_min,
        sigma_max=req.sigma_max,
        cfg_rescale=req.cfg_rescale,
    )

    if result["status"] == "error":
        if "connect" in result.get("error", "").lower():
            result["error"] = "Generation service not available — start the Gradio app on port 7860"

    return result
