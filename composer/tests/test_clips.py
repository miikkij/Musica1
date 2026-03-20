import pytest
from composer.tests.conftest import create_test_wav


@pytest.fixture
def setup_clips(tmp_generations):
    create_test_wav(tmp_generations / "drums_120bpm.wav", duration_s=2.0)
    create_test_wav(tmp_generations / "bass_120bpm.wav", duration_s=1.0)
    (tmp_generations / "notes.txt").write_text("not audio")


def test_list_clips_returns_only_wav_files(client, setup_clips):
    resp = client.get("/api/clips")
    assert resp.status_code == 200
    data = resp.json()
    filenames = [c["filename"] for c in data]
    assert "drums_120bpm.wav" in filenames
    assert "bass_120bpm.wav" in filenames
    assert "notes.txt" not in filenames


def test_list_clips_includes_metadata(client, setup_clips):
    resp = client.get("/api/clips")
    clip = next(c for c in resp.json() if c["filename"] == "drums_120bpm.wav")
    assert "duration" in clip
    assert "file_size" in clip
    assert clip["duration"] == pytest.approx(2.0, abs=0.1)


def test_serve_clip(client, setup_clips):
    resp = client.get("/api/clips/drums_120bpm.wav")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/wav"


def test_serve_missing_clip_returns_404(client):
    resp = client.get("/api/clips/nonexistent.wav")
    assert resp.status_code == 404
