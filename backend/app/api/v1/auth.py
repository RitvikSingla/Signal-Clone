"""Onboarding and session endpoints.

These routers stay thin on purpose: parse, delegate, set a cookie, return.
Every rule lives in app/services/auth_service.py.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select

from app.core.config import settings
from app.core.deps import REFRESH_COOKIE_NAME, CurrentUser, DbSession, get_refresh_token
from app.schemas.auth import (
    DemoAccount,
    RegisterIn,
    RequestCodeIn,
    RequestCodeOut,
    TokenOut,
    VerifyCodeIn,
    VerifyCodeOut,
)
from app.schemas.common import Message, UserPrivate
from app.services import auth_service
from app.services.auth_service import AuthError

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_refresh_cookie(response: Response, token: str) -> None:
    """httpOnly so no script can read it, including a script we accidentally
    let in. SameSite=lax is enough because the refresh call is a top-level
    POST from our own origin."""
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.is_production,
        samesite="none" if settings.is_production else "lax",
        max_age=settings.refresh_token_days * 24 * 3600,
        path="/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE_NAME, path="/")


@router.post("/request-code", response_model=RequestCodeOut)
async def request_code(payload: RequestCodeIn, db: DbSession) -> RequestCodeOut:
    """Start the mocked verification flow."""
    verification = await auth_service.request_code(db, payload.phone_number)
    return RequestCodeOut(
        phone_number=verification.phone_number,
        expires_in_seconds=settings.otp_ttl_seconds,
        debug_code=(
            verification.code if settings.expose_otp_in_response else None
        ),
    )


@router.post("/verify", response_model=VerifyCodeOut)
async def verify(
    payload: VerifyCodeIn, request: Request, response: Response, db: DbSession
) -> VerifyCodeOut:
    """Exchange a code for a session."""
    try:
        user, _is_new = await auth_service.verify_code(
            db, payload.phone_number, payload.code
        )
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    access_token, refresh_token = await auth_service.issue_session(
        db, user, request.headers.get("user-agent")
    )
    _set_refresh_cookie(response, refresh_token)

    is_registered = bool(user.display_name)
    return VerifyCodeOut(
        access_token=access_token,
        is_registered=is_registered,
        user=UserPrivate.model_validate(user) if is_registered else None,
    )


@router.post("/register", response_model=UserPrivate)
async def register(
    payload: RegisterIn, user: CurrentUser, db: DbSession
) -> UserPrivate:
    """Complete the profile for an account that has verified a code."""
    try:
        updated = await auth_service.complete_registration(
            db,
            user,
            display_name=payload.display_name,
            username=payload.username,
            about=payload.about,
            avatar_color=payload.avatar_color,
        )
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return UserPrivate.model_validate(updated)


@router.post("/refresh", response_model=TokenOut)
async def refresh(
    request: Request,
    response: Response,
    db: DbSession,
    refresh_token: Annotated[str | None, Depends(get_refresh_token)],
) -> TokenOut:
    """Rotate the refresh token and mint a new access token."""
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="No session to refresh."
        )
    try:
        _user, access_token, new_refresh = await auth_service.rotate_session(
            db, refresh_token, request.headers.get("user-agent")
        )
    except AuthError as exc:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    _set_refresh_cookie(response, new_refresh)
    return TokenOut(access_token=access_token)


@router.post("/logout", response_model=Message)
async def logout(
    response: Response,
    db: DbSession,
    refresh_token: Annotated[str | None, Depends(get_refresh_token)],
) -> Message:
    """Revoke the session server-side, not just locally."""
    await auth_service.revoke_session(db, refresh_token)
    _clear_refresh_cookie(response)
    return Message(detail="Signed out.")


@router.get("/me", response_model=UserPrivate)
async def me(user: CurrentUser) -> UserPrivate:
    """Rehydrate the session after a page load."""
    return UserPrivate.model_validate(user)


@router.get("/demo-accounts", response_model=list[DemoAccount])
async def demo_accounts(db: DbSession) -> list[DemoAccount]:
    """Seeded accounts, offered as one-tap sign-in on the welcome screen.

    Development only. A reviewer should never have to guess a phone number.
    """
    if settings.is_production:
        return []

    from app.models import User  # local import keeps the router import light

    rows = await db.scalars(
        select(User).where(User.display_name != "").order_by(User.created_at)
    )
    return [
        DemoAccount(
            phone_number=row.phone_number,
            display_name=row.display_name,
            avatar_color=row.avatar_color,
        )
        for row in rows
    ]
