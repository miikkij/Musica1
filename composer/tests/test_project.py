import pytest


SAMPLE_PROJECT = {
    "bpm": 120,
    "tracks": [
        {"id": "1", "name": "Drums", "clips": []},
    ],
}


def test_list_projects_empty(client, tmp_projects):
    resp = client.get("/api/project")
    assert resp.status_code == 200
    assert resp.json() == []


def test_save_and_list_project(client, tmp_projects):
    resp = client.put("/api/project/mytrack", json=SAMPLE_PROJECT)
    assert resp.status_code == 200
    assert resp.json()["status"] == "saved"

    resp = client.get("/api/project")
    assert "mytrack" in resp.json()


def test_save_and_load_project(client, tmp_projects):
    client.put("/api/project/mytrack", json=SAMPLE_PROJECT)
    resp = client.get("/api/project/mytrack")
    assert resp.status_code == 200
    data = resp.json()
    assert data["bpm"] == 120
    assert len(data["tracks"]) == 1


def test_load_missing_project_returns_404(client):
    resp = client.get("/api/project/doesnotexist")
    assert resp.status_code == 404


def test_save_overwrites_existing_project(client, tmp_projects):
    client.put("/api/project/mytrack", json=SAMPLE_PROJECT)
    updated = {**SAMPLE_PROJECT, "bpm": 140}
    client.put("/api/project/mytrack", json=updated)
    resp = client.get("/api/project/mytrack")
    assert resp.json()["bpm"] == 140
