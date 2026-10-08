"""Non-domain endpoints: anything the client needs before it has a session."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter(tags=["meta"])


class PingResponse(BaseModel):
    pong: bool
    service: str
    version: str
    environment: str


@router.get("/ping", response_model=PingResponse, summary="Round-trip check")
async def ping() -> PingResponse:
    """Proves the browser can reach the API through the typed client."""
    return PingResponse(
        pong=True,
        service=settings.app_name,
        version=settings.app_version,
        environment=settings.environment,
    )
