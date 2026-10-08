"""Version 1 router aggregation.

Each feature area owns one module and exports a `router`. They are collected
here so main.py mounts a single object and the URL prefix is declared once.
Routers are added as their phases land.
"""

from fastapi import APIRouter

from app.api.v1 import meta

api_router = APIRouter()

api_router.include_router(meta.router)

# Phase 2 -> auth
# Phase 3 -> users, contacts, conversations, messages
# Phase 11 -> attachments
