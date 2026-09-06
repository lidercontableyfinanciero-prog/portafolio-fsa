from __future__ import annotations

import enum

from sqlalchemy import JSON, Boolean, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models._mixins import TimestampMixin


class IngestionStatus(str, enum.Enum):
    success = "success"       # cargado sin errores
    partial = "partial"       # cargado, con filas rechazadas
    conflict = "conflict"     # rechazado: el período ya existía (sin replace)
    error = "error"           # falló el parseo / la escritura
    dry_run = "dry_run"       # solo previsualización


class IngestionLog(TimestampMixin, Base):
    """Histórico de cargas del ETL. `created_at` = fecha/hora de subida."""

    __tablename__ = "ingestion_logs"

    id: Mapped[int] = mapped_column(primary_key=True)

    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_sha256: Mapped[str | None] = mapped_column(String(64), index=True)

    uploaded_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    uploaded_by_email: Mapped[str | None] = mapped_column(String(255))

    status: Mapped[IngestionStatus] = mapped_column(
        Enum(IngestionStatus, name="ingestion_status"), nullable=False
    )
    dry_run: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    replace_mode: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    total_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    valid_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    instruments_upserted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    snapshots_inserted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    snapshots_updated: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    snapshots_deleted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Períodos del extracto: ["2026-Agosto", ...]
    periods: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    message: Mapped[str | None] = mapped_column(Text)
