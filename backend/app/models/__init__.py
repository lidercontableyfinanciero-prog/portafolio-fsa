"""Modelos ORM. Importados aquí para que Alembic los descubra."""

from app.models.benchmark import Benchmark
from app.models.cashflow import CashFlow
from app.models.fx import FxScenario
from app.models.ingestion_log import IngestionLog, IngestionStatus
from app.models.instrument import Instrument
from app.models.monthly_return import MonthlyReturn
from app.models.parameter import Parameter, RatingScale, SectorLimit
from app.models.snapshot import PositionSnapshot
from app.models.user import User

__all__ = [
    "Benchmark",
    "CashFlow",
    "FxScenario",
    "IngestionLog",
    "IngestionStatus",
    "Instrument",
    "MonthlyReturn",
    "Parameter",
    "RatingScale",
    "SectorLimit",
    "PositionSnapshot",
    "User",
]
