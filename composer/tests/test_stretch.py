import pytest
from composer.tests.conftest import create_test_wav


@pytest.fixture
def setup_stretch_clips(tmp_generations):
    create_test_wav(tmp_generations / "loop_120bpm.wav", duration_s=2.0)


def test_stretch_returns_output_filename(client, setup_stretch_clips):
    resp = client.post(
        "/api/stretch",
        json={"filename": "loop_120bpm.wav", "original_bpm": 120.0, "target_bpm": 140.0},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "output_filename" in data
    assert "140" in data["output_filename"]
    assert data["target_bpm"] == 140.0


def test_stretch_output_file_exists(client, tmp_generations, setup_stretch_clips):
    resp = client.post(
        "/api/stretch",
        json={"filename": "loop_120bpm.wav", "original_bpm": 120.0, "target_bpm": 100.0},
    )
    assert resp.status_code == 200
    output_name = resp.json()["output_filename"]
    assert (tmp_generations / output_name).exists()


def test_stretch_missing_file_returns_404(client):
    resp = client.post(
        "/api/stretch",
        json={"filename": "nonexistent.wav", "original_bpm": 120.0, "target_bpm": 140.0},
    )
    assert resp.status_code == 404


def test_stretch_same_bpm_returns_output(client, setup_stretch_clips):
    resp = client.post(
        "/api/stretch",
        json={"filename": "loop_120bpm.wav", "original_bpm": 120.0, "target_bpm": 120.0},
    )
    assert resp.status_code == 200
    assert resp.json()["output_filename"].endswith(".wav")
