"""Profile, directory lookup, contacts and the safety-number screen."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_, select

from app.core.deps import DbSession, RegisteredUser
from app.core.security import safety_number
from app.models import Contact, User
from app.schemas.common import Message as MessageAck
from app.schemas.common import UserPrivate, UserPublic

router = APIRouter(tags=["users"])


class UpdateProfileIn(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=64)
    about: str | None = Field(default=None, max_length=140)
    avatar_color: str | None = Field(default=None, max_length=8)


class ContactOut(BaseModel):
    id: str
    user: UserPublic
    nickname: str | None
    is_blocked: bool


class AddContactIn(BaseModel):
    """Either an account id, or a phone number or username to look up."""

    user_id: str | None = None
    handle: str | None = Field(default=None, max_length=40)


class UpdateContactIn(BaseModel):
    nickname: str | None = Field(default=None, max_length=64)
    is_blocked: bool | None = None


class SafetyNumberOut(BaseModel):
    peer: UserPublic
    safety_number: str
    is_verified: bool


# --- profile ---------------------------------------------------------------


@router.patch("/users/me", response_model=UserPrivate)
async def update_me(
    payload: UpdateProfileIn, user: RegisteredUser, db: DbSession
) -> UserPrivate:
    if payload.display_name is not None:
        user.display_name = payload.display_name.strip()
    if payload.about is not None:
        user.about = payload.about.strip() or None
    if payload.avatar_color is not None:
        user.avatar_color = payload.avatar_color
    await db.commit()
    await db.refresh(user)
    return UserPrivate.model_validate(user)


@router.get("/users/search", response_model=list[UserPublic])
async def search_users(
    user: RegisteredUser,
    db: DbSession,
    q: Annotated[str, Query(min_length=2, max_length=40)],
) -> list[UserPublic]:
    """Directory lookup by phone number, username or display name."""
    needle = f"%{q.strip().lstrip('@').lower()}%"
    rows = await db.scalars(
        select(User)
        .where(
            User.id != user.id,
            User.display_name != "",
            or_(
                User.phone_number.ilike(needle),
                User.username.ilike(needle),
                User.display_name.ilike(needle),
            ),
        )
        .order_by(User.display_name)
        .limit(20)
    )
    return [UserPublic.model_validate(row) for row in rows]


@router.get("/users/{user_id}/safety-number", response_model=SafetyNumberOut)
async def get_safety_number(
    user_id: str, user: RegisteredUser, db: DbSession
) -> SafetyNumberOut:
    """The 60-digit number Signal shows for verifying a contact.

    Simulated: the digits are derived from both stored identity keys rather
    than from a real key exchange, but they are stable and order-independent,
    so both sides see the same number.
    """
    peer = await db.get(User, user_id)
    if peer is None:
        raise HTTPException(status_code=404, detail="That account does not exist.")
    return SafetyNumberOut(
        peer=UserPublic.model_validate(peer),
        safety_number=safety_number(user.identity_key, peer.identity_key),
        is_verified=False,
    )


# --- contacts --------------------------------------------------------------


@router.get("/contacts", response_model=list[ContactOut])
async def list_contacts(user: RegisteredUser, db: DbSession) -> list[ContactOut]:
    rows = await db.scalars(
        select(Contact)
        .where(Contact.owner_id == user.id)
        .order_by(Contact.created_at.desc())
    )
    contacts = list(rows)
    out: list[ContactOut] = []
    for contact in contacts:
        peer = await db.get(User, contact.contact_user_id)
        if peer is None:
            continue
        out.append(
            ContactOut(
                id=contact.id,
                user=UserPublic.model_validate(peer),
                nickname=contact.nickname,
                is_blocked=contact.is_blocked,
            )
        )
    out.sort(key=lambda c: (c.nickname or c.user.display_name).lower())
    return out


@router.post("/contacts", response_model=ContactOut, status_code=201)
async def add_contact(
    payload: AddContactIn, user: RegisteredUser, db: DbSession
) -> ContactOut:
    if payload.user_id:
        peer = await db.get(User, payload.user_id)
    elif payload.handle:
        handle = payload.handle.strip().lstrip("@")
        peer = await db.scalar(
            select(User).where(
                or_(User.phone_number == handle, User.username == handle.lower())
            )
        )
    else:
        raise HTTPException(
            status_code=422, detail="Give either an account id or a handle."
        )

    if peer is None:
        raise HTTPException(status_code=404, detail="No account matches that.")
    if peer.id == user.id:
        raise HTTPException(status_code=400, detail="You cannot add yourself.")

    existing = await db.scalar(
        select(Contact).where(
            Contact.owner_id == user.id, Contact.contact_user_id == peer.id
        )
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="They are already in your contacts.")

    contact = Contact(owner_id=user.id, contact_user_id=peer.id)
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return ContactOut(
        id=contact.id,
        user=UserPublic.model_validate(peer),
        nickname=None,
        is_blocked=False,
    )


@router.patch("/contacts/{contact_id}", response_model=ContactOut)
async def update_contact(
    contact_id: str, payload: UpdateContactIn, user: RegisteredUser, db: DbSession
) -> ContactOut:
    contact = await db.get(Contact, contact_id)
    if contact is None or contact.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Contact not found.")

    if payload.nickname is not None:
        contact.nickname = payload.nickname.strip() or None
    if payload.is_blocked is not None:
        contact.is_blocked = payload.is_blocked
    await db.commit()

    peer = await db.get(User, contact.contact_user_id)
    return ContactOut(
        id=contact.id,
        user=UserPublic.model_validate(peer),
        nickname=contact.nickname,
        is_blocked=contact.is_blocked,
    )


@router.delete("/contacts/{contact_id}", response_model=MessageAck)
async def delete_contact(
    contact_id: str, user: RegisteredUser, db: DbSession
) -> MessageAck:
    """Removes the address-book entry. The conversation is left alone."""
    contact = await db.get(Contact, contact_id)
    if contact is None or contact.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Contact not found.")
    await db.delete(contact)
    await db.commit()
    return MessageAck(detail="Contact removed.")
