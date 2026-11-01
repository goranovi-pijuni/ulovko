import os

from kubernetes import client

NAMESPACE = os.getenv("RUNNER_CHALLENGE_NAMESPACE", "ctf-demo")
TCP_HOST = os.getenv("RUNNER_TCP_HOST")
HTTP_SCHEME = os.getenv("RUNNER_HTTP_SCHEME")

COMPETITION_LABEL = "ulovko.fun/competition-id"
TASK_LABEL = "ulovko.fun/task-id"
SERVICE_LABEL = "ulovko.fun/service"
MANAGED_SELECTOR = "app.kubernetes.io/managed-by=ulovko-runner"


def _inventory(apps: client.AppsV1Api) -> list[dict]:
    deployments = apps.list_namespaced_deployment(
        namespace=NAMESPACE,
        label_selector=MANAGED_SELECTOR,
        _request_timeout=5,
    )
    found = {}

    for deployment in deployments.items:
        metadata = deployment.metadata
        labels = (metadata.labels or {}) if metadata else {}
        competition_id = labels.get(COMPETITION_LABEL)
        task_id = labels.get(TASK_LABEL)
        service_name = labels.get(SERVICE_LABEL)
        if not all((competition_id, task_id, service_name)):
            continue

        key = (competition_id, task_id)
        challenge = found.setdefault(
            key,
            {
                "competition_id": competition_id,
                "task_id": task_id,
                "services": [],
            },
        )

        spec = deployment.spec
        desired = spec.replicas if spec and spec.replicas is not None else 1
        ready = (deployment.status.ready_replicas or 0) if deployment.status else 0
        template = spec.template if spec else None
        template_metadata = template.metadata if template else None
        pod_labels = (template_metadata.labels or {}) if template_metadata else {}
        pod_spec = template.spec if template else None
        containers = pod_spec.containers if pod_spec else []

        challenge["services"].append(
            {
                "name": service_name,
                "deployment": metadata.name,
                "image": containers[0].image if containers else None,
                "ready": desired > 0 and ready >= desired,
                "_pod_labels": pod_labels,
            }
        )

    for challenge in found.values():
        challenge["services"].sort(key=lambda item: item["name"])
        total = len(challenge["services"])
        ready = sum(service["ready"] for service in challenge["services"])
        challenge["services_total"] = total
        challenge["services_ready"] = ready
        challenge["status"] = (
            "healthy" if ready == total else "degraded" if ready else "unavailable"
        )

    return sorted(found.values(), key=lambda ch: (ch["competition_id"], ch["task_id"]))


def _summary(challenges: list[dict]) -> dict:
    return {
        "total": len(challenges),
        "healthy": sum(ch["status"] == "healthy" for ch in challenges),
        "degraded": sum(ch["status"] == "degraded" for ch in challenges),
        "unavailable": sum(ch["status"] == "unavailable" for ch in challenges),
    }


def _endpoints(
    service: client.V1Service, ingresses: list[client.V1Ingress]
) -> list[dict]:
    result = []
    name = service.metadata.name if service.metadata else None
    if not name:
        return result

    for ingress in ingresses:
        spec = ingress.spec
        if not spec:
            continue
        tls_hosts = {host for tls in (spec.tls or []) for host in (tls.hosts or [])}
        for rule in spec.rules or []:
            if not rule.host or not rule.http:
                continue
            for path in rule.http.paths or []:
                backend = path.backend.service if path.backend else None
                if backend and backend.name == name:
                    scheme = HTTP_SCHEME or (
                        "https" if rule.host in tls_hosts else "http"
                    )
                    result.append(
                        {
                            "protocol": scheme,
                            "url": f"{scheme}://{rule.host}{path.path or '/'}",
                        }
                    )

    if service.spec and service.spec.type == "NodePort":
        for port in service.spec.ports or []:
            if port.node_port is not None and (port.protocol or "TCP") == "TCP":
                endpoint = {"protocol": "tcp", "port": port.node_port}
                if TCP_HOST:
                    endpoint["host"] = TCP_HOST
                result.append(endpoint)

    return result
