from fastapi import APIRouter, Depends, HTTPException
from kubernetes import client

from runner.kube import get_app, get_k8s, get_networking
from runner.services.inventory import _challenge_details, _inventory, _summary

router = APIRouter(prefix="/challenges", tags=["challenges"])


def _compact(challenge: dict) -> dict:
    return {
        key: challenge[key]
        for key in (
            "competition_id",
            "task_id",
            "status",
            "services_ready",
            "services_total",
        )
    }


@router.get("")
def list_challenges(apps: client.AppsV1Api = Depends(get_app)):
    challenges = _inventory(apps)
    competition_ids = sorted({ch["competition_id"] for ch in challenges})

    return {
        "summary": _summary(challenges),
        "competitions": [
            {
                "competition_id": competition_id,
                "summary": _summary(
                    [ch for ch in challenges if ch["competition_id"] == competition_id]
                ),
            }
            for competition_id in competition_ids
        ],
    }


@router.get("/{competition_id}")
def get_competition(
    competition_id: str,
    apps: client.AppsV1Api = Depends(get_app),
):
    challenges = [
        ch for ch in _inventory(apps) if ch["competition_id"] == competition_id
    ]
    if not challenges:
        raise HTTPException(status_code=404, detail="Competition not hosted")

    return {
        "competition_id": competition_id,
        "summary": _summary(challenges),
        "challenges": [_compact(ch) for ch in challenges],
    }


@router.get("/{competition_id}/{task_id}")
def get_challenge(
    competition_id: str,
    task_id: str,
    apps: client.AppsV1Api = Depends(get_app),
    core: client.CoreV1Api = Depends(get_k8s),
    networking: client.NetworkingV1Api = Depends(get_networking),
):
    challenge = next(
        (
            ch
            for ch in _inventory(apps)
            if ch["competition_id"] == competition_id and ch["task_id"] == task_id
        ),
        None,
    )
    if challenge is None:
        raise HTTPException(status_code=404, detail="Challenge not hosted")

    return _challenge_details(challenge, core, networking)
