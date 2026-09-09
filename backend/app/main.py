from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import BACKEND_DIR, settings

logger = logging.getLogger("app.startup")


def _run_migrations() -> None:
    """Aplica `alembic upgrade head` de forma programática (sin shell)."""
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", settings.database_url)
    command.upgrade(cfg, "head")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """En cada arranque: migra el esquema y siembra usuarios/parámetros base.

    Todo va envuelto en try/except para que un fallo de infraestructura
    (BD dormida, permisos, etc.) no impida levantar la API; los errores
    quedan registrados y el healthcheck seguirá respondiendo.
    """
    try:
        _run_migrations()
        logger.info("Migraciones aplicadas (alembic upgrade head).")
    except Exception:  # noqa: BLE001
        logger.exception("No se pudieron aplicar las migraciones al arrancar.")

    try:
        from app.db.seed import init_db

        init_db()
        logger.info("Seed base verificado (admin/lector + parámetros).")
    except Exception:  # noqa: BLE001
        logger.exception("Falló el seed automático al arrancar.")

    yield


app = FastAPI(
    title=settings.project_name,
    version="0.1.0",
    description="API de gestión y análisis del portafolio de inversiones internacionales FSA.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    # Cualquier dominio de despliegue/preview de Vercel (*.vercel.app).
    allow_origin_regex=r"https://([a-z0-9-]+\.)*vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok", "project": settings.project_name}
