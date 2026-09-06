from __future__ import annotations

from sqlalchemy import Integer, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models._mixins import TimestampMixin


class MonthlyReturn(TimestampMixin, Base):
    """Rentabilidad mensual del portafolio (Dietz) para encadenar el TWR."""

    __tablename__ = "monthly_returns"
    __table_args__ = (
        UniqueConstraint("period_year", "period_month", name="uq_monthly_return_period"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    period_year: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    period_month: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    dietz_return: Mapped[float | None] = mapped_column(Numeric(14, 8))
    benchmark_return: Mapped[float | None] = mapped_column(Numeric(14, 8))
