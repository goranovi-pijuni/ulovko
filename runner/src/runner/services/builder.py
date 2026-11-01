"""Build a validated challenge package into OCI archives using rootless BuildKit.

Builds images only: no Kubernetes deployment and no Docker daemon required.
The daemon is available on the same group-protected Unix socket on all hosts.
"""

import argparse
import json
import subprocess
import tarfile
from pathlib import Path
from uuid import uuid4

from runner.services.package import (
    ChallengeConfig,
    load_local_config,
    resolve_build_contexts,
)

BUILDKIT_ADDRESS = "unix:///run/ulovko-buildkit/buildkitd.sock"


class BuildError(RuntimeError):
    """BuildKit failed to produce one or more challenge images."""


def build_challenge(
    config: ChallengeConfig,
    contexts: dict[str, Path],
    output_dir: Path,
    *,
    timeout_seconds: int = 600,
) -> dict[str, Path]:
    """Build every configured service to an OCI archive.

    The caller must provide a unique, non-existing output directory.
    Build logs survive failures. Partial and previously completed images are
    deleted if any service fails, so the result is all-or-nothing.
    """
    if set(contexts) != set(config.services):
        raise ValueError("Build contexts must match configured services")
    if timeout_seconds <= 0:
        raise ValueError("timeout_seconds must be positive")

    output_dir.mkdir(parents=True, exist_ok=False)
    images: dict[str, Path] = {}

    try:
        for name in config.services:
            context = contexts[name].resolve(strict=True)
            dockerfile = context / "Dockerfile"
            if not context.is_dir() or not dockerfile.is_file():
                raise ValueError(f"Invalid build context for {name!r}")

            partial = output_dir / f"{name}.oci.tar.part"
            archive = output_dir / f"{name}.oci.tar"
            log_path = output_dir / f"{name}.log"

            command = [
                "buildctl", "--addr", BUILDKIT_ADDRESS,
                "build",
                "--frontend", "dockerfile.v0",
                "--local", f"context={context}",
                "--local", f"dockerfile={context}",
                "--progress", "plain",
                "--output", "type=oci",
            ]

            try:
                # With no dest=, the OCI tar is streamed to stdout.
                with partial.open("wb") as output, log_path.open("wb") as log:
                    result = subprocess.run(
                        command,
                        stdout=output,
                        stderr=log,
                        timeout=timeout_seconds,
                        check=False,
                    )
                if result.returncode != 0:
                    raise BuildError(
                        f"Build of {name!r} exited with {result.returncode}; "
                        f"see {log_path}"
                    )
                # Check structure, not just nonzero length. This is a tar
                # archive containing OCI layout metadata and image blobs.
                with tarfile.open(partial, "r:") as image_tar:
                    member_names = {name.lstrip("./") for name in image_tar.getnames()}
                    if not {"oci-layout", "index.json"}.issubset(member_names):
                        raise BuildError(f"Invalid OCI archive for {name!r}")
                partial.rename(archive)
                images[name] = archive
            except subprocess.TimeoutExpired as exc:
                raise BuildError(
                    f"Build of {name!r} timed out after {timeout_seconds}s; "
                    f"see {log_path}"
                ) from exc
            except FileNotFoundError as exc:
                raise BuildError("buildctl was not found in PATH") from exc
            except (tarfile.TarError, OSError) as exc:
                raise BuildError(
                    f"Invalid OCI output for {name!r}; see {log_path}"
                ) from exc
            finally:
                partial.unlink(missing_ok=True)

        (output_dir / "images.json").write_text(
            json.dumps(
                {name: archive.name for name, archive in images.items()},
                indent=2,
            ) + "\n",
            encoding="utf-8",
        )
        return images
    except Exception:
        for archive in images.values():
            archive.unlink(missing_ok=True)
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description="Build an Ulovko challenge")
    parser.add_argument("package_root", type=Path)
    parser.add_argument(
        "--output-root", type=Path, default=Path("/tmp/ulovko-builds"),
        help="Directory holding separate per-build results",
    )
    args = parser.parse_args()

    root = args.package_root.resolve()
    config = load_local_config(root / "config.yaml")
    contexts = resolve_build_contexts(root, config)
    args.output_root.mkdir(parents=True, exist_ok=True, mode=0o700)
    output_dir = args.output_root / uuid4().hex
    images = build_challenge(config, contexts, output_dir)
    for name, archive in images.items():
        print(f"{name}: {archive}")


if __name__ == "__main__":
    main()
