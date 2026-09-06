"""Histórico de cargas (ingestion_logs)

Revision ID: 0002_ingestion_logs
Revises: 0001_initial
Create Date: 2026-09-06

Crea la tabla `ingestion_logs`. Idempotente (`checkfirst`): si la revisión 0001
ya la materializó vía `metadata.create_all`, esto es un no-op.
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

from app.models.ingestion_log import IngestionLog

revision: str = "0002_ingestion_logs"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    IngestionLog.__table__.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    IngestionLog.__table__.drop(bind=bind, checkfirst=True)
