from unittest.mock import patch
import pytest


def test_generate_returns_audio_path(client):
    mock_result = ("/path/to/audio.wav", [], None, None)
    with patch("composer.server.services.gradio_proxy.Client") as MockClient:
        MockClient.return_value.predict.return_value = mock_result
        resp = client.post("/api/generate", json={
            "prompt": "test drums",
            "bars": 4,
            "bpm": 120,
            "key": "C minor",
            "steps": 10
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "audio_path" in data


def test_generate_handles_connection_error(client):
    with patch("composer.server.services.gradio_proxy.Client") as MockClient:
        MockClient.side_effect = ConnectionError("Connection refused")
        resp = client.post("/api/generate", json={
            "prompt": "test",
            "bars": 4,
            "bpm": 120,
            "key": "C minor"
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "error"
    assert "7860" in data["error"]
