from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- App ---
    project_name: str = "Portafolio FSA"
    api_v1_prefix: str = "/api"
    debug: bool = True

    # --- DB ---
    database_url: str = "postgresql+psycopg://fsa:fsa@localhost:5432/portafolio_fsa"

    # --- Auth --- (>=32 bytes; sobreescribir en producción)
    secret_key: str = "dev-only-secret-change-me-please-0123456789abcdef"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    # --- CORS ---
    backend_cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    # --- Seed ---
    seed_data_dir: str = "../Referencias"
    seed_informe_file: str = "1. INFORME INVERSIONES INTERNACIONALES FSA 2026 (2).xlsx"
    seed_dashboard_file: str = "2. DASHBOARD INVERSIONES INTERNACIONALES FSA 2026 (1).xlsx"
    seed_admin_email: str = "admin@fundacionsanantonio.org"
    seed_admin_password: str = "admin123"
    seed_lector_email: str = "lector@fundacionsanantonio.org"
    seed_lector_password: str = "lector123"

    @property
    def seed_dir_path(self) -> Path:
        p = Path(self.seed_data_dir)
        return p if p.is_absolute() else (BACKEND_DIR / p).resolve()


settings = Settings()
