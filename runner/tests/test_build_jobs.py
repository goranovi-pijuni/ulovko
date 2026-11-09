"""Build API and durable queue tests; R2 and BuildKit are mocked."""

import json
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from runner.routes import builds
from runner.services import build_jobs
from runner.services.package import parse_config

YAML = b"services:\n  web1:\n    type: http\n    path: web1\n    port: 8080\n"


@pytest.fixture
def demo(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    monkeypatch.setenv("RUNNER_BUILDS_DIR", str(tmp_path / "jobs"))

    def fake_fetch(competition_id: str, task_id: str, dest: Path):
        assert competition_id == "demo-comp"
        assert task_id == "demo-task"
        context = dest / "deploy" / "web1"
        context.mkdir(parents=True)
        (context / "Dockerfile").write_text("FROM scratch\n", encoding="utf-8")
        (dest / "config.yaml").write_bytes(YAML)
        return parse_config(YAML)

    monkeypatch.setattr(build_jobs, "fetch_challenge", fake_fetch)
    app = FastAPI()
    app.include_router(builds.router)
    return TestClient(app)


def _submit(demo: TestClient) -> dict:
    response = demo.post(
        "/builds", json={"competition_id": "demo-comp", "task_id": "demo-task"}
    )
    assert response.status_code == 202
    return response.json()


def test_submit_and_read_build(demo: TestClient):
    body = _submit(demo)
    assert body["status"] == "queued"
    assert len(body["build_id"]) == 32
    assert demo.get(f"/builds/{body['build_id']}").json() == body
    assert demo.get("/builds/not-valid").status_code == 404


def test_request_does_not_accept_a_filesystem_path(demo: TestClient):
    assert (
        demo.post(
            "/builds",
            json={
                "competition_id": "demo-comp",
                "task_id": "demo-task",
                "path": "/etc",
            },
        ).status_code
        == 422
    )
    assert (
        demo.post(
            "/builds", json={"competition_id": "demo-comp", "task_id": "../evil"}
        ).status_code
        == 422
    )
    assert (
        demo.post(
            "/builds", json={"competition_id": "ab", "task_id": "demo-task"}
        ).status_code
        == 422
    )


def test_worker_builds_existing_job(demo: TestClient, monkeypatch):
    job = _submit(demo)

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
    assert (
        build_jobs.builds_root() / job["build_id"] / "config.yaml"
    ).read_bytes() == YAML
    assert not any((build_jobs.builds_root() / job["build_id"]).glob(".package-*"))
    logs = demo.get(f"/builds/{job['build_id']}/logs/web1")
    assert logs.status_code == 200
    assert logs.text == "ok\n"


def test_worker_failure_retains_status(demo: TestClient, monkeypatch):
    job = _submit(demo)

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


def test_running_build_is_requeued_after_worker_restart(demo: TestClient):
    job = _submit(demo)
    job["status"] = "running"
    job["started_at"] = "2026-01-01T00:00:00Z"
    build_jobs._write_job(job)
    build_jobs.recover_interrupted_jobs()
    loaded = build_jobs.get_job(job["build_id"])
    assert loaded["status"] == "queued"
    assert loaded["started_at"] is None
    assert (
        json.loads(
            (build_jobs.builds_root() / job["build_id"] / "job.json").read_text()
        )["status"]
        == "queued"
    )


def test_r2_failure_is_reported_as_failed_job(demo: TestClient, monkeypatch):
    job = _submit(demo)

    def unavailable(competition_id, task_id, destination):
        raise FileNotFoundError("NoSuchKey: demo-task/deploy.zip")

    monkeypatch.setattr(build_jobs, "fetch_challenge", unavailable)
    assert build_jobs.process_next_job() is True
    response = demo.get(f"/builds/{job['build_id']}").json()
    assert response["status"] == "failed"
    assert "NoSuchKey" in response["error"]


def test_numeric_ids_are_canonicalized_at_api_boundary(demo: TestClient):
    response = demo.post(
        "/builds", json={"competition_id": "001", "task_id": "0004"}
    )
    assert response.status_code == 202
    created = response.json()
    assert created["competition_id"] == "1"
    assert created["task_id"] == "4"


def test_single_digit_competition_id_is_accepted(demo: TestClient):
    response = demo.post(
        "/builds", json={"competition_id": "1", "task_id": "4"}
    )
    assert response.status_code == 202
    assert response.json()["competition_id"] == "1"
