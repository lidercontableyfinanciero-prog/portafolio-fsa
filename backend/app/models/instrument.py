from __future__ import annotations

from datetime import date

from sqlalchemy import Date, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models._mixins import TimestampMixin


class Instrument(TimestampMixin, Base):
    """Dimensión: un instrumento identificado por CUSIP/CINS."""

    __tablename__ = "instruments"

    identifier: Mapped[str] = mapped_column(String(64), primary_key=True)
    description: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    classification: Mapped[str | None] = mapped_column(String(64), index=True)
    type: Mapped[str | None] = mapped_column(String(64), index=True)
    sector: Mapped[str | None] = mapped_column(String(128), index=True)

    moodys_rating: Mapped[str | None] = mapped_column(String(16))
    sp_rating: Mapped[str | None] = mapped_column(String(16))
    coupon_rate: Mapped[float | None] = mapped_column(Numeric(12, 6))

    # `acquired_date` es por lote -> vive en PositionSnapshot
    maturity_date: Mapped[date | None] = mapped_column(Date)
    call_date: Mapped[date | None] = mapped_column(Date)

    target_unit_value: Mapped[float | None] = mapped_column(Numeric(18, 6))

    snapshots: Mapped[list["PositionSnapshot"]] = relationship(  # noqa: F821
        back_populates="instrument", cascade="all, delete-orphan"
    )
