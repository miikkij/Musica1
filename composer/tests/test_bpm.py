import struct
import wave

import numpy as np
import pytest


def create_click_track_wav(path, bpm=120.0, duration_s=4.0, sample_rate=44100):
    """Create a WAV with click track at the given BPM."""
    n_samples = int(duration_s * sample_rate)
    samples = np.zeros(n_samples, dtype=np.float32)

    # Place clicks at beat positions
    beat_period = sample_rate * 60.0 / bpm
    click_len = int(0.02 * sample_rate)  # 20ms click
    beat = 0
    while True:
        pos = int(beat * beat_period)
        if pos >= n_samples:
            break
        end = min(pos + click_len, n_samples)
        # Simple sine click
        t = np.arange(end - pos) / sample_rate
        samples[pos:end] += np.sin(2 * np.pi * 1000 * t) * 0.8
        beat += 1

    # Convert to 16-bit PCM
    pcm = np.clip(samples, -1.0, 1.0)
    pcm_int = (pcm * 32767).astype(np.int16)

    with wave.open(str(path), "w") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sample_rate)
        f.writeframes(pcm_int.tobytes())


@pytest.fixture
def setup_bpm_files(tmp_generations):
    create_click_track_wav(tmp_generations / "click_120bpm.wav", bpm=120.0, duration_s=8.0)
    create_click_track_wav(tmp_generations / "click_90bpm.wav", bpm=90.0, duration_s=8.0)


def test_bpm_detection_returns_value(client, setup_bpm_files):
    resp = client.post("/api/bpm", json={"filename": "click_120bpm.wav"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "detected"
    assert data["bpm"] is not None
    assert 40 <= data["bpm"] <= 300


def test_bpm_detection_missing_file_returns_404(client):
    resp = client.post("/api/bpm", json={"filename": "nonexistent.wav"})
    assert resp.status_code == 404


def test_bpm_detection_response_shape(client, setup_bpm_files):
    resp = client.post("/api/bpm", json={"filename": "click_120bpm.wav"})
    data = resp.json()
    assert "filename" in data
    assert "bpm" in data
    assert "status" in data
    assert data["filename"] == "click_120bpm.wav"
