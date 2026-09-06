"""Rentabilidad del período — Método Dietz Modificado.

R = (Vf - Vi - F) / (Vi + Σ(Fj * wj))
    wj = (dias_totales - (fecha_flujo_j - fecha_inicio)) / dias_totales

Solo flujos EXTERNOS de caja (aportes / retiros). Ver docs/FINANCIAL_LOGIC.md §3.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass(slots=True)
class CashFlowInput:
    flow_date: date
    amount: float  # + aporte / - retiro
    description: str = ""


@dataclass(slots=True)
class WeightedFlow:
    flow_date: date
    amount: float
    description: str
    days_remaining: int
    weight: float
    weighted_amount: float


@dataclass(slots=True)
class DietzResult:
    start_date: date
    end_date: date
    days_total: int
    value_start: float
    value_end: float
    net_flows: float
    weighted_flows_sum: float
    numerator: float
    denominator: float
    period_return: float
    flows: list[WeightedFlow]

    # comparación con benchmark (opcional)
    benchmark_composite_monthly: float | None = None
    benchmark_institutional_monthly: float | None = None
    alpha_composite: float | None = None
    alpha_institutional: float | None = None


def modified_dietz(
    *,
    start_date: date,
    end_date: date,
    value_start: float,
    value_end: float,
    cash_flows: list[CashFlowInput] | None = None,
    benchmark_composite_annual: float | None = None,
    benchmark_institutional_annual: float | None = None,
) -> DietzResult:
    if end_date <= start_date:
        raise ValueError("end_date debe ser posterior a start_date")

    days_total = (end_date - start_date).days
    flows_in = [f for f in (cash_flows or []) if start_date < f.flow_date <= end_date]

    weighted: list[WeightedFlow] = []
    for f in flows_in:
        days_remaining = days_total - (f.flow_date - start_date).days
        w = days_remaining / days_total
        weighted.append(
            WeightedFlow(
                flow_date=f.flow_date,
                amount=f.amount,
                description=f.description,
                days_remaining=days_remaining,
                weight=w,
                weighted_amount=f.amount * w,
            )
        )

    net_flows = sum(f.amount for f in flows_in)
    weighted_sum = sum(wf.weighted_amount for wf in weighted)

    numerator = value_end - value_start - net_flows
    denominator = value_start + weighted_sum
    period_return = numerator / denominator if denominator else 0.0

    result = DietzResult(
        start_date=start_date,
        end_date=end_date,
        days_total=days_total,
        value_start=value_start,
        value_end=value_end,
        net_flows=net_flows,
        weighted_flows_sum=weighted_sum,
        numerator=numerator,
        denominator=denominator,
        period_return=period_return,
        flows=weighted,
    )

    if benchmark_composite_annual is not None:
        result.benchmark_composite_monthly = benchmark_composite_annual / 12
        result.alpha_composite = period_return - result.benchmark_composite_monthly
    if benchmark_institutional_annual is not None:
        result.benchmark_institutional_monthly = benchmark_institutional_annual / 12
        result.alpha_institutional = period_return - result.benchmark_institutional_monthly

    return result
