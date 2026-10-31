import hmac
import os

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

TOKEN = os.environ["RUNNER_API_TOKEN"]
security = HTTPBearer()


def authenticate(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    if not hmac.compare_digest(credentials.credentials, TOKEN):
        raise HTTPException(status_code=401, detail="Unauthorized")
