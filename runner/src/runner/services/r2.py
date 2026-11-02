import os
import re
import stat
from pathlib import Path, PurePosixPath
from typing import Any
from zipfile import BadZipFile, ZipFile

import boto3
from botocore.config import Config

from runner.services.package import (
    ChallengeConfig,
    parse_config,
    resolve_build_contexts,
)

BUCKET_NAME = re.compile(r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\Z")
CHALLENGE_ID = re.compile(r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\Z")
MAX_CONFIG_BYTES = 1024 * 1024
MAX_ZIP_BYTES = 256 * 1024 * 1024
MAX_EXTRACTED_BYTES = 512 * 1024 * 1024
MAX_ZIP_MEMBERS = 5000


class PackageDownloadError(ValueError):
    """R2 object or challenge archive cannot be used as build input."""


def create_r2_client() -> Any:
    """Load S3-compatible R2 credentials from the worker's environment."""
    keys = ("R2_ENDPOINT_URL", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY")
    missing = [key for key in keys if not os.getenv(key)]
    if missing:
        raise RuntimeError(f"Missing R2 configuration: {', '.join(missing)}")

    return boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT_URL"],
        region_name="auto",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        config=Config(
            connect_timeout=10,
            read_timeout=60,
            retries={"mode": "standard", "max_attempts": 3},
            s3={"addressing_style": "path"},
        ),
    )


def _download_object(
    client: Any, bucket: str, key: str, target: Path, maximum: int
) -> None:
    """Stream an object to disk, rejecting oversized objects."""
    response = client.get_object(Bucket=bucket, Key=key)
    body = response["Body"]
    try:
        if response.get("ContentLength", 0) > maximum:
            raise PackageDownloadError(f"R2 object exceeds size limit: {key}")

        size = 0
        with target.open("xb") as output:
            for chunk in body.iter_chunks(chunk_size=64 * 1024):
                if not chunk:
                    continue
                size += len(chunk)
                if size > maximum:
                    raise PackageDownloadError(f"R2 object exceeds size limit: {key}")
                output.write(chunk)
    finally:
        body.close()


def _extract_deploy(archive: Path, package_root: Path) -> None:
    """Extract only regular files in deploy/, with traversal and size checks."""
    try:
        with ZipFile(archive) as zf:
            members = zf.infolist()
            if len(members) > MAX_ZIP_MEMBERS:
                raise PackageDownloadError("deploy.zip contains too many entries")

            total = 0
            entries: set[str] = set()
            for member in members:
                name = member.filename
                path = PurePosixPath(name)
                parts = path.parts
                if (
                    not name.startswith("deploy/")
                    or "\\" in name
                    or any(p in (".", "..") for p in parts)
                    or path.is_absolute()
                    or any(ord(c) < 32 for c in name)
                    or len(name) > 1024
                    or name in entries
                ):
                    raise PackageDownloadError(f"Unsafe archive entry: {name!r}")
                entries.add(name)

                mode = member.external_attr >> 16 if member.create_system == 3 else 0
                file_type = stat.S_IFMT(mode)
                if file_type not in (0, stat.S_IFDIR, stat.S_IFREG):
                    raise PackageDownloadError(f"Unsupported archive entry: {name!r}")
                if member.is_dir():
                    if file_type == stat.S_IFREG:
                        raise PackageDownloadError(f"Invalid directory entry: {name!r}")
                elif file_type == stat.S_IFDIR:
                    raise PackageDownloadError(f"Invalid file entry: {name!r}")

                total += member.file_size
                if total > MAX_EXTRACTED_BYTES:
                    raise PackageDownloadError("deploy.zip expands beyond size limit")

            for member in members:
                destination = package_root / PurePosixPath(member.filename)
                if member.is_dir():
                    destination.mkdir(parents=True, exist_ok=True)
                    continue
                destination.parent.mkdir(parents=True, exist_ok=True)
                if destination.exists():
                    raise PackageDownloadError(
                        "Duplicate file or directory in deploy.zip"
                    )

                # Avoid extractall(): validate every entry and bound the actual
                # number of decompressed bytes written, not just ZIP metadata.
                remaining = member.file_size
                with zf.open(member) as source, destination.open("xb") as output:
                    while chunk := source.read(min(64 * 1024, remaining + 1)):
                        remaining -= len(chunk)
                        if remaining < 0:
                            raise PackageDownloadError("Invalid extracted file size")
                        output.write(chunk)
                if remaining != 0:
                    raise PackageDownloadError("Incomplete extracted file")
                mode = member.external_attr >> 16 if member.create_system == 3 else 0
                destination.chmod(0o644 | (mode & 0o111))
    except BadZipFile as exc:
        raise PackageDownloadError("Invalid deploy.zip archive") from exc


def fetch_challenge(
    competition_id: str,
    task_id: str,
    destination: Path,
    *,
    client: Any | None = None,
) -> ChallengeConfig:
    """Fetch and validate R2 build inputs into a fresh package directory.

    `task_id` is the challenge ID used in R2 object keys. No credentials or
    filesystem paths are accepted from API requests.
    """
    if not (3 <= len(competition_id) <= 63 and BUCKET_NAME.fullmatch(competition_id)):
        raise ValueError("competition_id is not a valid R2 bucket name")
    if not (1 <= len(task_id) <= 63 and CHALLENGE_ID.fullmatch(task_id)):
        raise ValueError("Invalid task_id")

    r2 = client if client is not None else create_r2_client()
    destination.mkdir(mode=0o700, parents=False, exist_ok=False)
    prefix = f"{task_id}/"
    _download_object(
        r2,
        competition_id,
        prefix + "config.yaml",
        destination / "config.yaml",
        MAX_CONFIG_BYTES,
    )
    config = parse_config((destination / "config.yaml").read_bytes())
    archive = destination / "deploy.zip"
    try:
        _download_object(
            r2, competition_id, prefix + "deploy.zip", archive, MAX_ZIP_BYTES
        )
        _extract_deploy(archive, destination)
        resolve_build_contexts(destination, config)
    finally:
        archive.unlink(missing_ok=True)

    return config
