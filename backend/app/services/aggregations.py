"""Agregados del dashboard — equivalentes a los SUMIFS/COUNTIFS de la hoja `Dashboard`.

Ver docs/FINANCIAL_LOGIC.md §2.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import asdict, dataclass, field

from app.services.valuation import PositionMetrics


@dataclass(slots=True)
class PortfolioKpis:
    costo_total: float = 0.0
    valor_mercado: float = 0.0
    gp_no_realizada: float = 0.0
    rentab_sobre_costo: float = 0.0
    ingreso_anual_est: float = 0.0
    interes_acumulado: float = 0.0
    yield_prom_ponderado: float = 0.0
    n_posiciones: int = 0
    valor_informe: float = 0.0


@dataclass(slots=True)
class BreakdownRow:
    label: str
    costo: float = 0.0
    valor_mercado: float = 0.0
    gp_no_realizada: float = 0.0
    pct_participacion: float = 0.0
    ingreso_anual_est: float = 0.0
    posiciones: int = 0


@dataclass(slots=True)
class RiskAlerts:
    """Panel de riesgo y alertas (hoja DASHBOARD)."""
    vencimientos_1a_posiciones: int = 0
    vencimientos_1a_valor: float = 0.0
    plazo_prom_vencimiento_bonos: float = 0.0
    emisores_sobre_limite: int = 0          # cost basis > 500.000 USD
    valor_emisores_sobre_limite: float = 0.0
    posiciones_stop_loss_venta: int = 0     # "Evaluar Venta" + "Ejecutar Venta"


@dataclass(slots=True)
class DashboardPayload:
    kpis: PortfolioKpis
    por_clasificacion: list[BreakdownRow] = field(default_factory=list)
    por_tipo: list[BreakdownRow] = field(default_factory=list)
    por_sector: list[BreakdownRow] = field(default_factory=list)
    calidad_moodys: list[BreakdownRow] = field(default_factory=list)
    calidad_sp: list[BreakdownRow] = field(default_factory=list)
    stop_loss: list[BreakdownRow] = field(default_factory=list)
    alerta_tiempo: list[BreakdownRow] = field(default_factory=list)
    alerta_emisor: list[BreakdownRow] = field(default_factory=list)
    limite_cash: list[BreakdownRow] = field(default_factory=list)
    risk_alerts: RiskAlerts = field(default_factory=RiskAlerts)


# --------------------------------------------------------------------------- #
# Filtros
# --------------------------------------------------------------------------- #
def filter_positions(
    positions: Iterable[PositionMetrics],
    *,
    type_: str | None = None,
    classification: str | None = None,
    sector: str | None = None,
    rating_grade: str | None = None,      # "Grado de Inversión" / "Grado Especulativo"
    rating_agency: str = "moodys",         # "moodys" | "sp"
) -> list[PositionMetrics]:
    out = []
    for p in positions:
        if type_ and (p.type or "") != type_:
            continue
        if classification and (p.classification or "") != classification:
            continue
        if sector and (p.sector or "") != sector:
            continue
        if rating_grade:
            grade = p.moodys_grade if rating_agency == "moodys" else p.sp_grade
            if grade != rating_grade:
                continue
        out.append(p)
    return out


# --------------------------------------------------------------------------- #
# KPIs y cortes
# --------------------------------------------------------------------------- #
def compute_kpis(positions: list[PositionMetrics]) -> PortfolioKpis:
    k = PortfolioKpis()
    for p in positions:
        k.costo_total += p.cost_basis
        k.valor_mercado += p.market_value
        k.gp_no_realizada += p.unrealized_gain_loss
        k.ingreso_anual_est += p.annual_income
        k.interes_acumulado += p.accrued_interest
        k.valor_informe += p.valor_informe
        if p.market_value > 0:
            k.n_posiciones += 1
    k.rentab_sobre_costo = k.gp_no_realizada / k.costo_total if k.costo_total else 0.0
    k.yield_prom_ponderado = k.ingreso_anual_est / k.valor_mercado if k.valor_mercado else 0.0
    return k


def _breakdown(
    positions: list[PositionMetrics],
    key: Callable[[PositionMetrics], str | None],
    *,
    total_market_value: float,
    fill_labels: Iterable[str] | None = None,
) -> list[BreakdownRow]:
    rows: dict[str, BreakdownRow] = {}
    if fill_labels:
        for lbl in fill_labels:
            rows[lbl] = BreakdownRow(label=lbl)

    for p in positions:
        lbl = key(p) or "(sin dato)"
        row = rows.setdefault(lbl, BreakdownRow(label=lbl))
        row.costo += p.cost_basis
        row.valor_mercado += p.market_value
        row.gp_no_realizada += p.unrealized_gain_loss
        row.ingreso_anual_est += p.annual_income
        if p.market_value > 0:
            row.posiciones += 1

    for row in rows.values():
        row.pct_participacion = (
            row.valor_mercado / total_market_value if total_market_value else 0.0
        )
    return sorted(rows.values(), key=lambda r: r.valor_mercado, reverse=True)


def _risk_alerts(positions: list[PositionMetrics]) -> RiskAlerts:
    ra = RiskAlerts()
    bond_terms: list[float] = []
    for p in positions:
        t = p.term_to_maturity_years
        if t is not None and 0 < t < 1:
            ra.vencimientos_1a_posiciones += 1
            ra.vencimientos_1a_valor += p.market_value
        if (p.type or "").lower() == "bond" and t is not None:
            bond_terms.append(t)
        if p.issuer_alert == "Revisar":
            ra.emisores_sobre_limite += 1
            ra.valor_emisores_sobre_limite += p.market_value
        if p.stop_loss in ("Evaluar Venta", "Ejecutar Venta - Previa Revisión"):
            ra.posiciones_stop_loss_venta += 1
    ra.plazo_prom_vencimiento_bonos = (
        sum(bond_terms) / len(bond_terms) if bond_terms else 0.0
    )
    return ra


def build_dashboard(positions: list[PositionMetrics]) -> DashboardPayload:
    kpis = compute_kpis(positions)
    tmv = kpis.valor_mercado
    return DashboardPayload(
        kpis=kpis,
        por_clasificacion=_breakdown(positions, lambda p: p.classification, total_market_value=tmv),
        por_tipo=_breakdown(positions, lambda p: p.type, total_market_value=tmv),
        por_sector=_breakdown(positions, lambda p: p.sector, total_market_value=tmv),
        calidad_moodys=_breakdown(
            positions, lambda p: p.moodys_grade, total_market_value=tmv,
            fill_labels=["Grado de Inversión", "Grado Especulativo"],
        ),
        calidad_sp=_breakdown(
            positions, lambda p: p.sp_grade, total_market_value=tmv,
            fill_labels=["Grado de Inversión", "Grado Especulativo"],
        ),
        stop_loss=_breakdown(positions, lambda p: p.stop_loss, total_market_value=tmv),
        alerta_tiempo=_breakdown(
            positions, lambda p: p.time_alert, total_market_value=tmv,
            fill_labels=["OK", "Revisar"],
        ),
        alerta_emisor=_breakdown(
            positions, lambda p: p.issuer_alert, total_market_value=tmv,
            fill_labels=["OK", "Revisar"],
        ),
        limite_cash=_breakdown(
            positions, lambda p: p.cash_limit_alert, total_market_value=tmv,
            fill_labels=["OK", "Revision"],
        ),
        risk_alerts=_risk_alerts(positions),
    )


def payload_to_dict(payload: DashboardPayload) -> dict:
    return {
        "kpis": asdict(payload.kpis),
        "por_clasificacion": [asdict(r) for r in payload.por_clasificacion],
        "por_tipo": [asdict(r) for r in payload.por_tipo],
        "por_sector": [asdict(r) for r in payload.por_sector],
        "calidad_moodys": [asdict(r) for r in payload.calidad_moodys],
        "calidad_sp": [asdict(r) for r in payload.calidad_sp],
        "stop_loss": [asdict(r) for r in payload.stop_loss],
        "alerta_tiempo": [asdict(r) for r in payload.alerta_tiempo],
        "alerta_emisor": [asdict(r) for r in payload.alerta_emisor],
        "limite_cash": [asdict(r) for r in payload.limite_cash],
        "risk_alerts": asdict(payload.risk_alerts),
    }
