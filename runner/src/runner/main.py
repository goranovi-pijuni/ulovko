import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.security import HTTPBearer
from kubernetes import client, config

from runner.auth import authenticate
from runner.routes import challenges, nodes, workloads

TOKEN = os.environ["RUNNER_API_TOKEN"]
security = HTTPBearer()


@asynccontextmanager
async def lifespan(app: FastAPI):
    api_client = config.new_client_from_config()
    app.state.k8s = client.CoreV1Api(api_client)
    app.state.app = client.AppsV1Api(api_client)
    app.state.networking = client.NetworkingV1Api(api_client)

    try:
        yield
    finally:
        api_client.close()


app = FastAPI(lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(nodes.router, dependencies=[Depends(authenticate)])
app.include_router(workloads.router, dependencies=[Depends(authenticate)])
app.include_router(challenges.router, dependencies=[Depends(authenticate)])
