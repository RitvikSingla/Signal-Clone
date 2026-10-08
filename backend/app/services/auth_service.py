"""Onboarding, session issuance and session revocation.

Routers call these functions; nothing here knows about HTTP. Errors are
raised as AuthError and translated to a status code at the edge.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    generate_identity_key,
    generate_registration_id,
    hash_token,
)
from app.models import AuthSession, PhoneVerification, User


class AuthError(Exception):
    """Something the caller did wrong, with a message safe to show them."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------


async def request_code(db: AsyncSession, phone_number: str) -> PhoneVerification:
    """Issue a verification code.

    In development the code is fixed and returned to the caller. The row is
    still created, with an expiry and an attempt counter, so the production
    path is the same code path rather than a separate branch.
    """
    # Invalidate any outstanding code for this number, so only the newest works.
    await db.execute(
        update(PhoneVerification)
        .where(
            PhoneVerification.phone_number == phone_number,
            PhoneVerification.consumed_at.is_(None),
        )
        .values(consumed_at=_now())
    )

    verification = PhoneVerification(
        phone_number=phone_number,
        code=settings.mock_otp_code,
        expires_at=_now() + timedelta(seconds=settings.otp_ttl_seconds),
    )
    db.add(verification)
    await db.commit()
    await db.refresh(verification)
    return verification


async def verify_code(
    db: AsyncSession, phone_number: str, code: str
) -> tuple[User, bool]:
    """Check a code and return (account, is_new_account).

    A new account is created in an incomplete state: it exists and can hold a
    session, but the profile step has not run yet, which the caller detects
    from the registration flag on the response.
    """
    verification = await db.scalar(
        select(PhoneVerification)
        .where(
            PhoneVerification.phone_number == phone_number,
            PhoneVerification.consumed_at.is_(None),
        )
        .order_by(PhoneVerification.created_at.desc())
        .limit(1)
    )

    if verification is None:
        raise AuthError("Request a verification code first.", 404)
    if verification.expires_at <= _now():
        raise AuthError("That code has expired. Request a new one.", 410)
    if verification.attempts >= settings.otp_max_attempts:
        raise AuthError("Too many attempts. Request a new code.", 429)

    if verification.code != code:
        verification.attempts += 1
        await db.commit()
        remaining = settings.otp_max_attempts - verification.attempts
        raise AuthError(
            f"That code is not right. {remaining} attempts left.", 400
        )

    verification.consumed_at = _now()

    user = await db.scalar(select(User).where(User.phone_number == phone_number))
    is_new = user is None
    if user is None:
        user = User(
            phone_number=phone_number,
            display_name="",
            identity_key=generate_identity_key(),
            registration_id=generate_registration_id(),
            avatar_color="A210",
        )
        db.add(user)

    await db.commit()
    await db.refresh(user)
    return user, is_new


# ---------------------------------------------------------------------------
# Profile completion
# ---------------------------------------------------------------------------


async def complete_registration(
    db: AsyncSession,
    user: User,
    display_name: str,
    username: str | None,
    about: str | None,
    avatar_color: str | None,
) -> User:
    if username:
        taken = await db.scalar(
            select(User).where(User.username == username, User.id != user.id)
        )
        if taken is not None:
            raise AuthError("That username is already taken.", 409)
        user.username = username

    user.display_name = display_name.strip()
    user.about = (about or "").strip() or None
    if avatar_color:
        user.avatar_color = avatar_color

    await db.commit()
    await db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------


async def issue_session(
    db: AsyncSession, user: User, user_agent: str | None
) -> tuple[str, str]:
    """Create a refresh row and return (access_token, refresh_plaintext)."""
    plaintext, token_hash, expires_at = create_refresh_token()
    db.add(
        AuthSession(
            user_id=user.id,
            refresh_token_hash=token_hash,
            user_agent=(user_agent or "")[:255] or None,
            expires_at=expires_at,
        )
    )
    await db.commit()
    return create_access_token(user.id), plaintext


async def rotate_session(
    db: AsyncSession, refresh_plaintext: str, user_agent: str | None
) -> tuple[User, str, str]:
    """Exchange a refresh token for a new pair.

    The old row is revoked as part of the same transaction, so a stolen
    refresh token stops working the moment the real client uses theirs.
    """
    session = await db.scalar(
        select(AuthSession).where(
            AuthSession.refresh_token_hash == hash_token(refresh_plaintext)
        )
    )
    if session is None or not session.is_active:
        raise AuthError("Your session has expired. Sign in again.", 401)

    user = await db.get(User, session.user_id)
    if user is None:
        raise AuthError("Account no longer exists.", 401)

    session.revoked_at = _now()
    access_token, new_plaintext = await issue_session(db, user, user_agent)
    return user, access_token, new_plaintext


async def revoke_session(db: AsyncSession, refresh_plaintext: str | None) -> None:
    """Idempotent: signing out twice is not an error."""
    if not refresh_plaintext:
        return
    session = await db.scalar(
        select(AuthSession).where(
            AuthSession.refresh_token_hash == hash_token(refresh_plaintext)
        )
    )
    if session is not None and session.revoked_at is None:
        session.revoked_at = _now()
        await db.commit()
