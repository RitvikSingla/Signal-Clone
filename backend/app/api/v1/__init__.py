"""Version 1 router aggregation.

Each feature area owns one module and exports a `router`. They are collected
here so main.py mounts a single object and the URL prefix is declared once.
"""

from fastapi import APIRouter

from app.api.v1 import attachments, auth, conversations, messages, meta, users

api_router = APIRouter()

api_router.include_router(meta.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(conversations.router)
api_router.include_router(messages.router)
api_router.include_router(attachments.router)

# Phase 4  -> websocket hub, mounted on the app rather than this router
