import hashlib
import logging
import subprocess
from typing import Any

from kubernetes import client
from kubernetes.client.exceptions import ApiException

from runner.services.build_jobs import builds_root, get_job
from runner.services.package import ChallengeConfig, load_local_config

logger = logging.getLogger(__name__)

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


def challenge_namespace(competition_id: str, task_id: str) -> str:
    """A stable, independent Kubernetes namespace for each task."""
    return f"ctf-{_hash(f'{competition_id}/{task_id}', 16)}"


def _name(competition_id: str, task_id: str, service: str) -> str:
    """Stable DNS-compatible name (less than 63 characters)."""
    return (
        f"u-{_hash(f'{competition_id}/{task_id}')}-{service[:24]}-{_hash(service, 6)}"
    )


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


def _deployment(
    name: str, labels: dict[str, str], image: str, port: int, public_tcp: bool
) -> dict:
    selector = {"app": name}
    pod_labels = {**labels, **selector}
    if public_tcp:
        pod_labels["ulovko.fun/public-tcp"] = "true"
    return {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": {"name": name, "labels": labels},
        "spec": {
            "replicas": 1,
            "strategy": {"type": "Recreate"},
            "selector": {"matchLabels": selector},
            "template": {
                "metadata": {"labels": pod_labels},
                "spec": {
                    "automountServiceAccountToken": False,
                    "securityContext": {
                        "seccompProfile": {"type": "RuntimeDefault"},
                        "runAsNonRoot": True,
                        "runAsUser": 10001,
                        "runAsGroup": 10001,
                    },
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


def _service(
    name: str,
    service_name: str,
    labels: dict[str, str],
    kind: str,
    port: int,
    public: bool,
) -> dict:
    return {
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": {"name": service_name, "labels": labels},
        "spec": {
            "type": "NodePort" if public and kind == "tcp" else "ClusterIP",
            "selector": {"app": name},
            "ports": [
                {
                    "name": "http" if kind == "http" else "tcp",
                    "port": port,
                    "targetPort": port,
                    "protocol": "TCP",
                }
            ],
        },
    }


def _ingress(name: str, service_name: str, labels: dict[str, str], port: int) -> dict:
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
                                    "service": {
                                        "name": service_name,
                                        "port": {"number": port},
                                    }
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
        config = load_local_config(build_root / "config.yaml")
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


def _namespace_body(competition_id: str, task_id: str) -> dict:
    return {
        "apiVersion": "v1",
        "kind": "Namespace",
        "metadata": {
            "name": challenge_namespace(competition_id, task_id),
            "labels": {
                MANAGED_BY: "ulovko-runner",
                COMPETITION: competition_id,
                TASK: task_id,
                "pod-security.kubernetes.io/enforce": "restricted",
            },
        },
    }


def _isolation_policy() -> dict:
    """Allow sibling pods, CoreDNS, and inbound traffic from Traefik's namespace."""
    system = {
        "namespaceSelector": {
            "matchLabels": {"kubernetes.io/metadata.name": "kube-system"}
        }
    }
    dns = {**system, "podSelector": {"matchLabels": {"k8s-app": "kube-dns"}}}
    return {
        "apiVersion": "networking.k8s.io/v1",
        "kind": "NetworkPolicy",
        "metadata": {"name": "challenge-isolation"},
        "spec": {
            "podSelector": {},
            "policyTypes": ["Ingress", "Egress"],
            "ingress": [
                {"from": [{"podSelector": {}}]},
                {"from": [system]},
            ],
            "egress": [
                {"to": [{"podSelector": {}}]},
                {
                    "to": [dns],
                    "ports": [
                        {"protocol": "UDP", "port": 53},
                        {"protocol": "TCP", "port": 53},
                    ],
                },
            ],
        },
    }


def _public_tcp_policy() -> dict:
    # Public NodePorts must accept external clients. Other challenge Pods are
    # prevented from initiating cross-challenge connections by egress policy.
    return {
        "apiVersion": "networking.k8s.io/v1",
        "kind": "NetworkPolicy",
        "metadata": {"name": "public-tcp"},
        "spec": {
            "podSelector": {"matchLabels": {"ulovko.fun/public-tcp": "true"}},
            "policyTypes": ["Ingress"],
            "ingress": [{}],
        },
    }


def deploy_challenge(
    competition_id: str,
    task_id: str,
    build_id: str,
    apps: client.AppsV1Api,
    core: client.CoreV1Api,
    networking: client.NetworkingV1Api,
) -> dict[str, Any]:
    """Import built images and deploy their services into a task namespace."""
    config = _validate_build(competition_id, task_id, build_id)
    namespace = challenge_namespace(competition_id, task_id)
    try:
        core.read_namespace(namespace, _request_timeout=5)
    except ApiException as exc:
        if exc.status != 404:
            raise
    else:
        raise DeploymentConflict("Challenge is already deployed")

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

    created_namespace = False
    result: list[dict[str, str]] = []
    try:
        core.create_namespace(
            _namespace_body(competition_id, task_id), _request_timeout=15
        )
        created_namespace = True

        # Policies come before workloads, so pods are isolated on first start.
        networking.create_namespaced_network_policy(
            namespace, _isolation_policy(), _request_timeout=15
        )
        if any(
            service.public and service.type == "tcp"
            for service in config.services.values()
        ):
            networking.create_namespaced_network_policy(
                namespace, _public_tcp_policy(), _request_timeout=15
            )

        for name, service in config.services.items():
            resource_name = _name(competition_id, task_id, name)
            labels = _labels(competition_id, task_id, name, build_id)
            image = _image(build_id, name)

            apps.create_namespaced_deployment(
                namespace,
                _deployment(
                    resource_name,
                    labels,
                    image,
                    service.port,
                    service.public and service.type == "tcp",
                ),
                _request_timeout=15,
            )
            core.create_namespaced_service(
                namespace,
                _service(
                    resource_name,
                    name,
                    labels,
                    service.type,
                    service.port,
                    service.public,
                ),
                _request_timeout=15,
            )
            if service.public and service.type == "http":
                networking.create_namespaced_ingress(
                    namespace,
                    _ingress(resource_name, name, labels, service.port),
                    _request_timeout=15,
                )
            result.append({"name": name, "image": image})
    except ApiException:
        if created_namespace:
            try:
                core.delete_namespace(namespace, _request_timeout=10)
            except ApiException:
                logger.exception("Could not roll back namespace %s", namespace)
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
    core: client.CoreV1Api,
) -> dict[str, int]:
    """Deleting a challenge namespace removes all resources within it."""
    namespace = challenge_namespace(competition_id, task_id)
    try:
        resource = core.read_namespace(namespace, _request_timeout=5)
    except ApiException as exc:
        if exc.status == 404:
            return {"deleted": 0}
        raise

    labels = (resource.metadata.labels or {}) if resource.metadata else {}
    if (labels.get(MANAGED_BY), labels.get(COMPETITION), labels.get(TASK)) != (
        "ulovko-runner",
        competition_id,
        task_id,
    ):
        return {"deleted": 0}

    core.delete_namespace(namespace, _request_timeout=10)
    return {"deleted": 1}
