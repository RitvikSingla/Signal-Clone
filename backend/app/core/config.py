"""Application settings.

Every tunable value is read from the environment with a development-safe
default, so a fresh clone runs with no .env file at all. Production overrides
whatever it needs. Nothing in the codebase reads os.environ directly; it all
comes through the single Settings object exported at the bottom.
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# backend/app/core/config.py -> parents[2] is backend/
BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- identity -------------------------------------------------------
    app_name: str = "Signal Clone API"
    app_version: str = "0.1.0"
    api_v1_prefix: str = "/api/v1"
    environment: str = "development"
    debug: bool = True

    # --- database -------------------------------------------------------
    # aiosqlite driver so the whole stack can stay async.
    database_url: str = f"sqlite+aiosqlite:///{(BASE_DIR / 'signal.db').as_posix()}"

    # --- auth -----------------------------------------------------------
    jwt_secret: str = "dev-only-secret-replace-in-production"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    refresh_token_days: int = 30

    # --- mocked phone verification --------------------------------------
    # The assignment permits a fixed OTP. In development the code is also
    # returned in the response body so a reviewer never has to guess it.
    mock_otp_code: str = "123456"
    otp_ttl_seconds: int = 300
    otp_max_attempts: int = 5
    expose_otp_in_response: bool = True
    #: One-tap sign-in buttons for the seeded accounts. On for a public demo,
    #: so a reviewer never has to guess a phone number; turn off for real use.
    show_demo_accounts: bool = True

    # --- http -----------------------------------------------------------
    #: From the environment as a JSON array, or as one URL or several
    #: separated by commas, which is what people type into a hosting
    #: dashboard.
    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # --- media ----------------------------------------------------------
    media_root: Path = BASE_DIR / "media"
    media_url_prefix: str = "/media"
    max_upload_bytes: int = 10 * 1024 * 1024

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_origins(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        text = value.strip()
        if text.startswith("["):
            items = json.loads(text)
        else:
            items = text.split(",")
        # An origin never has a trailing slash; a browser would not match it.
        return [str(item).strip().strip("'\"").rstrip("/") for item in items if str(item).strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    """Cached so the .env file is parsed once per process."""
    return Settings()


settings = get_settings()
