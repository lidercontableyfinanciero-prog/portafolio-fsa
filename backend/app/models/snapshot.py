from __future__ import annotations

from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models._mixins import TimestampMixin

MONTHS_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]
MONTH_INDEX = {name.lower(): i + 1 for i, name in enumerate(MONTHS_ES)}


class PositionSnapshot(TimestampMixin, Base):
    """Hecho: valoración de una posición en un mes de extracto."""

    __tablename__ = "position_snapshots"
    __table_args__ = (
        # Un extracto puede traer varios lotes del mismo CUSIP (distinta fecha de
        # adquisición); cada lote es una fila.
        UniqueConstraint(
            "statement_year",
            "statement_month",
            "instrument_id",
            "acquired_date",
            name="uq_snapshot_period_instrument_lot",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    instrument_id: Mapped[str] = mapped_column(
        ForeignKey("instruments.identifier", ondelete="CASCADE"), index=True, nullable=False
    )

    statement_year: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    statement_month: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    report_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    acquired_date: Mapped[date | None] = mapped_column(Date)  # fecha de compra del lote

    quantity: Mapped[float | None] = mapped_column(Numeric(18, 4))
    total_cost_basis: Mapped[float | None] = mapped_column(Numeric(18, 4))
    market_price: Mapped[float | None] = mapped_column(Numeric(18, 6))
    estimated_market_value: Mapped[float | None] = mapped_column(Numeric(18, 4))
    unrealized_gain_loss: Mapped[float | None] = mapped_column(Numeric(18, 4))
    accrued_interest: Mapped[float | None] = mapped_column(Numeric(18, 4))
    annual_income: Mapped[float | None] = mapped_column(Numeric(18, 4))
    current_yield: Mapped[float | None] = mapped_column(Numeric(12, 6))
    dividends_paid: Mapped[float | None] = mapped_column(Numeric(18, 4))
    tax: Mapped[float | None] = mapped_column(Numeric(18, 4))

    instrument: Mapped["Instrument"] = relationship(back_populates="snapshots")  # noqa: F821

    @property
    def month_index(self) -> int:
        return MONTH_INDEX.get(self.statement_month.lower(), 0)
