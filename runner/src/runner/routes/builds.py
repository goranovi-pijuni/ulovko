"""HTTP endpoints for submitting and inspecting asynchronous image builds."""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, ConfigDict, Field

from runner.services.build_jobs import (
    example_root,
    get_job,
    read_log,
    submit_job,
)
from runner.services.package import load_local_config, resolve_build_contexts

router = APIRouter(prefix="/builds", tags=["builds"])


class CreateBuildRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    competition_id: str = Field(
        min_length=1, max_length=63, pattern=r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$"
    )
    task_id: str = Field(
        min_length=1, max_length=63, pattern=r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$"
    )


@router.post("", status_code=status.HTTP_202_ACCEPTED)
def create_build(body: CreateBuildRequest):
    # Only the version-controlled example can be built for now. Never accept
    # a local filesystem path from an API caller.
    package = example_root()
    try:
        config = load_local_config(package / "config.yaml")
        resolve_build_contexts(package, config)
    except (OSError, ValueError) as exc:
        raise HTTPException(
            status_code=503, detail="Demo challenge package is not available"
        ) from exc
    return submit_job(body.competition_id, body.task_id)


@router.get("/{build_id}")
def get_build(build_id: str):
    job = get_job(build_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Build not found")
    return job


@router.get("/{build_id}/logs/{service}", response_class=PlainTextResponse)
def get_build_log(build_id: str, service: str):
    content = read_log(build_id, service)
    if content is None:
        raise HTTPException(status_code=404, detail="Build log not found")
    return content
