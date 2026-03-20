import librosa
import numpy as np
import soundfile as sf
from pathlib import Path
from pydub import AudioSegment


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


def bar_to_ms(bar: int, bpm: float) -> int:
    beats_per_bar = 4
    ms_per_beat = 60_000 / bpm
    return int((bar - 1) * beats_per_bar * ms_per_beat)


def mix_down(tracks: list[dict], generations_dir: Path, bpm: float) -> AudioSegment:
    any_solo = any(t.get("solo", False) for t in tracks)
    active_tracks = []
    for t in tracks:
        if t.get("muted", False):
            continue
        if any_solo and not t.get("solo", False):
            continue
        active_tracks.append(t)

    if not active_tracks:
        return AudioSegment.silent(duration=1000)

    max_end_ms = 0
    for track in active_tracks:
        for clip in track.get("clips", []):
            filepath = generations_dir / clip["file"]
            if not filepath.exists():
                continue
            audio = AudioSegment.from_wav(str(filepath))
            start_ms = bar_to_ms(clip["startBar"], bpm)
            end_ms = start_ms + len(audio)
            if end_ms > max_end_ms:
                max_end_ms = end_ms

    mix = AudioSegment.silent(duration=max_end_ms, frame_rate=44100)

    for track in active_tracks:
        volume = track.get("volume", 1.0)
        volume_db = 20 * np.log10(max(volume, 0.001))
        for clip in track.get("clips", []):
            filepath = generations_dir / clip["file"]
            if not filepath.exists():
                continue
            audio = AudioSegment.from_wav(str(filepath))
            if audio.channels == 1:
                audio = audio.set_channels(2)
            if audio.frame_rate != 44100:
                audio = audio.set_frame_rate(44100)
            audio = audio + volume_db
            start_ms = bar_to_ms(clip["startBar"], bpm)
            mix = mix.overlay(audio, position=start_ms)

    if mix.dBFS != float("-inf"):
        change_in_dBFS = -1.0 - mix.max_dBFS
        mix = mix.apply_gain(change_in_dBFS)

    return mix


def time_stretch_clip(filepath: Path, original_bpm: float, target_bpm: float, output_dir: Path) -> Path:
    y, sr = librosa.load(str(filepath), sr=None, mono=False)
    rate = target_bpm / original_bpm
    if y.ndim == 1:
        stretched = librosa.effects.time_stretch(y, rate=rate)
    else:
        channels = [librosa.effects.time_stretch(y[ch], rate=rate) for ch in range(y.shape[0])]
        stretched = np.stack(channels)
    output_name = f"{filepath.stem}_stretched_{int(target_bpm)}bpm.wav"
    output_path = output_dir / output_name
    sf.write(str(output_path), stretched.T if stretched.ndim > 1 else stretched, sr)
    return output_path
