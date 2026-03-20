from gradio_client import Client


def generate_audio(
    prompt: str,
    negative_prompt: str = "",
    bars: int = 4,
    bpm: int = 120,
    key_note: str = "C",
    key_scale: str = "minor",
    seed: int = -1,
    steps: int = 100,
    cfg_scale: float = 7.0,
    sampler_type: str = "dpmpp-3m-sde",
    sigma_min: float = 0.03,
    sigma_max: float = 500.0,
    cfg_rescale: float = 0.0,
    gradio_url: str = "http://localhost:7860",
    auth: tuple | None = None,
) -> dict:
    """Call the Gradio generation API and return result info."""
    try:
        client = Client(gradio_url, auth=auth)
        result = client.predict(
            prompt,           # prompt
            negative_prompt,  # negative_prompt
            bars,             # bars
            bpm,              # bpm
            key_note,         # note
            key_scale,        # scale
            cfg_scale,        # cfg_scale
            steps,            # steps
            0,                # preview_every
            seed,             # seed
            sampler_type,     # sampler_type
            sigma_min,        # sigma_min
            sigma_max,        # sigma_max
            cfg_rescale,      # cfg_rescale
            False,            # init_audio_checkbox
            None,             # init_audio_input
            0.9,              # init_noise_level
            api_name="/generate"
        )
        audio_path = result[0] if isinstance(result, (list, tuple)) else result
        return {"status": "ok", "audio_path": str(audio_path)}
    except Exception as e:
        return {"status": "error", "error": str(e)}
