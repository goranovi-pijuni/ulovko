import hashlib
import logging
import os
import subprocess
from typing import Any

from kubernetes import client
from kubernetes.client.exceptions import ApiException

from runner.services.build_jobs import builds_root, get_job
from runner.services.package import ChallengeConfig, load_local_config

logger = logging.getLogger(__name__)

NAMESPACE = os.getenv("RUNNER_CHALLENGE_NAMESPACE", "ctf-demo")
MANAGED_BY = "app.kubernetes.io/managed-by"
COMPETITION = "ulovko.fun/competition-id"
TASK = "ulovko.fun/task-id"
SERVICE = "ulovko.fun/service"
BUILD_ID = "ulovko.fun/build-id"
IMAGE_IMPORT = "/usr/local/libexec/ulovko/import-image.sh"


class DeploymentError(RuntimeError):
    """Invalid or unavailable build, or a failed image import."""


class DeploymentConflict(DeploymentError):
    """This challenge already has Kubernetes resources."""


class ImageImportError(DeploymentError):
    """The built OCI archive could not be installed into K3s."""


def _hash(value: str, length: int = 12) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:length]


def _name(competition_id: str, task_id: str, service: str) -> str:
    """Stable DNS-compatible name (less than 63 characters)."""
    return (
        f"u-{_hash(f'{competition_id}/{task_id}')}-{service[:24]}-{_hash(service, 6)}"
    )


def _selector(competition_id: str, task_id: str) -> str:
    return f"{MANAGED_BY}=ulovko-runner,{COMPETITION}={competition_id},{TASK}={task_id}"


def _labels(
    competition_id: str, task_id: str, service: str, build_id: str
) -> dict[str, str]:
    return {
        MANAGED_BY: "ulovko-runner",
        COMPETITION: competition_id,
        TASK: task_id,
        SERVICE: service,
        BUILD_ID: build_id,
    }


def _image(build_id: str, service: str) -> str:
    # Local-only name. Never pulled from an external registry.
    return f"ulovko.local/challenges/{build_id}/{service}:v1"


def _deployment(name: str, labels: dict[str, str], image: str, port: int) -> dict:
    selector = {"app": name}
    return {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": {"name": name, "labels": labels},
        "spec": {
            "replicas": 1,
            "strategy": {"type": "Recreate"},
            "selector": {"matchLabels": selector},
            "template": {
                "metadata": {"labels": {**labels, **selector}},
                "spec": {
                    "automountServiceAccountToken": False,
                    "securityContext": {"seccompProfile": {"type": "RuntimeDefault"}},
                    "containers": [
                        {
                            "name": "service",
                            "image": image,
                            "imagePullPolicy": "Never",
                            "ports": [{"containerPort": port, "protocol": "TCP"}],
                            "readinessProbe": {
                                "tcpSocket": {"port": port},
                                "initialDelaySeconds": 1,
                                "periodSeconds": 5,
                            },
                            "securityContext": {
                                "allowPrivilegeEscalation": False,
                                "capabilities": {"drop": ["ALL"]},
                            },
                            "resources": {
                                "requests": {"cpu": "25m", "memory": "32Mi"},
                                "limits": {"cpu": "250m", "memory": "128Mi"},
                            },
                        }
                    ],
                },
            },
        },
    }


def _service(name: str, labels: dict[str, str], kind: str, port: int) -> dict:
    return {
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": {"name": name, "labels": labels},
        "spec": {
            "type": "ClusterIP" if kind == "http" else "NodePort",
            "selector": {"app": name},
            "ports": [
                {
                    "name": "http" if kind == "http" else "tcp",
                    "port": 80 if kind == "http" else port,
                    "targetPort": port,
                    "protocol": "TCP",
                }
            ],
        },
    }


def _ingress(name: str, labels: dict[str, str]) -> dict:
    # Assumes a wildcard DNS record *.chal.ulovko.fun -> K3s VPS.
    return {
        "apiVersion": "networking.k8s.io/v1",
        "kind": "Ingress",
        "metadata": {"name": name, "labels": labels},
        "spec": {
            "ingressClassName": "traefik",
            "rules": [
                {
                    "host": f"{name}.chal.ulovko.fun",
                    "http": {
                        "paths": [
                            {
                                "path": "/",
                                "pathType": "Prefix",
                                "backend": {
                                    "service": {"name": name, "port": {"number": 80}}
                                },
                            }
                        ]
                    },
                }
            ],
        },
    }


def _validate_build(
    competition_id: str, task_id: str, build_id: str
) -> ChallengeConfig:
    job = get_job(build_id)
    if job is None:
        raise DeploymentError("Build not found")
    if (job.get("competition_id"), job.get("task_id")) != (competition_id, task_id):
        raise DeploymentError("Build belongs to another challenge")
    if job.get("status") != "succeeded":
        raise DeploymentError("Build is not successful")

    build_root = builds_root() / build_id
    try:
        config = load_local_config(build_root / "config.yml")
    except (ValueError, OSError) as exc:
        raise DeploymentError("Build configuration is missing or invalid") from exc
    expected = {name: f"{name}.oci.tar" for name in config.services}
    if job.get("images") != expected:
        raise DeploymentError("Build images do not match configuration")
    for filename in expected.values():
        path = build_root / "images" / filename
        if not path.is_file() or path.is_symlink():
            raise DeploymentError(f"Missing image archive: {filename}")
    return config


def deploy_challenge(
    competition_id: str,
    task_id: str,
    build_id: str,
    apps: client.AppsV1Api,
    core: client.CoreV1Api,
    networking: client.NetworkingV1Api,
) -> dict[str, Any]:
    """Import all built images and create one workload per configured service."""
    config = _validate_build(competition_id, task_id, build_id)
    selector = _selector(competition_id, task_id)
    if apps.list_namespaced_deployment(
        NAMESPACE, label_selector=selector, _request_timeout=5
    ).items:
        raise DeploymentConflict("Challenge is already deployed")

    # This is a fixed, root-owned helper. No arbitrary command or path comes
    # from the API request, and FastAPI does not access containerd directly.
    for name in config.services:
        try:
            subprocess.run(
                ["sudo", "-n", IMAGE_IMPORT, build_id, name],
                check=True,
                capture_output=True,
                timeout=300,
                text=True,
            )
        except (
            subprocess.CalledProcessError,
            subprocess.TimeoutExpired,
            OSError,
        ) as exc:
            logger.exception("Failed importing %s from build %s", name, build_id)
            raise ImageImportError(f"Failed to import image for {name}") from exc

    created: list[tuple[Any, str]] = []
    result: list[dict[str, str]] = []
    try:
        for name, service in config.services.items():
            resource_name = _name(competition_id, task_id, name)
            labels = _labels(competition_id, task_id, name, build_id)
            image = _image(build_id, name)

            apps.create_namespaced_deployment(
                NAMESPACE,
                _deployment(resource_name, labels, image, service.port),
                _request_timeout=15,
            )
            created.append((apps.delete_namespaced_deployment, resource_name))

            core.create_namespaced_service(
                NAMESPACE,
                _service(resource_name, labels, service.type, service.port),
                _request_timeout=15,
            )
            created.append((core.delete_namespaced_service, resource_name))

            if service.type == "http":
                networking.create_namespaced_ingress(
                    NAMESPACE, _ingress(resource_name, labels), _request_timeout=15
                )
                created.append((networking.delete_namespaced_ingress, resource_name))

            result.append({"name": name, "image": image})
    except ApiException:
        # Roll back resources created in this call; imported images remain cached.
        for delete, resource_name in reversed(created):
            try:
                delete(resource_name, NAMESPACE, _request_timeout=10)
            except ApiException:
                logger.exception("Could not roll back %s", resource_name)
        raise

    return {
        "competition_id": competition_id,
        "task_id": task_id,
        "build_id": build_id,
        "status": "starting",
        "services": result,
    }


def delete_challenge(
    competition_id: str,
    task_id: str,
    apps: client.AppsV1Api,
    core: client.CoreV1Api,
    networking: client.NetworkingV1Api,
) -> dict[str, int]:
    """Remove only resources created by this deployer, not unrelated demos."""
    selector = _selector(competition_id, task_id)
    expected_prefix = f"u-{_hash(f'{competition_id}/{task_id}')}-"
    resources = (
        (
            networking.list_namespaced_ingress,
            networking.delete_namespaced_ingress,
        ),
        (core.list_namespaced_service, core.delete_namespaced_service),
        (apps.list_namespaced_deployment, apps.delete_namespaced_deployment),
    )
    count = 0
    for listing, deleting in resources:
        for item in listing(
            NAMESPACE, label_selector=selector, _request_timeout=5
        ).items:
            name = item.metadata.name if item.metadata else ""
            if not name.startswith(expected_prefix):
                continue
            deleting(name, NAMESPACE, _request_timeout=10)
            count += 1
    return {"deleted": count}
