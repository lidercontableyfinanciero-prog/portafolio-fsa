"""Rentabilidad Acumulada — Time-Weighted Return.

Encadena geométricamente las rentabilidades mensuales (Dietz):
    TWR_acum = Π(1 + R_m) - 1
Ver docs/FINANCIAL_LOGIC.md §4.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.services.constants import month_index_to_name


@dataclass(slots=True)
class MonthlyReturnInput:
    year: int
    month: int  # 1..12
    portfolio_return: float | None = None
    benchmark_return: float | None = None


@dataclass(slots=True)
class TwrRow:
    year: int
    month: int
    month_name: str
    portfolio_return: float | None
    benchmark_return: float | None
    factor: float | None
    cumulative_twr: float | None
    cumulative_benchmark: float | None


@dataclass(slots=True)
class TwrResult:
    rows: list[TwrRow]
    cumulative_twr: float
    cumulative_benchmark: float


def time_weighted_return(returns: list[MonthlyReturnInput]) -> TwrResult:
    ordered = sorted(returns, key=lambda r: (r.year, r.month))
    rows: list[TwrRow] = []

    twr_factor = 1.0
    bench_factor = 1.0
    have_twr = False
    have_bench = False

    for r in ordered:
        pr = r.portfolio_return
        br = r.benchmark_return
        factor = None
        if pr is not None:
            factor = 1.0 + pr
            twr_factor *= factor
            have_twr = True
        if br is not None:
            bench_factor *= 1.0 + br
            have_bench = True

        rows.append(
            TwrRow(
                year=r.year,
                month=r.month,
                month_name=month_index_to_name(r.month),
                portfolio_return=pr,
                benchmark_return=br,
                factor=factor,
                cumulative_twr=(twr_factor - 1.0) if have_twr else None,
                cumulative_benchmark=(bench_factor - 1.0) if have_bench else None,
            )
        )

    return TwrResult(
        rows=rows,
        cumulative_twr=(twr_factor - 1.0) if have_twr else 0.0,
        cumulative_benchmark=(bench_factor - 1.0) if have_bench else 0.0,
    )
