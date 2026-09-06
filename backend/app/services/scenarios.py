"""Matriz de Escenarios de Venta (What-If) — hoja `Escenarios`.

Ver docs/FINANCIAL_LOGIC.md §5.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from app.services.constants import (
    BROKER_COMMISSION_RATE,
    DAYS_YEAR_HOLDING,
    TRANSACTION_FEE_USD,
)
from app.services.xirr import xirr


@dataclass(slots=True)
class ScenarioAssetInput:
    identifier: str
    description: str
    type: str | None
    purchase_date: date | None
    quantity: float
    purchase_value: float          # Total Cost Basis
    market_value: float            # Estimated Market Value
    as_of: date | None = None      # "Fecha Actual" (default: hoy)


@dataclass(slots=True)
class ScenarioResult:
    pct_sale: float
    shares_sold: float
    unit_market_price: float
    gross_sale_value: float
    broker_commission: float
    transaction_fee: float
    net_sale_value: float
    profit: float                  # C27 = neto - costo total
    profit_per_share: float
    holding_years: float
    irr: float | None              # TIR (XIRR)
    roi: float                     # C31


def _unit_market_price(asset: ScenarioAssetInput) -> float:
    return asset.market_value / asset.quantity if asset.quantity else 0.0


def run_scenario(asset: ScenarioAssetInput, pct_sale: float) -> ScenarioResult:
    if not 0 < pct_sale <= 1:
        raise ValueError("pct_sale debe estar en (0, 1]")

    as_of = asset.as_of or date.today()
    unit_price = _unit_market_price(asset)
    shares_sold = asset.quantity * pct_sale
    gross = shares_sold * unit_price
    commission = gross * BROKER_COMMISSION_RATE
    net = gross - commission - TRANSACTION_FEE_USD

    profit = net - asset.purchase_value                       # como en la hoja (col C27)
    profit_per_share = profit / shares_sold if shares_sold else 0.0

    holding_years = (
        (as_of - asset.purchase_date).days / DAYS_YEAR_HOLDING
        if asset.purchase_date
        else 0.0
    )

    irr = None
    if asset.purchase_date and asset.purchase_date < as_of:
        irr = xirr([(asset.purchase_date, -asset.purchase_value), (as_of, asset.market_value)])

    invested = asset.purchase_value * pct_sale
    roi = (net - invested) / invested if invested else 0.0

    return ScenarioResult(
        pct_sale=pct_sale,
        shares_sold=shares_sold,
        unit_market_price=unit_price,
        gross_sale_value=gross,
        broker_commission=commission,
        transaction_fee=TRANSACTION_FEE_USD,
        net_sale_value=net,
        profit=profit,
        profit_per_share=profit_per_share,
        holding_years=holding_years,
        irr=irr,
        roi=roi,
    )


def run_matrix(asset: ScenarioAssetInput, pct_sales: list[float]) -> list[ScenarioResult]:
    return [run_scenario(asset, p) for p in pct_sales]
