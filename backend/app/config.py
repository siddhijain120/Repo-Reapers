"""Application configuration loaded from backend/.env."""

from dataclasses import dataclass
import os
from pathlib import Path
from dotenv import load_dotenv

# Load backend/.env relative to this file so it works regardless of cwd
BACKEND_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BACKEND_DIR / ".env"
load_dotenv(dotenv_path=ENV_FILE)


def _parse_cors_origins(raw_origins: str) -> list[str]:
    """Split a comma-separated list of CORS origins into clean URLs."""
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


@dataclass(frozen=True)
class Settings:
    """Immutable runtime settings for the Envix backend."""

    app_name: str = "Envix"
    team_name: str = "Repo Reapers"
    subtitle: str = "AI-Powered Developer Environment Recovery Platform"
    version: str = "0.1.0"
    environment: str = os.getenv("ENVIX_ENV", "development")
    cors_origins: tuple[str, ...] = tuple(
        _parse_cors_origins(
            os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
        )
    )
    groq_api_key: str = os.getenv("GROQ_API_KEY", "").strip()
    groq_model: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()


settings = Settings()
