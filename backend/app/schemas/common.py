"""Shared response pieces."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    """Base for anything read straight off a SQLAlchemy row."""

    model_config = ConfigDict(from_attributes=True)


class UserPublic(ORMModel):
    """What one account is allowed to see about another."""

    id: str
    display_name: str
    username: str | None
    phone_number: str
    about: str | None
    avatar_url: str | None
    avatar_color: str
    is_online: bool
    last_seen_at: datetime


class UserPrivate(UserPublic):
    """The caller's own account, which carries a little more."""

    identity_key: str
    registration_id: int
    created_at: datetime


class Message(BaseModel):
    """Plain acknowledgement for endpoints with nothing to return."""

    detail: str
