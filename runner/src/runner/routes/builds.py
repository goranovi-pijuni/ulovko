from fastapi import APIRouter, HTTPException, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

from runner.services.build_jobs import (
    get_job,
    read_log,
    submit_job,
)
from runner.services.identifiers import (
    canonical_competition_id,
    canonical_task_id,
)

router = APIRouter(prefix="/builds", tags=["builds"])


class CreateBuildRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    competition_id: str = Field(
        min_length=1, max_length=63, pattern=r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$"
    )
    task_id: str = Field(
        min_length=1, max_length=63, pattern=r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$"
    )

    @field_validator("competition_id")
    @classmethod
    def normalize_competition_id(cls, value: str) -> str:
        return canonical_competition_id(value)

    @field_validator("task_id")
    @classmethod
    def normalize_task_id(cls, value: str) -> str:
        return canonical_task_id(value)


@router.post("", status_code=status.HTTP_202_ACCEPTED)
def create_build(body: CreateBuildRequest):
    # The worker retrieves R2/<competition_id>/<task_id>/ after queuing.
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
