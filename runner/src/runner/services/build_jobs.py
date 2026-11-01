import fcntl
import json
import logging
import os
import re
import shutil
import subprocess
import time
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from runner.services.builder import BUILDKIT_ADDRESS, build_challenge
from runner.services.package import load_local_config, resolve_build_contexts

BUILD_ID = re.compile(r"[0-9a-f]{32}\Z")
BUILD_ROOT = "/var/lib/ctf-runner/builds"
BUILDKIT_SOCKET = BUILDKIT_ADDRESS.removeprefix("unix://")

logger = logging.getLogger(__name__)


def builds_root() -> Path:
    return Path(os.getenv("RUNNER_BUILDS_DIR", BUILD_ROOT))


def example_root() -> Path:
    """Fixed trusted example until package retrieval from R2 is implemented."""
    return Path(os.getenv("RUNNER_BUILD_PACKAGE", "examples/demo-challenge")).resolve()


def _timestamp() -> str:
    return datetime.now(UTC).isoformat()


def _job_dir(build_id: str) -> Path:
    if BUILD_ID.fullmatch(build_id) is None:
        raise ValueError("Invalid build ID")
    return builds_root() / build_id


def _write_job(job: dict) -> None:
    """Replace the JSON record atomically, so GET never sees partial JSON."""
    directory = _job_dir(job["build_id"])
    temporary = directory / f".job.{uuid4().hex}.tmp"
    try:
        with temporary.open("x", encoding="utf-8") as file:
            json.dump(job, file, indent=2)
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())
        temporary.replace(directory / "job.json")
    finally:
        temporary.unlink(missing_ok=True)


def submit_job(competition_id: str, task_id: str) -> dict:
    root = builds_root()
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    build_id = uuid4().hex
    _job_dir(build_id).mkdir(mode=0o700)
    job = {
        "build_id": build_id,
        "competition_id": competition_id,
        "task_id": task_id,
        "status": "queued",
        "created_at": _timestamp(),
        "started_at": None,
        "finished_at": None,
        "images": {},
        "error": None,
    }
    _write_job(job)
    return job


def get_job(build_id: str) -> dict | None:
    if BUILD_ID.fullmatch(build_id) is None:
        return None
    try:
        with (_job_dir(build_id) / "job.json").open(encoding="utf-8") as file:
            return json.load(file)
    except FileNotFoundError:
        return None


def read_log(build_id: str, service: str, *, max_bytes: int = 65536) -> str | None:
    if (
        BUILD_ID.fullmatch(build_id) is None
        or not re.fullmatch(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*", service)
        or len(service) > 63
    ):
        return None
    if get_job(build_id) is None:
        return None
    path = _job_dir(build_id) / "images" / f"{service}.log"
    try:
        with path.open("rb") as log:
            log.seek(0, os.SEEK_END)
            log.seek(max(0, log.tell() - max_bytes))
            return log.read().decode("utf-8", errors="replace")
    except FileNotFoundError:
        return None


def _pending_jobs() -> list[dict]:
    jobs = []
    for directory in builds_root().iterdir():
        if not directory.is_dir():
            continue
        job = get_job(directory.name)
        if job is not None and job.get("status") == "queued":
            jobs.append(job)
    return sorted(jobs, key=lambda job: job["created_at"])


def recover_interrupted_jobs() -> None:
    """A worker crash/restart requeues jobs that were left in 'running'."""
    builds_root().mkdir(parents=True, exist_ok=True, mode=0o700)
    for directory in builds_root().iterdir():
        if not directory.is_dir():
            continue
        job = get_job(directory.name)
        if job is not None and job.get("status") == "running":
            job["status"] = "queued"
            job["started_at"] = None
            job["error"] = None
            _write_job(job)


def process_next_job() -> bool:
    """Consume at most one queued job. False means there was no work."""
    queued = _pending_jobs()
    if not queued:
        return False

    job = queued[0]
    job["status"] = "running"
    job["started_at"] = _timestamp()
    job["error"] = None
    _write_job(job)

    output = _job_dir(job["build_id"]) / "images"
    try:
        # build_challenge creates its output directory (exist_ok=False).
        if output.exists():
            shutil.rmtree(output)
        package = example_root()
        config = load_local_config(package / "config.yaml")
        contexts = resolve_build_contexts(package, config)
        images = build_challenge(config, contexts, output)
        job["images"] = {name: path.name for name, path in images.items()}
        job["status"] = "succeeded"
    except Exception as exc:
        logger.exception("Build job failed")
        job["status"] = "failed"
        job["images"] = {}
        job["error"] = str(exc)
    finally:
        job["finished_at"] = _timestamp()
        _write_job(job)
    return True


def _builder_ready() -> bool:
    if not Path(BUILDKIT_SOCKET).exists():
        return False
    try:
        result = subprocess.run(
            ["buildctl", "--addr", BUILDKIT_ADDRESS, "debug", "workers"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=10,
            check=False,
        )
        return result.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def main() -> None:
    root = builds_root()
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    # Protect against accidentally starting two workers against the same queue.
    with (root / ".worker.lock").open("a+") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise SystemExit("Another build worker is already running") from exc
        recover_interrupted_jobs()
        while True:
            if _pending_jobs() and _builder_ready():
                process_next_job()
            else:
                time.sleep(2)


if __name__ == "__main__":
    main()
