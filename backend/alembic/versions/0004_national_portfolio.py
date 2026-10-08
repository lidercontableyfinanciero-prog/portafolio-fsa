"""Portafolio Nacional + permisos por módulo

Revision ID: 0004_national_portfolio
Revises: 0003_username_auth
Create Date: 2026-10-08

- Tablas `national_movements`, `national_assets`, `national_ipc` (checkfirst).
- `users.can_view_international` / `users.can_view_national` (default true, para
  que los usuarios existentes conserven su acceso actual).
- `ingestion_logs.portfolio` ("international" por defecto: el histórico previo
  es del portafolio internacional).
Idempotente: solo agrega lo que falte.
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.models.national import NationalAsset, NationalIpc, NationalMovement

revision: str = "0004_national_portfolio"
down_revision: str | None = "0003_username_auth"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _columns(table: str) -> set[str]:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    for model in (NationalMovement, NationalAsset, NationalIpc):
        model.__table__.create(bind=bind, checkfirst=True)

    users = _columns("users")
    for col in ("can_view_international", "can_view_national"):
        if col not in users:
            op.add_column(
                "users",
                sa.Column(col, sa.Boolean(), nullable=False, server_default=sa.true()),
            )

    if "portfolio" not in _columns("ingestion_logs"):
        op.add_column(
            "ingestion_logs",
            sa.Column("portfolio", sa.String(16), nullable=False,
                      server_default="international"),
        )
        op.create_index("ix_ingestion_logs_portfolio", "ingestion_logs", ["portfolio"])


def downgrade() -> None:
    op.drop_index("ix_ingestion_logs_portfolio", table_name="ingestion_logs")
    op.drop_column("ingestion_logs", "portfolio")
    op.drop_column("users", "can_view_national")
    op.drop_column("users", "can_view_international")
    bind = op.get_bind()
    for model in (NationalIpc, NationalAsset, NationalMovement):
        model.__table__.drop(bind=bind, checkfirst=True)
