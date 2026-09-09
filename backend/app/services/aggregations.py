"""Agregados del dashboard — equivalentes a los SUMIFS/COUNTIFS de la hoja `Dashboard`.

Ver docs/FINANCIAL_LOGIC.md §2.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import asdict, dataclass, field

from app.services.constants import EQUITY_MAX_WEIGHT, FIXED_INCOME_MAX_WEIGHT
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
    valor_informe: float = 0.0
    gp_no_realizada: float = 0.0
    pct_participacion: float = 0.0
    ingreso_anual_est: float = 0.0
    posiciones: int = 0
    # Variación respecto al período anterior (solo se rellena en algunos cortes)
    valor_informe_anterior: float | None = None
    variacion_abs: float | None = None
    variacion_pct: float | None = None


@dataclass(slots=True)
class RiskAlerts:
    """Panel de riesgo y alertas (hoja DASHBOARD)."""
    vencimientos_1a_posiciones: int = 0
    vencimientos_1a_valor: float = 0.0
    plazo_prom_vencimiento_bonos: float = 0.0
    emisores_sobre_limite: int = 0
    valor_emisores_sobre_limite: float = 0.0
    posiciones_stop_loss_venta: int = 0


@dataclass(slots=True)
class ConcentrationLimit:
    label: str
    participacion: float = 0.0
    limite: float = 0.0
    excedente: float = 0.0          # participacion - limite (positivo => incumple)
    cumple: bool = True


@dataclass(slots=True)
class PortfolioVariation:
    mes_actual: str = ""
    mes_anterior: str = ""
    valor_actual: float = 0.0
    valor_anterior: float = 0.0
    variacion_abs: float = 0.0
    variacion_pct: float = 0.0


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
    limites_concentracion: list[ConcentrationLimit] = field(default_factory=list)
    variacion_portafolio: PortfolioVariation | None = None


# --------------------------------------------------------------------------- #
# Filtros — cada dimensión admite selección múltiple (OR interno, AND entre
# dimensiones). Moody's y S&P se consultan de forma independiente.
# --------------------------------------------------------------------------- #
def _as_set(v) -> set[str] | None:
    if v is None:
        return None
    if isinstance(v, str):
        return {v} if v else None
    s = {x for x in v if x}
    return s or None


def filter_positions(
    positions: Iterable[PositionMetrics],
    *,
    type_=None,
    classification=None,
    sector=None,
    moodys_grade=None,      # "Grado de Inversión" / "Grado Especulativo"
    sp_grade=None,
    stop_loss=None,
    time_alert=None,
    issuer_alert=None,
) -> list[PositionMetrics]:
    types = _as_set(type_)
    classes = _as_set(classification)
    sectors = _as_set(sector)
    moodys = _as_set(moodys_grade)
    sps = _as_set(sp_grade)
    stops = _as_set(stop_loss)
    times = _as_set(time_alert)
    issuers = _as_set(issuer_alert)

    out = []
    for p in positions:
        if types and (p.type or "") not in types:
            continue
        if classes and (p.classification or "") not in classes:
            continue
        if sectors and (p.sector or "") not in sectors:
            continue
        if moodys and p.moodys_grade not in moodys:
            continue
        if sps and p.sp_grade not in sps:
            continue
        if stops and p.stop_loss not in stops:
            continue
        if times and p.time_alert not in times:
            continue
        if issuers and p.issuer_alert not in issuers:
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
        row.valor_informe += p.valor_informe
        row.gp_no_realizada += p.unrealized_gain_loss
        row.ingreso_anual_est += p.annual_income
        if p.market_value > 0:
            row.posiciones += 1

    for row in rows.values():
        row.pct_participacion = (
            row.valor_mercado / total_market_value if total_market_value else 0.0
        )
    return sorted(rows.values(), key=lambda r: r.valor_mercado, reverse=True)


def _apply_prev(rows: list[BreakdownRow], prev: list[BreakdownRow]) -> None:
    """Añade la variación mes a mes (sobre Valor Informe) a cada fila."""
    prev_by = {r.label: r.valor_informe for r in prev}
    for r in rows:
        pv = prev_by.get(r.label)
        r.valor_informe_anterior = pv
        if pv is not None:
            r.variacion_abs = r.valor_informe - pv
            r.variacion_pct = (r.variacion_abs / pv) if pv else None


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


def _concentration_limits(
    por_clasificacion: list[BreakdownRow],
    *,
    limite_rf: float,
    limite_rv: float,
) -> list[ConcentrationLimit]:
    """ANEXO 2 de la hoja Parametros / Resumen: Renta Fija ≤ 70 %, Renta Variable ≤ 30 %."""
    by = {r.label: r.pct_participacion for r in por_clasificacion}
    out = []
    for label, limite in (("Renta Fija", limite_rf), ("Renta Variable", limite_rv)):
        part = by.get(label, 0.0)
        exc = part - limite
        out.append(
            ConcentrationLimit(
                label=label,
                participacion=part,
                limite=limite,
                excedente=exc,
                cumple=exc <= 1e-9,
            )
        )
    return out


def build_dashboard(
    positions: list[PositionMetrics],
    *,
    prev_positions: list[PositionMetrics] | None = None,
    prev_label: str = "",
    current_label: str = "",
    limite_rf: float = FIXED_INCOME_MAX_WEIGHT,
    limite_rv: float = EQUITY_MAX_WEIGHT,
) -> DashboardPayload:
    kpis = compute_kpis(positions)
    tmv = kpis.valor_mercado

    por_clasificacion = _breakdown(
        positions, lambda p: p.classification, total_market_value=tmv
    )
    por_tipo = _breakdown(positions, lambda p: p.type, total_market_value=tmv)
    cash_positions = [p for p in positions if (p.type or "").lower() == "cash"]

    payload = DashboardPayload(
        kpis=kpis,
        por_clasificacion=por_clasificacion,
        por_tipo=por_tipo,
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
        # Solo contempla las posiciones de tipo Cash
        limite_cash=_breakdown(
            cash_positions, lambda p: p.cash_limit_alert, total_market_value=tmv,
            fill_labels=["OK", "Revision"],
        ),
        risk_alerts=_risk_alerts(positions),
        limites_concentracion=_concentration_limits(
            por_clasificacion, limite_rf=limite_rf, limite_rv=limite_rv
        ),
    )

    if prev_positions is not None:
        prev_tipo = _breakdown(
            prev_positions, lambda p: p.type,
            total_market_value=sum(p.market_value for p in prev_positions),
        )
        _apply_prev(payload.por_tipo, prev_tipo)
        prev_cls = _breakdown(
            prev_positions, lambda p: p.classification,
            total_market_value=sum(p.market_value for p in prev_positions),
        )
        _apply_prev(payload.por_clasificacion, prev_cls)

        prev_vi = sum(p.valor_informe for p in prev_positions)
        payload.variacion_portafolio = PortfolioVariation(
            mes_actual=current_label,
            mes_anterior=prev_label,
            valor_actual=kpis.valor_informe,
            valor_anterior=prev_vi,
            variacion_abs=kpis.valor_informe - prev_vi,
            variacion_pct=((kpis.valor_informe - prev_vi) / prev_vi) if prev_vi else 0.0,
        )
    return payload


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
        "limites_concentracion": [asdict(r) for r in payload.limites_concentracion],
        "variacion_portafolio": (
            asdict(payload.variacion_portafolio)
            if payload.variacion_portafolio
            else None
        ),
    }
