from __future__ import annotations

from sqlalchemy import Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models._mixins import TimestampMixin


class Parameter(TimestampMixin, Base):
    """Parámetros del PIF: límites de concentración, topes por clase, etc."""

    __tablename__ = "parameters"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value_numeric: Mapped[float | None] = mapped_column(Numeric(18, 6))
    value_text: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(String(255))


class RatingScale(Base):
    """Tabla de equivalencias Fitch / S&P / Moody's y grado crediticio."""

    __tablename__ = "rating_scale"

    id: Mapped[int] = mapped_column(primary_key=True)
    fitch: Mapped[str | None] = mapped_column(String(16))
    sp: Mapped[str | None] = mapped_column(String(16), index=True)
    moodys: Mapped[str | None] = mapped_column(String(16), index=True)
    grade: Mapped[str | None] = mapped_column(String(32))  # "GRADO DE INVERSIÓN" / "GRADO ESPECULATIVO"
    description: Mapped[str | None] = mapped_column(String(128))
    scale_1_7: Mapped[int | None] = mapped_column(Integer)


class SectorLimit(TimestampMixin, Base):
    __tablename__ = "sector_limits"

    sector: Mapped[str] = mapped_column(String(128), primary_key=True)
    limit_value: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
