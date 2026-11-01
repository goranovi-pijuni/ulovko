from pathlib import Path

import pytest
from pydantic import ValidationError

from runner.services.package import (
    load_local_config,
    parse_config,
    resolve_build_contexts,
)

VALID_YAML = """
services:
  web1:
    type: http
    path: web1
    port: 8080
  test:
    type: tcp
    path: test
    port: 5000
"""


@pytest.fixture
def package_root(tmp_path: Path) -> Path:
    root = tmp_path / "challenge"
    for name in ("web1", "test"):
        context = root / "deploy" / name
        context.mkdir(parents=True)
        (context / "Dockerfile").write_text("FROM scratch\n", encoding="utf-8")
    return root


def test_parse_valid_yaml():
    config = parse_config(VALID_YAML)
    assert set(config.services) == {"web1", "test"}
    assert config.services["web1"].type == "http"
    assert config.services["test"].port == 5000


def test_parse_bytes_for_future_r2_archive():
    assert parse_config(VALID_YAML.encode()) == parse_config(VALID_YAML)


def test_load_local_config(tmp_path: Path):
    path = tmp_path / "config.yaml"
    path.write_text(VALID_YAML, encoding="utf-8")
    assert load_local_config(path) == parse_config(VALID_YAML)


def test_resolve_build_contexts(package_root: Path):
    result = resolve_build_contexts(package_root, parse_config(VALID_YAML))
    assert result == {
        "web1": package_root / "deploy" / "web1",
        "test": package_root / "deploy" / "test",
    }


def test_real_demo_package():
    root = Path(__file__).resolve().parents[1] / "examples" / "demo-challenge"
    config = load_local_config(root / "config.yaml")
    assert set(resolve_build_contexts(root, config)) == {"web1", "test"}


@pytest.mark.parametrize(
    "invalid_yaml",
    [
        "services: [not valid for our schema]",
        "services: {}",
        "services:\n  web1:\n    type: udp\n    path: web1\n    port: 8080",
        "services:\n  web1:\n    type: http\n    path: web1\n    port: 0",
        "services:\n  web1:\n    type: http\n    path: web1\n    port: 65536",
        "services:\n  web1:\n    type: http\n    path: web1\n    port: '8080'",
        "services:\n  Web_1:\n    type: http\n    path: web1\n    port: 8080",
        "services:\n  web1:\n    type: http\n    path: web1\n    port: 8080\n    unknown: field",
        "services:\n  web1:\n    type: http\n    path: web1\n    port: 8080\nflag:\n  static: true",
    ],
)
def test_invalid_schema(invalid_yaml: str):
    with pytest.raises(ValidationError):
        parse_config(invalid_yaml)


@pytest.mark.parametrize("invalid_yaml", ["[a, b]", "", "services: ["])
def test_invalid_yaml_document(invalid_yaml: str):
    with pytest.raises(ValueError):
        parse_config(invalid_yaml)


@pytest.mark.parametrize(
    "path", ["../escape", "/etc", "web1/../test", ".", "", "web1\\test"]
)
def test_invalid_context_path(package_root: Path, path: str):
    config = parse_config(VALID_YAML)
    config.services["web1"].path = path
    with pytest.raises(ValueError):
        resolve_build_contexts(package_root, config)


def test_missing_context_directory(package_root: Path):
    (package_root / "deploy" / "web1").rename(package_root / "deploy" / "renamed")
    with pytest.raises(ValueError, match="not a directory"):
        resolve_build_contexts(package_root, parse_config(VALID_YAML))


def test_missing_dockerfile(package_root: Path):
    (package_root / "deploy" / "web1" / "Dockerfile").unlink()
    with pytest.raises(ValueError, match="Dockerfile"):
        resolve_build_contexts(package_root, parse_config(VALID_YAML))


def test_context_symlink_outside_deploy(package_root: Path, tmp_path: Path):
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "Dockerfile").write_text("FROM scratch\n", encoding="utf-8")
    (package_root / "deploy" / "web1" / "Dockerfile").unlink()
    (package_root / "deploy" / "web1").rmdir()
    (package_root / "deploy" / "web1").symlink_to(outside, target_is_directory=True)

    with pytest.raises(ValueError, match="escapes deploy"):
        resolve_build_contexts(package_root, parse_config(VALID_YAML))


def test_dockerfile_symlink_outside_context(package_root: Path, tmp_path: Path):
    outside = tmp_path / "Dockerfile"
    outside.write_text("FROM scratch\n", encoding="utf-8")
    dockerfile = package_root / "deploy" / "web1" / "Dockerfile"
    dockerfile.unlink()
    dockerfile.symlink_to(outside)

    with pytest.raises(ValueError, match="Dockerfile"):
        resolve_build_contexts(package_root, parse_config(VALID_YAML))


def test_deploy_directory_symlink_outside_package(package_root: Path, tmp_path: Path):
    (package_root / "deploy" / "web1" / "Dockerfile").unlink()
    (package_root / "deploy" / "test" / "Dockerfile").unlink()
    (package_root / "deploy" / "web1").rmdir()
    (package_root / "deploy" / "test").rmdir()
    (package_root / "deploy").rmdir()
    (package_root / "deploy").symlink_to(tmp_path)

    with pytest.raises(ValueError, match="deploy"):
        resolve_build_contexts(package_root, parse_config(VALID_YAML))
