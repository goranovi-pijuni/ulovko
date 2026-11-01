from fastapi import APIRouter, Depends
from kubernetes import client

from runner.kube import get_k8s

router = APIRouter(
    prefix="/nodes",
    tags=["nodes"],
)


@router.get("")
def get_nodes(k8s: client.CoreV1Api = Depends(get_k8s)):
    nodes = k8s.list_node(_request_timeout=5)

    return [
        {
            "name": node.metadata.name,
            "ready": any(
                c.type == "Ready" and c.status == "True"
                for c in (node.status.conditions or [])
            ),
            "capacity": node.status.capacity,
            "allocatable": node.status.allocatable,
            "version": node.status.node_info.kubelet_version,
        }
        for node in nodes.items
    ]
