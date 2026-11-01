import re
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, field_validator

SERVICE_NAME = re.compile(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*\Z")


class ServiceConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    type: Literal["http", "tcp"]
    path: str
    port: int = Field(ge=1, le=65535)


class ChallengeConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    services: dict[str, ServiceConfig] = Field(min_length=1)

    @field_validator("services")
    @classmethod
    def validate_service_names(
        cls, services: dict[str, ServiceConfig]
    ) -> dict[str, ServiceConfig]:
        for name in services:
            if len(name) > 63 or SERVICE_NAME.fullmatch(name) is None:
                raise ValueError(f"Invalid service name: {name!r}")
        return services


def parse_config(data: str | bytes) -> ChallengeConfig:
    """Parse YAML contents, independent of where they were obtained."""
    try:
        parsed = yaml.safe_load(data)
    except yaml.YAMLError as exc:
        raise ValueError("Invalid config.yaml") from exc

    if not isinstance(parsed, dict):
        raise ValueError("config.yaml must contain a mapping")

    return ChallengeConfig.model_validate(parsed)


def load_local_config(path: Path) -> ChallengeConfig:
    """Read a local config.yaml; R2 will use parse_config directly."""
    return parse_config(path.read_bytes())


def resolve_build_contexts(root: Path, config: ChallengeConfig) -> dict[str, Path]:
    """Resolve service paths relative to <package>/deploy/ safely."""
    package_root = root.resolve()
    deploy_root = (package_root / "deploy").resolve()

    if not deploy_root.is_relative_to(package_root) or not deploy_root.is_dir():
        raise ValueError("Missing or invalid deploy/ directory")

    contexts: dict[str, Path] = {}

    for name, service in config.services.items():
        path = service.path
        parts = path.split("/")

        # Use canonical, relative POSIX paths in challenge manifests.
        if (
            not path
            or "\\" in path
            or any(part in ("", ".", "..") for part in parts)
            or Path(path).is_absolute()
        ):
            raise ValueError(f"Invalid build context path for {name!r}: {path!r}")

        context = deploy_root.joinpath(*parts).resolve()
        if not context.is_relative_to(deploy_root):
            raise ValueError(f"Build context escapes deploy/ for {name!r}")
        if not context.is_dir():
            raise ValueError(f"Build context is not a directory for {name!r}")

        dockerfile = (context / "Dockerfile").resolve()
        if not dockerfile.is_relative_to(context) or not dockerfile.is_file():
            raise ValueError(f"Missing or invalid Dockerfile for {name!r}")

        contexts[name] = context

    return contexts
