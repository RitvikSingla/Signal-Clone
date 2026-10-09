"""FastAPI application factory.

Kept deliberately thin. Routing lives in app/api, business rules live in
app/services, and the socket hub lives in app/realtime. This module only
assembles them.
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1 import api_router
from app.core.config import settings
from app.realtime.router import router as realtime_router


log = logging.getLogger("signal.sweeper")

#: How often expired disappearing messages are deleted. The shortest timer
#: Signal offers is 30 seconds, so a two-second sweep is well inside it.
SWEEP_SECONDS = 2.0


async def sweep_forever() -> None:
    from app.db.session import AsyncSessionLocal
    from app.realtime import broadcast
    from app.services import message_service

    while True:
        try:
            async with AsyncSessionLocal() as db:
                expired = await message_service.sweep_expired(db)
                if expired:
                    await broadcast.messages_expired(db, expired)
        except Exception:  # never let one bad sweep stop the loop
            log.exception("disappearing-message sweep failed")
        await asyncio.sleep(SWEEP_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown work: media folder, and the expiry sweeper."""
    settings.media_root.mkdir(parents=True, exist_ok=True)
    sweeper = asyncio.create_task(sweep_forever())
    try:
        yield
    finally:
        sweeper.cancel()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        docs_url="/docs",
        redoc_url=None,
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.api_v1_prefix)
    # The socket sits outside the versioned prefix: it is not a REST
    # resource and its protocol is versioned by the frame types instead.
    app.include_router(realtime_router)

    @app.middleware("http")
    async def media_headers(request: Request, call_next):
        """Uploaded files are served from this origin, so never let a browser
        sniff one into something executable, and make opaque files download."""
        response = await call_next(request)
        if request.url.path.startswith(settings.media_url_prefix):
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["Content-Security-Policy"] = "default-src 'none'; sandbox"
            if request.url.path.endswith(".bin"):
                response.headers["Content-Disposition"] = "attachment"
        return response

    settings.media_root.mkdir(parents=True, exist_ok=True)
    app.mount(
        settings.media_url_prefix,
        StaticFiles(directory=settings.media_root),
        name="media",
    )

    @app.get("/health", tags=["meta"], summary="Liveness probe")
    async def health() -> dict:
        """Used by the hosting platform and by the frontend smoke test."""
        return {
            "status": "ok",
            "service": settings.app_name,
            "version": settings.app_version,
            "environment": settings.environment,
        }

    return app


app = create_app()
