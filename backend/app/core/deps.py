"""Shared FastAPI dependencies."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenError, decode_access_token
from app.db.session import get_db
from app.models import User

REFRESH_COOKIE_NAME = "signal_refresh"

#: auto_error off so a missing header produces our message rather than
#: FastAPI's, and so optional-auth routes can reuse the same scheme.
bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    db: DbSession,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ] = None,
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in to continue.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        user_id = decode_access_token(credentials.credentials)
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account no longer exists.",
        )
    return user


async def get_registered_user(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Rejects an account that verified a code but never finished the profile."""
    if not user.display_name:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Finish setting up your profile first.",
        )
    return user


def get_refresh_token(request: Request) -> str | None:
    return request.cookies.get(REFRESH_COOKIE_NAME)


CurrentUser = Annotated[User, Depends(get_current_user)]
RegisteredUser = Annotated[User, Depends(get_registered_user)]
