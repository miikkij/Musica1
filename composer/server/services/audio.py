import librosa
import numpy as np
from pathlib import Path


def detect_bpm(filepath: Path) -> float | None:
    try:
        y, sr = librosa.load(str(filepath), sr=None)
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(np.atleast_1d(tempo)[0])
        if bpm < 40 or bpm > 300 or np.isnan(bpm):
            return None
        return round(bpm, 1)
    except Exception:
        return None
