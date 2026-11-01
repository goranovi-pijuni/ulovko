from fastapi import APIRouter, Depends
from kubernetes import client

from runner.kube import get_app, get_k8s

router = APIRouter(
    prefix="/workloads",
    tags=["nodes"],
)


@router.get("")
def get_workloads(
    app: client.AppsV1Api = Depends(get_app), k8s: client.CoreV1Api = Depends(get_k8s)
):
    deployments = app.list_namespaced_deployment("ctf-demo", _request_timeout=5)
    core = k8s.list_namespaced_pod("ctf-demo", _request_timeout=5)

    res = []

    for deployment in deployments.items:
        pods = []

        for pod in core.items:
            if pod.metadata.labels["app"] == deployment.metadata.name:
                pods.append(
                    {
                        "name": pod.metadata.name,
                        "phase": pod.status.phase,
                        "ready": any(
                            c.type == "Ready" and c.status == "True"
                            for c in (pod.status.conditions or [])
                        ),
                        "restarts": sum(
                            c.restart_count
                            for c in (pod.status.container_statuses or [])
                        ),
                        "node": pod.spec.node_name,
                    }
                )

        res.append(
            {
                "name": deployment.metadata.name,
                "namespace": deployment.metadata.namespace,
                "image": deployment.spec.template.spec.containers[0].image,
                "ready": bool(deployment.status.ready_replicas),
                "pods": pods,
            }
        )

    return res
