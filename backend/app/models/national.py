"""Portafolio Nacional (moneda legal, COP) — modelo de datos separado del internacional.

- `NationalMovement`: hecho, cada fila de la base `Data_Nal` (libro de movimientos
  por inversión y mes). Es la fuente de verdad: todo lo demás se calcula.
- `NationalAsset`: catálogo de inversiones con los atributos que la base NO trae
  (tipo normalizado, grupo, emisor, baja liquidez, benchmark aplicable). Se siembra
  con la hoja `Valoracion` del informe y es editable por el administrador.
- `NationalIpc`: IPC del DANE (año corrido y 12 meses) por mes, insumo del benchmark
  del Anexo 6 del Reglamento. Tampoco viene en la base.

Ver docs/NATIONAL_LOGIC.md.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import Boolean, Date, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models._mixins import TimestampMixin


class NationalMovement(TimestampMixin, Base):
    __tablename__ = "national_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    year: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    month: Mapped[int] = mapped_column(Integer, index=True, nullable=False)  # 1..12
    row_number: Mapped[int | None] = mapped_column(Integer)  # fila del archivo origen

    entity: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    investment_type: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    concept: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    movement_type: Mapped[str | None] = mapped_column(String(32))  # Crédito / Débito
    value: Mapped[float | None] = mapped_column(Numeric(20, 4))

    # Campos de composición (CDT / Bono), normalmente solo en "Composición de Portafolio"
    nominal_value: Mapped[float | None] = mapped_column(Numeric(20, 4))
    purchase_value: Mapped[float | None] = mapped_column(Numeric(20, 4))
    coupon_rate: Mapped[float | None] = mapped_column(Numeric(12, 6))
    rate_em: Mapped[float | None] = mapped_column(Numeric(12, 6))
    issue_date: Mapped[date | None] = mapped_column(Date)
    purchase_date: Mapped[date | None] = mapped_column(Date)
    maturity_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str | None] = mapped_column(String(32))
    sale_value: Mapped[float | None] = mapped_column(Numeric(20, 4))   # Giro de Venta
    pnl: Mapped[float | None] = mapped_column(Numeric(20, 4))          # P&G
    holding_irr: Mapped[float | None] = mapped_column(Numeric(12, 6))  # TIR Tenencia
    sale_rate: Mapped[float | None] = mapped_column(Numeric(12, 6))    # Tasa de Venta
    nemo: Mapped[str | None] = mapped_column(String(64))
    ref: Mapped[str | None] = mapped_column(String(32))
    per: Mapped[str | None] = mapped_column(String(32))


class NationalAsset(TimestampMixin, Base):
    __tablename__ = "national_assets"

    name: Mapped[str] = mapped_column(String(255), primary_key=True)
    asset_type: Mapped[str] = mapped_column(String(16), nullable=False)    # CDT/Bono/FIC/FCP
    group: Mapped[str] = mapped_column(String(64), nullable=False)
    issuer: Mapped[str] = mapped_column(String(255), nullable=False)
    entity: Mapped[str | None] = mapped_column(String(128))                # administrador
    low_liquidity: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    benchmark: Mapped[str] = mapped_column(String(16), default="IPC + 2", nullable=False)
    # True = atributos deducidos automáticamente en una importación: revisar.
    needs_review: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class NationalIpc(TimestampMixin, Base):
    __tablename__ = "national_ipc"
    __table_args__ = (UniqueConstraint("year", "month", name="uq_national_ipc_period"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    ipc_ytd: Mapped[float | None] = mapped_column(Numeric(10, 6))     # año corrido
    ipc_12m: Mapped[float | None] = mapped_column(Numeric(10, 6))     # anual 12 meses
    source: Mapped[str | None] = mapped_column(String(255))
