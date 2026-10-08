"""Token minting and hashing.

Two token types with different jobs:

  access   short-lived, signed JWT, sent as a bearer header, never stored
  refresh  long-lived opaque random string, sent as an httpOnly cookie, and
           stored server-side only as a SHA-256 hash

The refresh token is opaque rather than a JWT on purpose. A JWT is valid
until it expires and cannot be withdrawn; a row in auth_sessions can be
revoked, which is what makes logout mean something.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from app.core.config import settings

ALGORITHM = settings.jwt_algorithm


class TokenError(Exception):
    """Raised when a token is missing, malformed, expired or not ours."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(user_id: str, expires_minutes: int | None = None) -> str:
    minutes = expires_minutes or settings.access_token_minutes
    expires_at = _now() + timedelta(minutes=minutes)
    payload: dict[str, Any] = {
        "sub": user_id,
        "type": "access",
        "iat": int(_now().timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> str:
    """Return the account id, or raise TokenError."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("Token has expired") from exc
    except jwt.PyJWTError as exc:
        raise TokenError("Token is not valid") from exc

    if payload.get("type") != "access":
        raise TokenError("Wrong token type")
    user_id = payload.get("sub")
    if not isinstance(user_id, str):
        raise TokenError("Token has no subject")
    return user_id


def create_refresh_token() -> tuple[str, str, datetime]:
    """Return (plaintext, hash, expiry). Only the hash is ever stored."""
    plaintext = secrets.token_urlsafe(48)
    expires_at = _now() + timedelta(days=settings.refresh_token_days)
    return plaintext, hash_token(plaintext), expires_at


def hash_token(plaintext: str) -> str:
    return hashlib.sha256(plaintext.encode()).hexdigest()


def generate_identity_key() -> str:
    """Simulated identity key. Random, not derived from a key exchange."""
    return secrets.token_hex(32)


def generate_registration_id() -> int:
    return secrets.randbelow(15000) + 1000


def safety_number(key_a: str, key_b: str) -> str:
    """Signal shows a 60-digit safety number per contact pair.

    Order-independent, so both sides see the same digits, and grouped into
    blocks of five the way the real screen formats it.
    """
    combined = "".join(sorted((key_a, key_b))).encode()
    digest = hashlib.sha512(combined).digest()
    digits = "".join(str(byte % 10) for byte in digest)[:60]
    return " ".join(digits[i : i + 5] for i in range(0, 60, 5))
