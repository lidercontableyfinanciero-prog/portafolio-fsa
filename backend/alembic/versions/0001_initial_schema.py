"""Esquema inicial

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-06

Crea todas las tablas a partir de los modelos ORM (proyecto greenfield: los
modelos en app/models son la fuente de verdad del esquema).
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

import app.models  # noqa: F401
from app.core.database import Base

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind())
