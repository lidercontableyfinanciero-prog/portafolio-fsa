"""Simulador de impacto cambiario — hoja `Simulador`. Moneda funcional COP.

Ver docs/FINANCIAL_LOGIC.md §6.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass(slots=True)
class FxInput:
    quantity: float | None = None
    gross_sale_usd: float = 0.0
    sale_commission_usd: float = 0.0
    purchase_cost_usd: float = 0.0
    purchase_date: date | None = None
    sale_date: date | None = None
    trm_purchase: float = 0.0
    trm_sale: float = 0.0
    trm_close: float | None = None


@dataclass(slots=True)
class FxResult:
    gross_sale_cop: float
    sale_commission_cop: float
    net_bank_value_cop: float
    historical_cost_cop: float
    trm_delta: float
    accumulated_fx_difference: float
    trading_profit_cop: float
    gross_total_profit_cop: float
    net_sale_profit_cop: float
    control_check: float          # debe ser ~0


def simulate_fx(data: FxInput) -> FxResult:
    gross_sale_cop = data.gross_sale_usd * data.trm_sale
    commission_cop = data.sale_commission_usd * data.trm_sale
    net_bank_cop = gross_sale_cop - commission_cop
    historical_cost_cop = data.purchase_cost_usd * data.trm_purchase

    trm_delta = data.trm_sale - data.trm_purchase
    fx_difference = data.purchase_cost_usd * trm_delta

    trading_profit_cop = gross_sale_cop - historical_cost_cop - fx_difference
    gross_total_profit_cop = fx_difference + trading_profit_cop
    net_sale_profit_cop = gross_total_profit_cop - commission_cop

    control = round((net_bank_cop - historical_cost_cop) - net_sale_profit_cop, 2)

    return FxResult(
        gross_sale_cop=gross_sale_cop,
        sale_commission_cop=commission_cop,
        net_bank_value_cop=net_bank_cop,
        historical_cost_cop=historical_cost_cop,
        trm_delta=trm_delta,
        accumulated_fx_difference=fx_difference,
        trading_profit_cop=trading_profit_cop,
        gross_total_profit_cop=gross_total_profit_cop,
        net_sale_profit_cop=net_sale_profit_cop,
        control_check=control,
    )


@dataclass(slots=True)
class FxSensitivityPoint:
    trm_sale: float
    net_sale_profit_cop: float
    accumulated_fx_difference: float


def sensitivity(data: FxInput, trm_from: float, trm_to: float, steps: int = 20) -> list[FxSensitivityPoint]:
    """Proyección de utilidad neta vs TRM de venta."""
    if steps < 2 or trm_to <= trm_from:
        raise ValueError("Rango de TRM inválido")
    span = (trm_to - trm_from) / (steps - 1)
    out: list[FxSensitivityPoint] = []
    for i in range(steps):
        trm = trm_from + span * i
        r = simulate_fx(
            FxInput(
                quantity=data.quantity,
                gross_sale_usd=data.gross_sale_usd,
                sale_commission_usd=data.sale_commission_usd,
                purchase_cost_usd=data.purchase_cost_usd,
                purchase_date=data.purchase_date,
                sale_date=data.sale_date,
                trm_purchase=data.trm_purchase,
                trm_sale=trm,
                trm_close=data.trm_close,
            )
        )
        out.append(
            FxSensitivityPoint(
                trm_sale=trm,
                net_sale_profit_cop=r.net_sale_profit_cop,
                accumulated_fx_difference=r.accumulated_fx_difference,
            )
        )
    return out
