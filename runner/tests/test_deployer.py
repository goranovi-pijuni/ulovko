"""Deployment tests use fake Kubernetes clients; no cluster is required."""

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from kubernetes.client.exceptions import ApiException

from runner.services import deployer
from runner.services.package import parse_config

BUILD_ID = "a" * 32
CONFIG = parse_config(
    """services:
  web1:
    type: http
    path: web1
    port: 8080
  test:
    type: tcp
    path: test
    port: 5000
"""
)


class FakeResources:
    def __init__(self, kind: str, fail_create: bool = False):
        self.kind = kind
        self.fail_create = fail_create
        self.objects = {}

    def __getattr__(self, name):
        if name == f"list_namespaced_{self.kind}":
            return lambda namespace, **kwargs: SimpleNamespace(
                items=[
                    SimpleNamespace(metadata=SimpleNamespace(name=key))
                    for key in self.objects
                ]
            )
        if name == f"create_namespaced_{self.kind}":

            def create(namespace, body, **kwargs):
                if self.fail_create:
                    raise ApiException(status=500, reason="Fake creation failed")
                self.objects[body["metadata"]["name"]] = body

            return create
        if name == f"delete_namespaced_{self.kind}":

            def delete(name, namespace, **kwargs):
                self.objects.pop(name)

            return delete
        raise AttributeError(name)


@pytest.fixture
def fake_build(monkeypatch, tmp_path: Path):
    build = tmp_path / BUILD_ID
    (build / "images").mkdir(parents=True)
    (build / "config.yaml").write_text(
        """services:
  web1:
    type: http
    path: web1
    port: 8080
  test:
    type: tcp
    path: test
    port: 5000
""",
        encoding="utf-8",
    )
    for name in CONFIG.services:
        (build / "images" / f"{name}.oci.tar").write_bytes(b"mock archive")
    job = {
        "status": "succeeded",
        "competition_id": "demo-competition",
        "task_id": "demo-challenge",
        "images": {name: f"{name}.oci.tar" for name in CONFIG.services},
    }
    monkeypatch.setattr(deployer, "builds_root", lambda: tmp_path)
    monkeypatch.setattr(deployer, "get_job", lambda build_id: job)
    importer = Mock()
    monkeypatch.setattr(deployer.subprocess, "run", importer)
    return job, importer


def test_creates_deployments_services_ingress_and_imports(fake_build):
    job, importer = fake_build
    apps = FakeResources("deployment")
    core = FakeResources("service")
    networking = FakeResources("ingress")
    response = deployer.deploy_challenge(
        job["competition_id"], job["task_id"], BUILD_ID, apps, core, networking
    )
    assert response["status"] == "starting"
    assert len(apps.objects) == 2
    assert len(core.objects) == 2
    assert len(networking.objects) == 1
    assert importer.call_count == 2

    http_name = deployer._name("demo-competition", "demo-challenge", "web1")
    tcp_name = deployer._name("demo-competition", "demo-challenge", "test")
    assert len(http_name) <= 63
    assert (
        apps.objects[http_name]["spec"]["template"]["spec"]["containers"][0][
            "imagePullPolicy"
        ]
        == "Never"
    )
    assert core.objects[http_name]["spec"]["type"] == "ClusterIP"
    assert core.objects[tcp_name]["spec"]["type"] == "NodePort"
    assert "nodePort" not in core.objects[tcp_name]["spec"]["ports"][0]
    assert networking.objects[http_name]["spec"]["rules"][0]["host"].endswith(
        ".chal.ulovko.fun"
    )


def test_invalid_build_does_not_import(fake_build):
    job, importer = fake_build
    job["status"] = "failed"
    with pytest.raises(deployer.DeploymentError, match="not successful"):
        deployer.deploy_challenge(
            "demo-competition",
            "demo-challenge",
            BUILD_ID,
            FakeResources("deployment"),
            FakeResources("service"),
            FakeResources("ingress"),
        )
    importer.assert_not_called()


def test_rollback_if_creation_fails(fake_build):
    apps = FakeResources("deployment")
    core = FakeResources("service", fail_create=True)
    networking = FakeResources("ingress")
    with pytest.raises(ApiException):
        deployer.deploy_challenge(
            "demo-competition", "demo-challenge", BUILD_ID, apps, core, networking
        )
    assert not apps.objects


def test_delete_only_created_resources(fake_build):
    apps = FakeResources("deployment")
    core = FakeResources("service")
    networking = FakeResources("ingress")
    deployer.deploy_challenge(
        "demo-competition", "demo-challenge", BUILD_ID, apps, core, networking
    )
    apps.objects["unrelated-demo"] = {"metadata": {"name": "unrelated-demo"}}
    result = deployer.delete_challenge(
        "demo-competition", "demo-challenge", apps, core, networking
    )
    assert result["deleted"] == 5
    assert list(apps.objects) == ["unrelated-demo"]
