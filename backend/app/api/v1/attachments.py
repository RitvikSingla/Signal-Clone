"""Attachment upload. Sending happens through the normal message endpoint."""

from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.core.deps import DbSession, RegisteredUser
from app.schemas.message import AttachmentOut
from app.services import attachment_service
from app.services.conversation_service import ConversationError

router = APIRouter(tags=["attachments"])


@router.post(
    "/attachments",
    response_model=AttachmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_attachment(
    user: RegisteredUser, db: DbSession, file: UploadFile = File(...)
) -> AttachmentOut:
    """Store one file and return its id, to be named in attachment_ids."""
    try:
        return await attachment_service.upload(db, user, file)
    except ConversationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
