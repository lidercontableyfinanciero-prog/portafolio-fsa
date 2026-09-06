from __future__ import annotations

from datetime import date

from sqlalchemy import Date, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models._mixins import TimestampMixin


class FxScenario(TimestampMixin, Base):
    """Escenario guardado del simulador de impacto cambiario (moneda funcional COP)."""

    __tablename__ = "fx_scenarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    instrument_id: Mapped[str | None] = mapped_column(String(64), index=True)

    quantity: Mapped[float | None] = mapped_column(Numeric(18, 4))
    gross_sale_usd: Mapped[float | None] = mapped_column(Numeric(18, 4))
    sale_commission_usd: Mapped[float | None] = mapped_column(Numeric(18, 4))
    purchase_cost_usd: Mapped[float | None] = mapped_column(Numeric(18, 4))
    purchase_date: Mapped[date | None] = mapped_column(Date)
    sale_date: Mapped[date | None] = mapped_column(Date)

    trm_purchase: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    trm_sale: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    trm_close: Mapped[float | None] = mapped_column(Numeric(14, 4))
