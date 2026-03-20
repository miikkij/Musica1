import struct
import wave

import pytest
from fastapi.testclient import TestClient


def create_test_wav(path, duration_s=1.0, sample_rate=44100, value=0):
    """Create a minimal valid WAV file."""
    n_samples = int(duration_s * sample_rate)
    with wave.open(str(path), "w") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sample_rate)
        f.writeframes(struct.pack(f"<{n_samples}h", *([value] * n_samples)))


@pytest.fixture
def tmp_generations(tmp_path, monkeypatch):
    """Patch GENERATIONS_DIR to a temp directory."""
    gen_dir = tmp_path / "generations"
    gen_dir.mkdir()

    import composer.server.config as config_module
    monkeypatch.setattr(config_module, "GENERATIONS_DIR", gen_dir)
    return gen_dir


@pytest.fixture
def tmp_projects(tmp_path, monkeypatch):
    """Patch PROJECTS_DIR to a temp directory."""
    proj_dir = tmp_path / "projects"
    proj_dir.mkdir()

    import composer.server.config as config_module
    monkeypatch.setattr(config_module, "PROJECTS_DIR", proj_dir)
    return proj_dir


@pytest.fixture
def client(tmp_generations, tmp_projects):
    from composer.server.app import app
    return TestClient(app)
