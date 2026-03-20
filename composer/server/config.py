import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = ROOT_DIR / "config.json"


def load_config():
    with open(CONFIG_PATH) as f:
        return json.load(f)


config = load_config()
GENERATIONS_DIR = ROOT_DIR / config.get("generations_directory", "generations")
PROJECTS_DIR = ROOT_DIR / "projects"
PROJECTS_DIR.mkdir(exist_ok=True)
