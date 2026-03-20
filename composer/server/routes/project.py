import json

import composer.server.config as _config
from fastapi import APIRouter, Body, HTTPException

router = APIRouter(prefix="/api/project", tags=["project"])


@router.get("")
def list_projects():
    projects_dir = _config.PROJECTS_DIR
    if not projects_dir.exists():
        return []
    return [f.stem for f in sorted(projects_dir.glob("*.json"))]


@router.get("/{name}")
def load_project(name: str):
    filepath = _config.PROJECTS_DIR / f"{name}.json"
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    with open(filepath) as f:
        return json.load(f)


@router.put("/{name}")
def save_project(name: str, project: dict = Body(...)):
    projects_dir = _config.PROJECTS_DIR
    projects_dir.mkdir(exist_ok=True)
    filepath = projects_dir / f"{name}.json"
    with open(filepath, "w") as f:
        json.dump(project, f, indent=2)
    return {"status": "saved", "name": name}
