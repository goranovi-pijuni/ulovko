"""Inventory reads deployments and endpoints from their challenge namespaces."""

from types import SimpleNamespace as Obj
from unittest.mock import Mock

from runner.services.deployer import _name, challenge_namespace
from runner.services.inventory import _challenge_details, _inventory


def fake_deployment(comp: str, task: str, service: str, namespace: str):
    pod_labels = {"app": _name(comp, task, service)}
    return Obj(
        metadata=Obj(namespace=namespace, name=pod_labels["app"], labels={
            "ulovko.fun/competition-id": comp,
            "ulovko.fun/task-id": task,
            "ulovko.fun/service": service,
        }),
        spec=Obj(replicas=1, template=Obj(
            metadata=Obj(labels=pod_labels),
            spec=Obj(containers=[Obj(image="ulovko.local/challenges/a/web1:v1")]),
        )),
        status=Obj(ready_replicas=1),
    )


def test_inventory_lists_challenge_namespaces_only():
    namespace = challenge_namespace("demo-competition", "demo-challenge")
    apps = Mock()
    apps.list_deployment_for_all_namespaces.return_value.items = [
        fake_deployment("demo-competition", "demo-challenge", "web1", namespace),
        fake_deployment("demo-competition", "demo-challenge", "web1", "ctf-demo"),
    ]
    result = _inventory(apps)
    assert len(result) == 1
    assert result[0]["services_total"] == 1
    assert result[0]["services_ready"] == 1
    assert result[0]["status"] == "healthy"
    apps.list_deployment_for_all_namespaces.assert_called_once()


def test_inventory_attaches_endpoints_from_challenge_namespace():
    comp, task = "demo-competition", "demo-challenge"
    namespace = challenge_namespace(comp, task)
    apps, core, networking = Mock(), Mock(), Mock()
    apps.list_deployment_for_all_namespaces.return_value.items = [
        fake_deployment(comp, task, "web1", namespace),
    ]
    core.list_namespaced_service.return_value.items = [
        Obj(metadata=Obj(name="web1"), spec=Obj(selector={
            "app": _name(comp, task, "web1")
        }, type="ClusterIP")),
    ]
    networking.list_namespaced_ingress.return_value.items = [
        Obj(spec=Obj(tls=[], rules=[Obj(
            host=f"{_name(comp, task, 'web1')}.chal.ulovko.fun",
            http=Obj(paths=[Obj(
                path="/", backend=Obj(service=Obj(name="web1")),
            )]),
        )])),
    ]

    challenge = _challenge_details(_inventory(apps)[0], core, networking)
    assert challenge["services"][0]["endpoints"][0]["url"].endswith(".chal.ulovko.fun/")
    assert "_pod_labels" not in challenge["services"][0]
    core.list_namespaced_service.assert_called_once_with(namespace, _request_timeout=5)
    networking.list_namespaced_ingress.assert_called_once_with(
        namespace, _request_timeout=5
    )
