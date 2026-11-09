"""Configuration stays on the server; secrets never go to the browser."""
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Settings:
    database: Path
    ai_base_url: str
    ai_api_key: str
    ai_model: str


def read_settings() -> Settings:
    load_dotenv(ROOT / ".env", override=False)
    return Settings(
        Path(os.getenv("ATLAS_DATABASE", str(ROOT / "data" / "atlas.sqlite3"))),
        os.getenv("AI_BASE_URL", "https://llm.ai.e-infra.cz/v1").rstrip("/"),
        os.getenv("AI_API_KEY", ""),
        os.getenv("AI_MODEL", "mini"),
    )
