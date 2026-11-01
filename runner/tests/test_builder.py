"""Unit tests for rootless BuildKit orchestration (no daemon required)."""

import io
import json
import subprocess
import tarfile
from pathlib import Path
from types import SimpleNamespace

import pytest

from runner.services import builder
from runner.services.package import load_local_config, resolve_build_contexts


def _oci_archive() -> bytes:
    data = io.BytesIO()
    with tarfile.open(fileobj=data, mode="w") as tar:
        for name in ("oci-layout", "index.json"):
            payload = b"{}"
            info = tarfile.TarInfo(name)
            info.size = len(payload)
            tar.addfile(info, io.BytesIO(payload))
    return data.getvalue()


@pytest.fixture
def contexts(tmp_path: Path):
    root = tmp_path / "challenge"
    for name in ("web1", "test"):
        folder = root / "deploy" / name
        folder.mkdir(parents=True)
        (folder / "Dockerfile").write_text("FROM scratch\n")
    (root / "config.yaml").write_text(
        "services:\n"
        "  web1: {type: http, path: web1, port: 8080}\n"
        "  test: {type: tcp, path: test, port: 5000}\n"
    )
    config = load_local_config(root / "config.yaml")
    return config, resolve_build_contexts(root, config)


def test_build_all_services(monkeypatch, tmp_path: Path, contexts):
    config, paths = contexts
    seen = []

    def fake_run(command, *, stdout, stderr, timeout, check):
        seen.append(command)
        stdout.write(_oci_archive())
        stderr.write(b"build logs\n")
        assert timeout == 20
        assert check is False
        return SimpleNamespace(returncode=0)

    monkeypatch.setattr(builder.subprocess, "run", fake_run)
    out = tmp_path / "output"
    images = builder.build_challenge(config, paths, out, timeout_seconds=20)
    assert sorted(images) == ["test", "web1"]
    assert all(path.is_file() for path in images.values())
    assert (out / "web1.log").read_text() == "build logs\n"
    assert json.loads((out / "images.json").read_text()) == {
        "web1": "web1.oci.tar",
        "test": "test.oci.tar",
    }
    for cmd in seen:
        assert cmd[:3] == ["buildctl", "--addr", builder.BUILDKIT_ADDRESS]
        assert "sudo" not in cmd
        assert "type=oci" in cmd


def test_failure_cleans_images_but_keeps_logs(monkeypatch, tmp_path: Path, contexts):
    config, paths = contexts
    calls = 0

    def fake_run(command, *, stdout, stderr, timeout, check):
        nonlocal calls
        calls += 1
        stdout.write(_oci_archive() if calls == 1 else b"partial")
        return SimpleNamespace(returncode=0 if calls == 1 else 3)

    monkeypatch.setattr(builder.subprocess, "run", fake_run)
    out = tmp_path / "output"
    with pytest.raises(builder.BuildError, match="exited with 3"):
        builder.build_challenge(config, paths, out)
    assert not list(out.glob("*.oci.tar*"))
    assert (out / "web1.log").exists()
    assert (out / "test.log").exists()
    assert not (out / "images.json").exists()


def test_timeout(monkeypatch, tmp_path: Path, contexts):
    config, paths = contexts

    def fake_run(command, *, stdout, stderr, timeout, check):
        raise subprocess.TimeoutExpired(command, timeout)

    monkeypatch.setattr(builder.subprocess, "run", fake_run)
    out = tmp_path / "output"
    with pytest.raises(builder.BuildError, match="timed out"):
        builder.build_challenge(config, paths, out, timeout_seconds=1)
    assert not list(out.glob("*.oci.tar*"))


def test_contexts_must_match(monkeypatch, tmp_path: Path, contexts):
    config, paths = contexts
    with pytest.raises(ValueError, match="Build contexts"):
        builder.build_challenge(config, {"web1": paths["web1"]}, tmp_path / "bad")
