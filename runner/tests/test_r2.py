"""R2 input tests: all objects are in-memory, no network or credentials needed."""

import io
import stat
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

import pytest
from botocore.response import StreamingBody

from runner.services import r2

CONFIG = b"services:\n  web1:\n    type: http\n    path: web1\n    port: 8080\n"


def make_zip(entries: dict[str, bytes]) -> bytes:
    buffer = io.BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        for name, data in entries.items():
            archive.writestr(name, data)
    return buffer.getvalue()


GOOD_ZIP = make_zip(
    {
        "deploy/web1/Dockerfile": b"FROM scratch\n",
        "deploy/web1/server.py": b"print('OK')\n",
    }
)


class FakeR2:
    def __init__(self, objects: dict[str, bytes]):
        self.objects = objects
        self.calls: list[tuple[str, str]] = []

    def get_object(self, *, Bucket: str, Key: str):
        self.calls.append((Bucket, Key))
        data = self.objects[Key]
        return {
            "ContentLength": len(data),
            "Body": StreamingBody(io.BytesIO(data), len(data)),
        }


def fake_r2(config=CONFIG, deploy=GOOD_ZIP):
    return FakeR2({"task1/config.yaml": config, "task1/deploy.zip": deploy})


def test_fetch_build_inputs(tmp_path: Path):
    source = fake_r2()
    root = tmp_path / "package"
    parsed = r2.fetch_challenge("comp123", "task1", root, client=source)
    assert parsed.services["web1"].port == 8080
    assert (root / "config.yaml").read_bytes() == CONFIG
    assert (root / "deploy/web1/server.py").exists()
    assert not (root / "deploy.zip").exists()
    assert source.calls == [
        ("comp123", "task1/config.yaml"),
        ("comp123", "task1/deploy.zip"),
    ]


def test_ids_are_validated_before_access(tmp_path: Path):
    source = fake_r2()
    with pytest.raises(ValueError):
        r2.fetch_challenge("a", "task1", tmp_path / "out", client=source)
    with pytest.raises(ValueError):
        r2.fetch_challenge("comp123", "../task1", tmp_path / "out", client=source)
    assert source.calls == []


@pytest.mark.parametrize(
    "entry",
    [
        "deploy/../../outside",
        "deploy/../outside",
        "/deploy/web1/Dockerfile",
        "other/file.txt",
        "deploy\\web1\\Dockerfile",
    ],
)
def test_unsafe_entries_are_rejected(tmp_path: Path, entry: str):
    source = fake_r2(deploy=make_zip({entry: b"bad"}))
    with pytest.raises(r2.PackageDownloadError):
        r2.fetch_challenge("comp123", "task1", tmp_path / "package", client=source)
    assert not (tmp_path / "outside").exists()


def test_symlink_is_rejected(tmp_path: Path):
    info = ZipInfo("deploy/web1/symlink")
    info.create_system = 3
    info.external_attr = (stat.S_IFLNK | 0o777) << 16
    buffer = io.BytesIO()
    with ZipFile(buffer, "w") as archive:
        archive.writestr(info, "../../outside")
    with pytest.raises(r2.PackageDownloadError):
        r2.fetch_challenge(
            "comp123",
            "task1",
            tmp_path / "package",
            client=fake_r2(deploy=buffer.getvalue()),
        )


def test_oversized_archive(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(r2, "MAX_ZIP_BYTES", 10)
    with pytest.raises(r2.PackageDownloadError, match="size limit"):
        r2.fetch_challenge("comp123", "task1", tmp_path / "package", client=fake_r2())


def test_extraction_budget(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(r2, "MAX_EXTRACTED_BYTES", 4)
    with pytest.raises(r2.PackageDownloadError, match="expands"):
        r2.fetch_challenge("comp123", "task1", tmp_path / "package", client=fake_r2())


def test_missing_dockerfile(tmp_path: Path):
    zip_bytes = make_zip({"deploy/web1/server.py": b"print(1)\n"})
    with pytest.raises(ValueError, match="Dockerfile"):
        r2.fetch_challenge(
            "comp123", "task1", tmp_path / "package", client=fake_r2(deploy=zip_bytes)
        )


def test_missing_config_object(tmp_path: Path):
    with pytest.raises(KeyError, match="config.yaml"):
        r2.fetch_challenge("comp123", "task1", tmp_path / "package", client=FakeR2({}))


def test_invalid_yaml(tmp_path: Path):
    with pytest.raises(ValueError):
        r2.fetch_challenge(
            "comp123",
            "task1",
            tmp_path / "package",
            client=fake_r2(config=b"flag: true\n"),
        )


def test_s3_credentials_from_environment(monkeypatch):
    monkeypatch.setenv("R2_ENDPOINT_URL", "https://abc123.eu.r2.cloudflarestorage.com")
    monkeypatch.setenv("R2_ACCESS_KEY_ID", "my-id")
    monkeypatch.setenv("R2_SECRET_ACCESS_KEY", "my-secret")
    args = {}

    def fake_client(*pos, **kw):
        args.update(kw)
        return object()

    monkeypatch.setattr(r2.boto3, "client", fake_client)
    assert r2.create_r2_client() is not None
    assert args["endpoint_url"] == "https://abc123.eu.r2.cloudflarestorage.com"
    assert args["region_name"] == "auto"
    assert args["aws_access_key_id"] == "my-id"
    assert args["aws_secret_access_key"] == "my-secret"
