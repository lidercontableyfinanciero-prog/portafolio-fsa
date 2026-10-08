"""Agregados del dashboard — equivalentes a los SUMIFS/COUNTIFS de la hoja `Dashboard`.

Ver docs/FINANCIAL_LOGIC.md §2.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import asdict, dataclass, field

from app.services.constants import (
    EQUITY_MAX_WEIGHT,
    FIXED_INCOME_MAX_WEIGHT,
    GRADE_INVESTMENT,
    GRADE_SPECULATIVE,
    GRADE_UNRATED,
    STOP_LOSS_EVALUATE,
    STOP_LOSS_EXECUTE,
)
from app.services.valuation import PositionMetrics, is_bond


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
class CreditUniverse:
    """Universo de los KPI de calidad crediticia: SOLO bonos."""
    posiciones: int = 0
    valor_mercado: float = 0.0


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
    calidad_universo: CreditUniverse = field(default_factory=CreditUniverse)
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
    moodys_grade=None,      # "Grado de Inversión" / "Grado Especulativo" / "Sin calificación"
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


# --------------------------------------------------------------------------- #
# Alertas — registro ÚNICO de condiciones. Lo usan tanto los contadores del
# dashboard (`_risk_alerts`, paneles de riesgo) como la ventana de detalle
# (`alert_detail`): la cifra de la tarjeta y las filas del modal salen del
# mismo predicado, así que no pueden diferir.
# --------------------------------------------------------------------------- #
def _count(positions: Iterable[PositionMetrics]) -> int:
    """Regla de conteo de posiciones del dashboard (igual que KPI `n_posiciones`)."""
    return sum(1 for p in positions if p.market_value > 0)


def _matures_within_year(p: PositionMetrics) -> bool:
    t = p.time_to_maturity_years
    return t is not None and t < 1


def _bond_with_maturity(p: PositionMetrics) -> bool:
    return is_bond(p.type) and p.time_to_maturity_years is not None


def average_time_to_maturity(positions: Iterable[PositionMetrics]) -> float:
    """Promedio simple del tiempo al vencimiento (años)."""
    terms = [p.time_to_maturity_years for p in positions if p.time_to_maturity_years is not None]
    return sum(terms) / len(terms) if terms else 0.0


_GL_COLS = (
    "description", "identifier", "type", "classification", "cost_basis", "market_value",
    "unrealized_gain_loss", "return_on_cost", "stop_loss",
)
_ISSUER_COLS = (
    "description", "identifier", "type", "classification", "cost_basis", "market_value",
    "unrealized_gain_loss", "issuer_alert",
)


@dataclass(frozen=True, slots=True)
class AlertRule:
    """Alerta operativa: condición fija sobre cada posición."""
    title: str
    description: str
    predicate: Callable[[PositionMetrics], bool]
    columns: tuple[str, ...]
    sort_by: str = "market_value"
    sort_desc: bool = True


@dataclass(frozen=True, slots=True)
class PanelRule:
    """Panel de riesgo: corte por una dimensión; la condición es `key(p) == categoría`."""
    title: str
    description: str
    key: Callable[[PositionMetrics], str | None]
    columns: tuple[str, ...]
    universe: Callable[[PositionMetrics], bool] = lambda p: True
    sort_by: str = "market_value"
    sort_desc: bool = True


ALERT_RULES: dict[str, AlertRule] = {
    "vencimientos_1a": AlertRule(
        title="Vencimientos < 1 año",
        description="Posiciones cuyo tiempo al vencimiento (hoy → fecha de vencimiento) "
                    "es inferior a 1 año. Incluye posiciones ya vencidas.",
        predicate=_matures_within_year,
        columns=(
            "description", "identifier", "type", "acquired_date", "maturity_date",
            "time_to_maturity_years", "face_value", "market_value", "currency", "coupon_rate",
        ),
        sort_by="time_to_maturity_years",
        sort_desc=False,
    ),
    "plazo_prom_vencimiento": AlertRule(
        title="Plazo promedio de vencimiento (bonos)",
        description="Promedio simple del tiempo al vencimiento de los bonos con fecha "
                    "de vencimiento. Se listan todas las posiciones incluidas en el cálculo.",
        predicate=_bond_with_maturity,
        columns=(
            "description", "identifier", "type", "acquired_date", "maturity_date",
            "time_to_maturity_years", "coupon_rate", "face_value", "market_value",
        ),
        sort_by="time_to_maturity_years",
        sort_desc=False,
    ),
    "emisores_sobre_limite": AlertRule(
        title="Concentración por emisor / activo sobre el límite",
        description="Posiciones cuyo costo supera el límite de concentración "
                    "de 500.000 USD por activo / emisor.",
        predicate=lambda p: p.issuer_alert == "Revisar",
        columns=_ISSUER_COLS,
        sort_by="cost_basis",
    ),
    "stop_loss_venta": AlertRule(
        title="Pérdidas sobre el umbral (evaluar / ejecutar venta)",
        description="Posiciones con pérdida no realizada de al menos 20 % del costo "
                    "(Stop-Loss en «Evaluar Venta» o «Ejecutar Venta»).",
        predicate=lambda p: p.stop_loss in (STOP_LOSS_EVALUATE, STOP_LOSS_EXECUTE),
        columns=_GL_COLS,
        sort_by="return_on_cost",
        sort_desc=False,
    ),
}

_CREDIT_DESCRIPTION = (
    "Solo bonos: acciones, fondos, inversiones alternativas y efectivo no tienen "
    "KPI de riesgo crediticio. El % se calcula sobre el valor de mercado de los bonos."
)

PANEL_RULES: dict[str, PanelRule] = {
    "calidad_moodys": PanelRule(
        title="Calidad crediticia (Moody's)",
        description=_CREDIT_DESCRIPTION,
        key=lambda p: p.moodys_grade,
        universe=lambda p: is_bond(p.type),
        columns=(
            "description", "identifier", "moodys_rating", "moodys_grade",
            "maturity_date", "time_to_maturity_years", "market_value",
        ),
    ),
    "calidad_sp": PanelRule(
        title="Calidad crediticia (S&P)",
        description=_CREDIT_DESCRIPTION,
        key=lambda p: p.sp_grade,
        universe=lambda p: is_bond(p.type),
        columns=(
            "description", "identifier", "sp_rating", "sp_grade",
            "maturity_date", "time_to_maturity_years", "market_value",
        ),
    ),
    "stop_loss": PanelRule(
        title="Indicador Stop-Loss",
        description="Pérdida no realizada sobre el costo: ≤ -10 % Monitoreo, "
                    "≤ -20 % Evaluar venta, ≤ -50 % Ejecutar venta.",
        key=lambda p: p.stop_loss,
        columns=_GL_COLS,
        sort_by="return_on_cost",
        sort_desc=False,
    ),
    "alerta_tiempo": PanelRule(
        title="Alerta Tiempo",
        description="Plazo inicial de compra (fecha de compra → vencimiento) "
                    "superior a 15 años.",
        key=lambda p: p.time_alert,
        columns=(
            "description", "identifier", "type", "acquired_date", "maturity_date",
            "initial_term_years", "time_to_maturity_years", "market_value", "time_alert",
        ),
    ),
    "alerta_emisor": PanelRule(
        title="Alerta Emisor",
        description="Costo de la posición frente al límite de concentración de 500.000 USD.",
        key=lambda p: p.issuer_alert,
        columns=_ISSUER_COLS,
        sort_by="cost_basis",
    ),
    "limite_cash": PanelRule(
        title="Límite de Caja",
        description="Solo posiciones de tipo Cash: saldo fuera del rango 150.000 – 200.000 USD.",
        key=lambda p: p.cash_limit_alert,
        universe=lambda p: (p.type or "").lower() == "cash",
        columns=("description", "type", "classification", "market_value", "cash_limit_alert"),
    ),
    "clasificacion": PanelRule(
        title="Límite de concentración",
        description="Posiciones que componen la participación de la clasificación "
                    "frente al límite de política.",
        key=lambda p: p.classification,
        columns=(
            "description", "identifier", "type", "classification", "cost_basis",
            "market_value", "unrealized_gain_loss",
        ),
    ),
}


def _risk_alerts(positions: list[PositionMetrics]) -> RiskAlerts:
    def matching(name: str) -> list[PositionMetrics]:
        return [p for p in positions if ALERT_RULES[name].predicate(p)]

    venc = matching("vencimientos_1a")
    emis = matching("emisores_sobre_limite")
    return RiskAlerts(
        vencimientos_1a_posiciones=_count(venc),
        vencimientos_1a_valor=sum(p.market_value for p in venc),
        plazo_prom_vencimiento_bonos=average_time_to_maturity(
            matching("plazo_prom_vencimiento")
        ),
        emisores_sobre_limite=_count(emis),
        valor_emisores_sobre_limite=sum(p.market_value for p in emis),
        posiciones_stop_loss_venta=_count(matching("stop_loss_venta")),
    )


def _credit_breakdown(positions: list[PositionMetrics], name: str) -> list[BreakdownRow]:
    """Moody's / S&P: conteo y % calculados SOLO sobre el universo de bonos."""
    rule = PANEL_RULES[name]
    bonds = [p for p in positions if rule.universe(p)]
    return _breakdown(
        bonds, rule.key,
        total_market_value=sum(p.market_value for p in bonds),
        fill_labels=[GRADE_INVESTMENT, GRADE_SPECULATIVE, GRADE_UNRATED],
    )


class UnknownAlert(ValueError):
    pass


def alert_detail(
    positions: list[PositionMetrics], alert: str, label: str | None = None
) -> dict:
    """Detalle dinámico de una alerta para la ventana emergente:
    identifica la condición -> filtra las posiciones que la cumplen -> resumen.

    - `alert` ∈ ALERT_RULES -> alerta operativa (sin `label`).
    - `alert` ∈ PANEL_RULES -> categoría `label` de un panel de riesgo.
    """
    rule: AlertRule | PanelRule
    if alert in ALERT_RULES:
        rule = ALERT_RULES[alert]
        universe = positions
        items = [p for p in positions if rule.predicate(p)]
        title = rule.title
    elif alert in PANEL_RULES:
        if not label:
            raise UnknownAlert(f"La alerta {alert!r} requiere la categoría (label).")
        rule = PANEL_RULES[alert]
        universe = [p for p in positions if rule.universe(p)]
        items = [p for p in universe if (rule.key(p) or "(sin dato)") == label]
        title = f"{rule.title} · {label}"
    else:
        raise UnknownAlert(f"Alerta desconocida: {alert!r}")

    present = [p for p in items if getattr(p, rule.sort_by) is not None]
    missing = [p for p in items if getattr(p, rule.sort_by) is None]
    present.sort(key=lambda p: getattr(p, rule.sort_by), reverse=rule.sort_desc)
    items = present + missing

    universe_mv = sum(p.market_value for p in universe)
    mv = sum(p.market_value for p in items)
    with_term = [p for p in items if p.time_to_maturity_years is not None]
    return {
        "alert": alert,
        "label": label,
        "title": title,
        "description": rule.description,
        "columns": list(rule.columns),
        "summary": {
            "posiciones": _count(items),
            "valor_mercado": mv,
            "costo": sum(p.cost_basis for p in items),
            "gp_no_realizada": sum(p.unrealized_gain_loss for p in items),
            "pct_universo": (mv / universe_mv) if universe_mv else 0.0,
            "universo_posiciones": _count(universe),
            "con_vencimiento": len(with_term),
            "plazo_promedio_anios": (
                average_time_to_maturity(with_term) if with_term else None
            ),
        },
        "items": [asdict(p) for p in items],
    }


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
    bonds = [p for p in positions if is_bond(p.type)]

    payload = DashboardPayload(
        kpis=kpis,
        por_clasificacion=por_clasificacion,
        por_tipo=por_tipo,
        por_sector=_breakdown(positions, lambda p: p.sector, total_market_value=tmv),
        # Moody's / S&P: universo = SOLO bonos (conteo y % sobre los bonos).
        calidad_moodys=_credit_breakdown(positions, "calidad_moodys"),
        calidad_sp=_credit_breakdown(positions, "calidad_sp"),
        calidad_universo=CreditUniverse(
            posiciones=_count(bonds),
            valor_mercado=sum(p.market_value for p in bonds),
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
        "calidad_universo": asdict(payload.calidad_universo),
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
