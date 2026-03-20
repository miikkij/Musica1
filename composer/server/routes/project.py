import json

from fastapi import APIRouter, Body, HTTPException

from composer.server.config import PROJECTS_DIR

router = APIRouter(prefix="/api/project", tags=["project"])


@router.get("")
def list_projects():
    if not PROJECTS_DIR.exists():
        return []
    return [f.stem for f in sorted(PROJECTS_DIR.glob("*.json"))]


@router.get("/{name}")
def load_project(name: str):
    filepath = PROJECTS_DIR / f"{name}.json"
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    with open(filepath) as f:
        return json.load(f)


@router.put("/{name}")
def save_project(name: str, project: dict = Body(...)):
    PROJECTS_DIR.mkdir(exist_ok=True)
    filepath = PROJECTS_DIR / f"{name}.json"
    with open(filepath, "w") as f:
        json.dump(project, f, indent=2)
    return {"status": "saved", "name": name}
