import wave
import pytest
from composer.tests.conftest import create_test_wav

@pytest.fixture
def setup_loop_clip(tmp_generations):
    create_test_wav(tmp_generations / "drums.wav", duration_s=2.0, value=1000)

def test_loop_creates_repeated_file(client, tmp_generations, setup_loop_clip):
    resp = client.post("/api/loop", json={"filename": "drums.wav", "repeat_count": 3})
    assert resp.status_code == 200
    data = resp.json()
    assert "output_filename" in data
    output = tmp_generations / data["output_filename"]
    assert output.exists()
    with wave.open(str(output), "r") as f:
        duration = f.getnframes() / f.getframerate()
    assert duration == pytest.approx(6.0, abs=0.5)

def test_loop_repeat_count_1_returns_original(client, tmp_generations, setup_loop_clip):
    resp = client.post("/api/loop", json={"filename": "drums.wav", "repeat_count": 1})
    assert resp.status_code == 200
    assert resp.json()["output_filename"] == "drums.wav"

def test_loop_missing_file_returns_404(client):
    resp = client.post("/api/loop", json={"filename": "nonexistent.wav", "repeat_count": 2})
    assert resp.status_code == 404
