from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status
from kubernetes import client
from kubernetes.client.exceptions import ApiException
from pydantic import BaseModel, ConfigDict, Field

from runner.kube import get_app, get_k8s, get_networking
from runner.services.deployer import (
    DeploymentConflict,
    DeploymentError,
    ImageImportError,
    delete_challenge,
    deploy_challenge,
)
from runner.services.identifiers import (
    canonical_competition_id,
    canonical_task_id,
)

router = APIRouter(prefix="/challenges", tags=["challenges"])

CompetitionId = Annotated[
    str, Path(min_length=1, max_length=63, pattern=r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$")
]
TaskId = Annotated[
    str, Path(min_length=1, max_length=63, pattern=r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$")
]


class DeployRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    build_id: str = Field(pattern=r"^[0-9a-f]{32}$")


@router.post("/{competition_id}/{task_id}/deploy", status_code=status.HTTP_202_ACCEPTED)
def deploy(
    competition_id: CompetitionId,
    task_id: TaskId,
    body: DeployRequest,
    apps: Annotated[client.AppsV1Api, Depends(get_app)],
    core: Annotated[client.CoreV1Api, Depends(get_k8s)],
    networking: Annotated[client.NetworkingV1Api, Depends(get_networking)],
):
    try:
        competition_id = canonical_competition_id(competition_id)
        task_id = canonical_task_id(task_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    try:
        return deploy_challenge(
            competition_id, task_id, body.build_id, apps, core, networking
        )
    except DeploymentConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ImageImportError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except DeploymentError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ApiException as exc:
        code = 409 if exc.status == 409 else 502
        raise HTTPException(
            status_code=code, detail="Kubernetes rejected deployment"
        ) from exc


@router.delete("/{competition_id}/{task_id}")
def undeploy(
    competition_id: CompetitionId,
    task_id: TaskId,
    core: Annotated[client.CoreV1Api, Depends(get_k8s)],
):
    try:
        competition_id = canonical_competition_id(competition_id)
        task_id = canonical_task_id(task_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    try:
        result = delete_challenge(competition_id, task_id, core)
    except ApiException as exc:
        raise HTTPException(
            status_code=502, detail="Kubernetes rejected deletion"
        ) from exc
    if result["deleted"] == 0:
        raise HTTPException(status_code=404, detail="Challenge not deployed")
    return result
