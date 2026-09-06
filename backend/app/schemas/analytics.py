from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field


class PeriodOut(BaseModel):
    year: int
    month: str
    month_index: int
    report_date: date
    label: str
    positions: int


class FilterOptions(BaseModel):
    years: list[int]
    months: list[str]
    types: list[str]
    classifications: list[str]
    sectors: list[str]
    rating_grades: list[str]


class ScenarioRequest(BaseModel):
    identifier: str
    month: str
    year: int | None = None
    pct_sales: list[float] = Field(default_factory=lambda: [0.5, 1.0, 0.7])
    as_of: date | None = None


class DietzFlow(BaseModel):
    flow_date: date
    amount: float
    description: str = ""


class DietzRequest(BaseModel):
    start_date: date
    end_date: date
    value_start: float | None = None
    value_end: float | None = None
    cash_flows: list[DietzFlow] = Field(default_factory=list)
    benchmark_composite_annual: float | None = None
    benchmark_institutional_annual: float | None = None


class FxRequest(BaseModel):
    quantity: float | None = None
    gross_sale_usd: float = 0.0
    sale_commission_usd: float = 0.0
    purchase_cost_usd: float = 0.0
    purchase_date: date | None = None
    sale_date: date | None = None
    trm_purchase: float
    trm_sale: float
    trm_close: float | None = None
    sensitivity_from: float | None = None
    sensitivity_to: float | None = None
    sensitivity_steps: int = 20
