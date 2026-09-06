from __future__ import annotations

from sqlalchemy import Integer, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models._mixins import TimestampMixin


class Benchmark(TimestampMixin, Base):
    """Rentabilidad de benchmark por mes (tasas anuales; se mensualizan /12)."""

    __tablename__ = "benchmarks"
    __table_args__ = (UniqueConstraint("period_year", "period_month", name="uq_benchmark_period"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    period_year: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    period_month: Mapped[int] = mapped_column(Integer, index=True, nullable=False)  # 1..12
    composite_rate: Mapped[float | None] = mapped_column(Numeric(12, 6))
    institutional_rate: Mapped[float | None] = mapped_column(Numeric(12, 6))
