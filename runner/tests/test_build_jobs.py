"""Build API and durable queue tests; no BuildKit daemon required."""

import json
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from runner.routes import builds
from runner.services import build_jobs


@pytest.fixture
def demo(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    monkeypatch.setenv("RUNNER_BUILDS_DIR", str(tmp_path / "jobs"))
    root = tmp_path / "challenge"
    context = root / "deploy" / "web1"
    context.mkdir(parents=True)
    (context / "Dockerfile").write_text("FROM scratch\n", encoding="utf-8")
    (root / "config.yaml").write_text(
        "services:\n  web1:\n    type: http\n    path: web1\n    port: 8080\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("RUNNER_BUILD_PACKAGE", str(root))
    app = FastAPI()
    app.include_router(builds.router)
    return TestClient(app)


def test_submit_and_read_build(demo: TestClient):
    result = demo.post(
        "/builds", json={"competition_id": "demo-comp", "task_id": "demo-task"}
    )
    assert result.status_code == 202
    body = result.json()
    assert body["status"] == "queued"
    assert len(body["build_id"]) == 32
    assert demo.get(f"/builds/{body['build_id']}").json() == body
    assert demo.get("/builds/not-valid").status_code == 404


def test_request_does_not_accept_a_filesystem_path(demo: TestClient):
    assert demo.post(
        "/builds",
        json={"competition_id": "a", "task_id": "b", "path": "/etc"},
    ).status_code == 422
    assert demo.post(
        "/builds", json={"competition_id": "a", "task_id": "../evil"}
    ).status_code == 422


def test_worker_builds_existing_job(demo: TestClient, monkeypatch):
    job = demo.post(
        "/builds", json={"competition_id": "comp", "task_id": "task"}
    ).json()

    def fake_build(config, contexts, output):
        assert list(config.services) == ["web1"]
        assert set(contexts) == {"web1"}
        output.mkdir()
        (output / "web1.oci.tar").write_bytes(b"fake")
        (output / "web1.log").write_text("ok\n")
        return {"web1": output / "web1.oci.tar"}

    monkeypatch.setattr(build_jobs, "build_challenge", fake_build)
    assert build_jobs.process_next_job() is True
    assert build_jobs.process_next_job() is False
    response = demo.get(f"/builds/{job['build_id']}").json()
    assert response["status"] == "succeeded"
    assert response["images"] == {"web1": "web1.oci.tar"}
    assert response["started_at"] is not None
    assert response["finished_at"] is not None
    logs = demo.get(f"/builds/{job['build_id']}/logs/web1")
    assert logs.status_code == 200
    assert logs.text == "ok\n"
    assert demo.get(f"/builds/{job['build_id']}/logs/../../etc").status_code in (404, 405)


def test_worker_failure_retains_status(demo: TestClient, monkeypatch):
    job = demo.post(
        "/builds", json={"competition_id": "comp", "task_id": "task"}
    ).json()

    def broken_build(config, contexts, output):
        output.mkdir()
        (output / "web1.log").write_text("BuildKit failed\n")
        raise RuntimeError("Build failed")

    monkeypatch.setattr(build_jobs, "build_challenge", broken_build)
    assert build_jobs.process_next_job() is True
    response = demo.get(f"/builds/{job['build_id']}").json()
    assert response["status"] == "failed"
    assert response["error"] == "Build failed"
    assert demo.get(f"/builds/{job['build_id']}/logs/web1").text == "BuildKit failed\n"


def test_running_build_is_requeued_after_worker_restart(demo: TestClient, monkeypatch):
    job = demo.post(
        "/builds", json={"competition_id": "comp", "task_id": "task"}
    ).json()
    job["status"] = "running"
    job["started_at"] = "2026-01-01T00:00:00Z"
    build_jobs._write_job(job)
    build_jobs.recover_interrupted_jobs()
    loaded = build_jobs.get_job(job["build_id"])
    assert loaded["status"] == "queued"
    assert loaded["started_at"] is None
    assert json.loads(
        (build_jobs.builds_root() / job["build_id"] / "job.json").read_text()
    )["status"] == "queued"


def test_unavailable_demo_returns_503(demo: TestClient, monkeypatch, tmp_path: Path):
    monkeypatch.setenv("RUNNER_BUILD_PACKAGE", str(tmp_path / "missing"))
    response = demo.post(
        "/builds", json={"competition_id": "comp", "task_id": "task"}
    )
    assert response.status_code == 503
