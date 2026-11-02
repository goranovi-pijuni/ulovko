"""Deployment tests use fake Kubernetes clients; no cluster is required."""

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from kubernetes.client.exceptions import ApiException

from runner.services import deployer
from runner.services.package import parse_config

BUILD_ID = "a" * 32
COMPETITION = "demo-competition"
TASK = "demo-challenge"
NAMESPACE = deployer.challenge_namespace(COMPETITION, TASK)
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


class FakeCore:
    def __init__(self):
        self.namespaces = {}
        self.services = {}
        self.deleted = []

    def read_namespace(self, name, **kwargs):
        if name not in self.namespaces:
            raise ApiException(status=404)
        data = self.namespaces[name]
        return SimpleNamespace(
            metadata=SimpleNamespace(labels=data["metadata"]["labels"])
        )

    def create_namespace(self, body, **kwargs):
        name = body["metadata"]["name"]
        if name in self.namespaces:
            raise ApiException(status=409)
        self.namespaces[name] = body

    def delete_namespace(self, name, **kwargs):
        self.deleted.append(name)
        self.namespaces.pop(name)
        self.services = {
            key: obj for key, obj in self.services.items() if key[0] != name
        }

    def create_namespaced_service(self, namespace, body, **kwargs):
        self.services[(namespace, body["metadata"]["name"])] = body


class FakeApps:
    def __init__(self):
        self.deployments = {}

    def create_namespaced_deployment(self, namespace, body, **kwargs):
        self.deployments[(namespace, body["metadata"]["name"])] = body


class FakeNetworking:
    def __init__(self, *, fail_ingress=False):
        self.ingresses = {}
        self.policies = {}
        self.fail_ingress = fail_ingress

    def create_namespaced_ingress(self, namespace, body, **kwargs):
        if self.fail_ingress:
            raise ApiException(status=500, reason="Fake creation failed")
        self.ingresses[(namespace, body["metadata"]["name"])] = body

    def create_namespaced_network_policy(self, namespace, body, **kwargs):
        self.policies[(namespace, body["metadata"]["name"])] = body


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
        "competition_id": COMPETITION,
        "task_id": TASK,
        "images": {name: f"{name}.oci.tar" for name in CONFIG.services},
    }
    monkeypatch.setattr(deployer, "builds_root", lambda: tmp_path)
    monkeypatch.setattr(deployer, "get_job", lambda build_id: job)
    importer = Mock()
    monkeypatch.setattr(deployer.subprocess, "run", importer)
    return job, importer


def test_deploy_creates_namespace_services_and_routes(fake_build):
    _, importer = fake_build
    core, apps, networking = FakeCore(), FakeApps(), FakeNetworking()
    result = deployer.deploy_challenge(
        COMPETITION, TASK, BUILD_ID, apps, core, networking
    )

    assert result["status"] == "starting"
    assert list(core.namespaces) == [NAMESPACE]
    namespace_labels = core.namespaces[NAMESPACE]["metadata"]["labels"]
    assert namespace_labels["pod-security.kubernetes.io/enforce"] == "restricted"
    assert len(apps.deployments) == 2
    assert set(core.services) == {(NAMESPACE, "web1"), (NAMESPACE, "test")}
    assert len(networking.ingresses) == 1
    assert importer.call_count == 2

    http = core.services[(NAMESPACE, "web1")]
    tcp = core.services[(NAMESPACE, "test")]
    assert http["spec"]["type"] == "ClusterIP"
    assert http["spec"]["ports"][0]["port"] == 8080
    assert tcp["spec"]["type"] == "NodePort"
    assert tcp["spec"]["ports"][0]["port"] == 5000
    assert "nodePort" not in tcp["spec"]["ports"][0]

    ingress = next(iter(networking.ingresses.values()))
    backend = ingress["spec"]["rules"][0]["http"]["paths"][0]["backend"]["service"]
    assert backend == {"name": "web1", "port": {"number": 8080}}
    assert ingress["spec"]["rules"][0]["host"].endswith(".chal.ulovko.fun")
    assert all(
        pod["spec"]["template"]["spec"]["containers"][0]["imagePullPolicy"]
        == "Never"
        for pod in apps.deployments.values()
    )


def test_private_tcp_is_internal_only(fake_build, tmp_path):
    _, importer = fake_build
    (tmp_path / BUILD_ID / "config.yaml").write_text(
        """services:
  web1:
    type: http
    path: web1
    port: 8080
  test:
    type: tcp
    path: test
    port: 5000
    public: false
""",
        encoding="utf-8",
    )
    core, apps, networking = FakeCore(), FakeApps(), FakeNetworking()
    deployer.deploy_challenge(COMPETITION, TASK, BUILD_ID, apps, core, networking)

    assert importer.call_count == 2  # Private services are still built and deployed.
    assert core.services[(NAMESPACE, "test")]["spec"]["type"] == "ClusterIP"
    assert core.services[(NAMESPACE, "test")]["spec"]["ports"][0]["port"] == 5000
    assert core.services[(NAMESPACE, "test")]["spec"]["selector"] == {
        "app": deployer._name(COMPETITION, TASK, "test")
    }
    assert len(networking.ingresses) == 1  # Only web1 is publicly routed.
    assert (NAMESPACE, "public-tcp") not in networking.policies
    assert (NAMESPACE, "challenge-isolation") in networking.policies
    tcp_name = deployer._name(COMPETITION, TASK, "test")
    pod_labels = apps.deployments[(NAMESPACE, tcp_name)]["spec"]["template"][
        "metadata"
    ]["labels"]
    assert "ulovko.fun/public-tcp" not in pod_labels


def test_private_http_has_no_ingress(fake_build, tmp_path):
    (tmp_path / BUILD_ID / "config.yaml").write_text(
        """services:
  web1:
    type: http
    path: web1
    port: 8080
    public: false
  test:
    type: tcp
    path: test
    port: 5000
""",
        encoding="utf-8",
    )
    core, apps, networking = FakeCore(), FakeApps(), FakeNetworking()
    deployer.deploy_challenge(COMPETITION, TASK, BUILD_ID, apps, core, networking)

    assert core.services[(NAMESPACE, "web1")]["spec"]["type"] == "ClusterIP"
    assert core.services[(NAMESPACE, "test")]["spec"]["type"] == "NodePort"
    assert networking.ingresses == {}
    assert (NAMESPACE, "public-tcp") in networking.policies


def test_policies_allow_siblings_dns_and_public_tcp(fake_build):
    core, apps, networking = FakeCore(), FakeApps(), FakeNetworking()
    deployer.deploy_challenge(COMPETITION, TASK, BUILD_ID, apps, core, networking)

    isolation = networking.policies[(NAMESPACE, "challenge-isolation")]["spec"]
    assert isolation["policyTypes"] == ["Ingress", "Egress"]
    assert {"from": [{"podSelector": {}}]} in isolation["ingress"]
    assert {"to": [{"podSelector": {}}]} in isolation["egress"]
    assert isolation["egress"][1]["ports"] == [
        {"protocol": "UDP", "port": 53}, {"protocol": "TCP", "port": 53}
    ]
    tcp_policy = networking.policies[(NAMESPACE, "public-tcp")]["spec"]
    assert tcp_policy["podSelector"]["matchLabels"] == {
        "ulovko.fun/public-tcp": "true"
    }
    assert tcp_policy["ingress"] == [{}]
    tcp_name = deployer._name(COMPETITION, TASK, "test")
    tcp_deployment = apps.deployments[(NAMESPACE, tcp_name)]
    tcp_labels = tcp_deployment["spec"]["template"]["metadata"]["labels"]
    assert tcp_labels["ulovko.fun/public-tcp"] == "true"


def test_conflict_does_not_import(fake_build):
    _, importer = fake_build
    core = FakeCore()
    core.create_namespace(deployer._namespace_body(COMPETITION, TASK))
    with pytest.raises(deployer.DeploymentConflict, match="already deployed"):
        deployer.deploy_challenge(
            COMPETITION, TASK, BUILD_ID, FakeApps(), core, FakeNetworking()
        )
    importer.assert_not_called()


def test_invalid_build_does_not_import(fake_build):
    job, importer = fake_build
    job["status"] = "failed"
    with pytest.raises(deployer.DeploymentError, match="not successful"):
        deployer.deploy_challenge(
            COMPETITION, TASK, BUILD_ID, FakeApps(), FakeCore(), FakeNetworking()
        )
    importer.assert_not_called()


def test_failed_creation_rolls_back_namespace(fake_build):
    core = FakeCore()
    networking = FakeNetworking(fail_ingress=True)
    with pytest.raises(ApiException):
        deployer.deploy_challenge(
            COMPETITION, TASK, BUILD_ID, FakeApps(), core, networking
        )
    assert core.deleted == [NAMESPACE]
    assert not core.namespaces


def test_delete_removes_own_namespace_only(fake_build):
    core, apps, networking = FakeCore(), FakeApps(), FakeNetworking()
    deployer.deploy_challenge(COMPETITION, TASK, BUILD_ID, apps, core, networking)
    core.create_namespace({"metadata": {"name": "unrelated", "labels": {}}})

    assert deployer.delete_challenge(COMPETITION, TASK, core) == {"deleted": 1}
    assert list(core.namespaces) == ["unrelated"]
    assert core.deleted == [NAMESPACE]
    assert deployer.delete_challenge(COMPETITION, TASK, core) == {"deleted": 0}


def test_delete_rejects_namespace_without_expected_labels():
    core = FakeCore()
    core.create_namespace({"metadata": {"name": NAMESPACE, "labels": {}}})
    assert deployer.delete_challenge(COMPETITION, TASK, core) == {"deleted": 0}
    assert NAMESPACE in core.namespaces
