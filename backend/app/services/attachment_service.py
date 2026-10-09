"""Attachment upload.

The client uploads first and gets an id back, then sends a message that
names that id. Upload and send are separate so a slow upload never holds a
message hostage, and so one message can carry several files.

Safety rules, because these files are served from the API's own origin:

- The size cap is enforced while streaming, not after the whole body is in
  memory.
- Only a short allow-list of media extensions is stored as-is. Everything
  else is stored as `.bin`, which the static server sends as an opaque
  download, so an uploaded HTML or SVG file can never run as a page on this
  origin.
- Anything claiming to be an image is opened with Pillow; a file that does
  not decode is treated as a plain file, not an image.

Stored names are random UUIDs, so a media URL is an unguessable capability
link rather than an enumerable path.
"""

from __future__ import annotations

import mimetypes
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Attachment, User
from app.schemas.message import AttachmentOut
from app.services.conversation_service import ConversationError
from app.services.message_service import _attachment_out

CHUNK = 1024 * 1024
THUMB_EDGE = 720

#: Extensions served inline (shown in the thread). Everything else is a download.
INLINE_TYPES: dict[str, str] = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    # Voice messages: MediaRecorder's Opus-in-WebM, kept apart from .webm
    # so the thread draws a voice note rather than a video tile.
    ".weba": "audio/webm",
}

PILLOW_FORMATS = {"JPEG": ".jpg", "PNG": ".png", "GIF": ".gif", "WEBP": ".webp"}


def _clean_name(raw: str | None) -> str:
    name = Path(raw or "file").name.strip() or "file"
    # Keep it printable and bounded; the original name is only ever shown.
    name = "".join(ch for ch in name if ch.isprintable() and ch not in '\\/:*?"<>|')
    return name[:200] or "file"


async def upload(db: AsyncSession, user: User, file: UploadFile) -> AttachmentOut:
    file_name = _clean_name(file.filename)
    suffix = Path(file_name).suffix.lower()

    day = datetime.now(timezone.utc).strftime("%Y/%m/%d")
    folder = settings.media_root / day
    folder.mkdir(parents=True, exist_ok=True)
    stem = uuid.uuid4().hex
    temp_path = folder / f"{stem}.upload"

    size = 0
    try:
        with temp_path.open("wb") as out:
            while chunk := await file.read(CHUNK):
                size += len(chunk)
                if size > settings.max_upload_bytes:
                    raise ConversationError(
                        f"Files can be at most {settings.max_upload_bytes // (1024 * 1024)} MB.",
                        413,
                    )
                out.write(chunk)
        if size == 0:
            raise ConversationError("That file is empty.", 400)

        width = height = None
        thumbnail_rel: str | None = None
        content_type = "application/octet-stream"
        stored_suffix = ".bin"

        image_format = _image_format(temp_path)
        if image_format:
            stored_suffix = PILLOW_FORMATS[image_format]
            content_type = INLINE_TYPES[stored_suffix]
            with Image.open(temp_path) as image:
                oriented = ImageOps.exif_transpose(image)
                width, height = oriented.size
                # Animated GIFs keep the original; a still thumbnail would
                # freeze them. Everything else larger than the bubble gets a
                # smaller copy so the thread loads quickly.
                if image_format != "GIF" and max(width, height) > THUMB_EDGE:
                    thumb = oriented.convert("RGB")
                    thumb.thumbnail((THUMB_EDGE, THUMB_EDGE))
                    thumb_path = folder / f"{stem}_thumb.jpg"
                    thumb.save(thumb_path, "JPEG", quality=82)
                    thumbnail_rel = f"{day}/{thumb_path.name}"
        elif suffix in INLINE_TYPES and not INLINE_TYPES[suffix].startswith("image/"):
            stored_suffix = suffix
            content_type = INLINE_TYPES[suffix]
        else:
            guessed = mimetypes.guess_type(file_name)[0]
            # Recorded for the file card's icon only; the stored file is .bin.
            if guessed and not guessed.startswith(("text/html", "image/svg")):
                content_type = guessed

        final_path = folder / f"{stem}{stored_suffix}"
        temp_path.replace(final_path)
    except BaseException:
        temp_path.unlink(missing_ok=True)
        raise

    attachment = Attachment(
        uploader_id=user.id,
        file_name=file_name,
        content_type=content_type,
        size_bytes=size,
        storage_path=f"{day}/{final_path.name}",
        width=width,
        height=height,
        thumbnail_path=thumbnail_rel,
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)
    return _attachment_out(attachment)


def _image_format(path: Path) -> str | None:
    """The Pillow format name if the file really is a supported image."""
    try:
        with Image.open(path) as image:
            image.verify()
            fmt = image.format
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError):
        return None
    return fmt if fmt in PILLOW_FORMATS else None


async def own_image_url(db: AsyncSession, user: User, url: str | None) -> str | None:
    """Accept an avatar URL only if it is an image this user uploaded.

    Avatars are shown to everyone who sees the person or group, so an
    arbitrary URL would let one account make every viewer's browser fetch
    an outside address. "" or None clears the avatar.
    """
    if not url:
        return None
    prefix = f"{settings.media_url_prefix}/"
    path = url[len(prefix):] if url.startswith(prefix) else None
    if not path or ".." in path:
        raise ConversationError("Choose a photo you uploaded.", 400)
    match = await db.scalar(
        select(Attachment).where(
            Attachment.uploader_id == user.id,
            (Attachment.storage_path == path) | (Attachment.thumbnail_path == path),
        )
    )
    if match is None or not match.content_type.startswith("image/"):
        raise ConversationError("Choose a photo you uploaded.", 400)
    return url
