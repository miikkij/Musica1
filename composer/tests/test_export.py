import io
import wave

import pytest
from composer.tests.conftest import create_test_wav


@pytest.fixture(autouse=True)
def setup_export_clips(tmp_generations):
    create_test_wav(tmp_generations / "drums.wav", duration_s=2.0)
    create_test_wav(tmp_generations / "bass.wav", duration_s=2.0)


def make_project(tracks=None, bpm=120):
    if tracks is None:
        tracks = [
            {
                "id": "1",
                "name": "Drums",
                "clips": [{"file": "drums.wav", "startBar": 1}],
                "volume": 1.0,
                "muted": False,
                "solo": False,
            }
        ]
    return {"bpm": bpm, "tracks": tracks}


def test_export_returns_wav(client):
    resp = client.post("/api/export", json=make_project())
    assert resp.status_code == 200
    assert "audio/wav" in resp.headers["content-type"]


def test_export_wav_is_valid(client):
    resp = client.post("/api/export", json=make_project())
    buf = io.BytesIO(resp.content)
    with wave.open(buf) as f:
        assert f.getnchannels() in (1, 2)
        assert f.getnframes() > 0


def test_export_empty_tracks_returns_silence(client):
    project = {"bpm": 120, "tracks": []}
    resp = client.post("/api/export", json=project)
    assert resp.status_code == 200
    buf = io.BytesIO(resp.content)
    with wave.open(buf) as f:
        assert f.getnframes() > 0


def test_export_muted_track_excluded(client, tmp_generations):
    project = {
        "bpm": 120,
        "tracks": [
            {
                "id": "1",
                "name": "Drums",
                "clips": [{"file": "drums.wav", "startBar": 1}],
                "volume": 1.0,
                "muted": True,
                "solo": False,
            }
        ],
    }
    resp = client.post("/api/export", json=project)
    assert resp.status_code == 200


def test_export_solo_track(client, tmp_generations):
    project = {
        "bpm": 120,
        "tracks": [
            {
                "id": "1",
                "name": "Drums",
                "clips": [{"file": "drums.wav", "startBar": 1}],
                "volume": 1.0,
                "muted": False,
                "solo": True,
            },
            {
                "id": "2",
                "name": "Bass",
                "clips": [{"file": "bass.wav", "startBar": 1}],
                "volume": 1.0,
                "muted": False,
                "solo": False,
            },
        ],
    }
    resp = client.post("/api/export", json=project)
    assert resp.status_code == 200
