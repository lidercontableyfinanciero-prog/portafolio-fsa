from __future__ import annotations

from datetime import date

from sqlalchemy import Date, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models._mixins import TimestampMixin


class CashFlow(TimestampMixin, Base):
    """Flujo EXTERNO de caja (aporte + / retiro -) para el cálculo de Dietz Modificado.

    No incluye dividendos, intereses ni compras/ventas internas del portafolio.
    """

    __tablename__ = "cash_flows"

    id: Mapped[int] = mapped_column(primary_key=True)
    flow_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))
    period_start: Mapped[date | None] = mapped_column(Date, index=True)
    period_end: Mapped[date | None] = mapped_column(Date, index=True)
