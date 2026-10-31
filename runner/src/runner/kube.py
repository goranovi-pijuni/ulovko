from fastapi import Request
from kubernetes import client


def get_k8s(request: Request) -> client.CoreV1Api:
    return request.app.state.k8s


def get_app(request: Request) -> client.CoreV1Api:
    return request.app.state.app


def get_networking(request: Request) -> client.NetworkingV1Api:
    return request.app.state.networking
