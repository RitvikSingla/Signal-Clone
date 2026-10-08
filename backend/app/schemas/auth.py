"""Request and response shapes for the onboarding flow."""

from __future__ import annotations

import re

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import UserPrivate

PHONE_PATTERN = re.compile(r"^\+[1-9]\d{7,14}$")
USERNAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._]{2,31}$")


class RequestCodeIn(BaseModel):
    phone_number: str = Field(examples=["+919812345601"])

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        cleaned = re.sub(r"[\s\-()]", "", value.strip())
        if not PHONE_PATTERN.match(cleaned):
            raise ValueError(
                "Enter a phone number in international format, for example "
                "+919812345601"
            )
        return cleaned


class RequestCodeOut(BaseModel):
    phone_number: str
    expires_in_seconds: int
    #: Present only while EXPOSE_OTP_IN_RESPONSE is on, so a reviewer running
    #: locally never has to guess the code. Always null in production.
    debug_code: str | None = None


class VerifyCodeIn(RequestCodeIn):
    code: str = Field(min_length=4, max_length=8, examples=["123456"])


class VerifyCodeOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    #: False means the caller still has to complete the profile step.
    is_registered: bool
    user: UserPrivate | None


class RegisterIn(BaseModel):
    display_name: str = Field(min_length=1, max_length=64)
    username: str | None = Field(default=None, max_length=32)
    about: str | None = Field(default=None, max_length=140)
    avatar_color: str | None = Field(default=None, max_length=8)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        lowered = value.strip().lower().lstrip("@")
        if not USERNAME_PATTERN.match(lowered):
            raise ValueError(
                "A username is 3 to 32 characters, using letters, numbers, "
                "dots and underscores, starting with a letter or number"
            )
        return lowered


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class DemoAccount(BaseModel):
    """Used by the sign-in screen to offer one-tap access to seeded users."""

    phone_number: str
    display_name: str
    avatar_color: str
