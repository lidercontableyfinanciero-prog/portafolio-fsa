"""Valoración por posición — reimplementa las columnas calculadas X–AO del Excel.

Funciones puras: reciben datos primitivos, no tocan la base de datos.
Ver docs/FINANCIAL_LOGIC.md §1.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from app.services.constants import (
    BOND_MAX_TERM_YEARS,
    CASH_LIMIT_HIGH,
    CASH_LIMIT_LOW,
    CONCENTRATION_LIMIT_USD,
    DAYS_YEAR_HOLDING,
    DAYS_YEAR_MATURITY,
    DAYS_YEAR_TERM,
    GRADE_INVESTMENT,
    GRADE_NOT_APPLICABLE,
    GRADE_SPECULATIVE,
    GRADE_UNRATED,
    STATEMENT_CURRENCY,
    MOODYS_INVESTMENT_GRADE,
    SP_INVESTMENT_GRADE,
    STOP_LOSS_EVALUATE,
    STOP_LOSS_EXECUTE,
    STOP_LOSS_MONITOR,
    STOP_LOSS_STABLE,
)

# Comparación insensible a mayúsculas/minúsculas (ver `moodys_grade`/`sp_grade`).
MOODYS_INVESTMENT_GRADE_NORM = {c.upper() for c in MOODYS_INVESTMENT_GRADE}
SP_INVESTMENT_GRADE_NORM = {c.upper() for c in SP_INVESTMENT_GRADE}


def _f(x: float | int | None) -> float:
    return float(x) if x is not None else 0.0


def unrealized_gain_loss(market_value: float | None, cost_basis: float | None) -> float:
    """Mark-to-Market: Valor de Mercado Estimado − Base de Costo Total."""
    return _f(market_value) - _f(cost_basis)


def return_on_cost(gain_loss: float, cost_basis: float | None) -> float:
    cb = _f(cost_basis)
    return gain_loss / cb if cb else 0.0


def is_bond(type_: str | None) -> bool:
    """Única regla para decidir si una posición es un bono (tipo de activo "Bond")."""
    return (type_ or "").strip().lower() == "bond"


def valor_informe(
    market_value: float | None, accrued_interest: float | None, type_: str | None
) -> float:
    """Columna AF: bonos suman el interés acumulado estimado."""
    if is_bond(type_):
        return _f(market_value) + _f(accrued_interest)
    return _f(market_value)


def is_unrated(rating: str | None) -> bool:
    """Sin calificación vigente: vacío, "***", "WR" (retirada) o "NR"."""
    r = (rating or "").strip().upper()
    return not r or "*" in r or r.startswith(("WR", "NR", "N/A"))


def _grade(rating: str | None, investment_set: set[str]) -> str:
    if is_unrated(rating):
        return GRADE_UNRATED
    r = (rating or "").strip().upper()
    return GRADE_INVESTMENT if r in investment_set else GRADE_SPECULATIVE


def moodys_grade(rating: str | None) -> str:
    """Columna AI. El extracto trae la calificación en MAYÚSCULAS ("BAA2"),
    mientras que la notación oficial de Moody's usa minúsculas ("Baa2") — se
    normaliza a mayúsculas en ambos lados para no perder coincidencias."""
    return _grade(rating, MOODYS_INVESTMENT_GRADE_NORM)


def sp_grade(rating: str | None) -> str:
    return _grade(rating, SP_INVESTMENT_GRADE_NORM)


def credit_grade(grade: str, type_: str | None) -> str:
    """KPI de riesgo crediticio: SOLO aplica a bonos. Acciones, fondos,
    inversiones alternativas, efectivo, etc. quedan en "N/A" y fuera de los
    KPI Moody's / S&P (no se les asigna una calificación artificial)."""
    return grade if is_bond(type_) else GRADE_NOT_APPLICABLE


def stop_loss_indicator(gain_loss: float, cost_basis: float | None) -> str:
    """Columna AH."""
    if gain_loss >= 0:
        return STOP_LOSS_STABLE
    cb = _f(cost_basis)
    if not cb:
        return STOP_LOSS_STABLE
    ratio = gain_loss / cb
    if ratio <= -0.50:
        return STOP_LOSS_EXECUTE
    if ratio <= -0.20:
        return STOP_LOSS_EVALUATE
    if ratio <= -0.10:
        return STOP_LOSS_MONITOR
    return STOP_LOSS_STABLE


def initial_term_years(acquired: date | None, maturity: date | None) -> float | None:
    if not acquired or not maturity:
        return None
    return (maturity - acquired).days / DAYS_YEAR_TERM


def term_to_maturity_years(acquired: date | None, as_of: date | None = None) -> float | None:
    """Columna AM del Excel ("Plazo al vencimiento"): (hoy − fecha de compra) / 360.
    Pese al nombre del Excel mide el plazo de TENENCIA; para el tiempo que
    falta hasta el vencimiento usar `time_to_maturity_years`."""
    if not acquired:
        return None
    ref = as_of or date.today()
    return (ref - acquired).days / DAYS_YEAR_HOLDING


def time_to_maturity_years(maturity: date | None, as_of: date | None = None) -> float | None:
    """Tiempo al vencimiento: (fecha de vencimiento − hoy) / 365, en años.

    ÚNICA fuente de esta variable: la usan la columna de Posiciones, las alertas
    "Vencimientos < 1 año" y "Plazo prom. vencimiento", sus ventanas de detalle
    y los reportes. Negativo => la posición ya venció. `None` si no tiene
    fecha de vencimiento (acciones, fondos, efectivo…)."""
    if not maturity:
        return None
    ref = as_of or date.today()
    return (maturity - ref).days / DAYS_YEAR_MATURITY


def time_alert(initial_term: float | None) -> str:
    return "Revisar" if (initial_term or 0) > BOND_MAX_TERM_YEARS else "OK"


def issuer_alert(cost_basis: float | None) -> str:
    return "Revisar" if _f(cost_basis) > CONCENTRATION_LIMIT_USD else "OK"


def cash_limit_alert(market_value: float | None, type_: str | None = None) -> str:
    """Columna AO — límite de caja. Solo aplica a posiciones de tipo Cash."""
    if type_ is not None and (type_ or "").strip().lower() != "cash":
        return "N/A"
    mv = _f(market_value)
    return "Revision" if mv < CASH_LIMIT_LOW or mv > CASH_LIMIT_HIGH else "OK"


def market_value_return(
    equity_roc: float, gain_loss: float, cost_basis: float | None, classification: str | None
) -> float:
    """Columna AA — Rentabilidad Valor de Mercado (solo Renta Variable).

    Fórmula del Excel: (Rentabilidad Costo + Unrealized G/L) / Total Cost Basis.
    """
    if (classification or "").strip().lower() != "renta variable":
        return 0.0
    cb = _f(cost_basis)
    return (equity_roc + gain_loss) / cb if cb else 0.0


def equity_return_on_cost(
    dividends_paid: float | None, tax: float | None, cost_basis: float | None, classification: str | None
) -> float:
    """Columna Z — solo Renta Variable."""
    if (classification or "").strip().lower() != "renta variable":
        return 0.0
    cb = _f(cost_basis)
    return (_f(dividends_paid) - _f(tax)) / cb if cb else 0.0


def tax_rate(tax: float | None, dividends_paid: float | None) -> float:
    dp = _f(dividends_paid)
    return _f(tax) / dp if dp else 0.0


def accrued_coupon(cost_basis: float | None, coupon_rate: float | None, type_: str | None) -> float:
    """Columna Y — solo bonos."""
    if is_bond(type_):
        return _f(cost_basis) * _f(coupon_rate)
    return 0.0


def unit_value_cost(cost_basis: float | None, quantity: float | None) -> float | None:
    q = _f(quantity)
    return _f(cost_basis) / q if q else None


def unit_value_market(market_value: float | None, quantity: float | None) -> float | None:
    q = _f(quantity)
    return _f(market_value) / q if q else None


@dataclass(slots=True)
class PositionInput:
    identifier: str
    description: str = ""
    classification: str | None = None
    type: str | None = None
    sector: str | None = None
    moodys_rating: str | None = None
    sp_rating: str | None = None
    coupon_rate: float | None = None
    acquired_date: date | None = None
    maturity_date: date | None = None
    quantity: float | None = None
    total_cost_basis: float | None = None
    market_price: float | None = None
    estimated_market_value: float | None = None
    accrued_interest: float | None = None
    annual_income: float | None = None
    current_yield: float | None = None
    dividends_paid: float | None = None
    tax: float | None = None
    target_unit_value: float | None = None


@dataclass(slots=True)
class PositionMetrics:
    identifier: str
    description: str
    classification: str | None
    type: str | None
    sector: str | None
    acquired_date: date | None
    maturity_date: date | None
    coupon_rate: float | None
    currency: str
    face_value: float | None
    market_value: float
    cost_basis: float
    market_price: float
    quantity: float
    unrealized_gain_loss: float
    return_on_cost: float
    valor_informe: float
    accrued_interest: float
    annual_income: float
    current_yield: float
    weighted_yield: float
    dividends_paid: float
    tax: float
    tax_rate: float
    moodys_rating: str | None
    sp_rating: str | None
    moodys_grade: str
    sp_grade: str
    stop_loss: str
    initial_term_years: float | None
    term_to_maturity_years: float | None
    time_to_maturity_years: float | None
    time_alert: str
    issuer_alert: str
    cash_limit_alert: str
    equity_return_on_cost: float
    equity_market_value_return: float
    unit_value_cost: float | None
    unit_value_market: float | None
    sell_indicator: str
    extras: dict = field(default_factory=dict)


def compute_position(pos: PositionInput, as_of: date | None = None) -> PositionMetrics:
    mv = _f(pos.estimated_market_value)
    cb = _f(pos.total_cost_basis)
    # Sin base de costo (p. ej. Efectivo) no hay ganancia/(pérdida) no realizada.
    gl = 0.0 if pos.total_cost_basis is None else unrealized_gain_loss(mv, cb)
    it = initial_term_years(pos.acquired_date, pos.maturity_date)
    uv_mkt = unit_value_market(mv, pos.quantity)
    target = pos.target_unit_value
    sell_indicator = (
        "Objetivo Esperado"
        if uv_mkt is not None and target is not None and uv_mkt > target
        else "No alcanzado"
    )
    eq_roc = equity_return_on_cost(pos.dividends_paid, pos.tax, cb, pos.classification)
    return PositionMetrics(
        identifier=pos.identifier,
        description=pos.description,
        classification=pos.classification,
        type=pos.type,
        sector=pos.sector,
        acquired_date=pos.acquired_date,
        maturity_date=pos.maturity_date,
        # La tasa cupón solo aplica a bonos ("Tasa, si aplica").
        coupon_rate=pos.coupon_rate if is_bond(pos.type) else None,
        currency=STATEMENT_CURRENCY,
        # En los bonos la cantidad del extracto es el valor nominal (par).
        face_value=_f(pos.quantity) if is_bond(pos.type) else None,
        market_value=mv,
        cost_basis=cb,
        market_price=_f(pos.market_price),
        quantity=_f(pos.quantity),
        unrealized_gain_loss=gl,
        return_on_cost=return_on_cost(gl, cb),
        valor_informe=valor_informe(mv, pos.accrued_interest, pos.type),
        accrued_interest=_f(pos.accrued_interest),
        annual_income=_f(pos.annual_income),
        current_yield=_f(pos.current_yield),
        weighted_yield=(_f(pos.annual_income) / mv if mv else 0.0),
        dividends_paid=_f(pos.dividends_paid),
        tax=_f(pos.tax),
        tax_rate=tax_rate(pos.tax, pos.dividends_paid),
        moodys_rating=pos.moodys_rating,
        sp_rating=pos.sp_rating,
        moodys_grade=credit_grade(moodys_grade(pos.moodys_rating), pos.type),
        sp_grade=credit_grade(sp_grade(pos.sp_rating), pos.type),
        stop_loss=stop_loss_indicator(gl, cb),
        initial_term_years=it,
        term_to_maturity_years=term_to_maturity_years(pos.acquired_date, as_of),
        time_to_maturity_years=time_to_maturity_years(pos.maturity_date, as_of),
        time_alert=time_alert(it),
        issuer_alert=issuer_alert(cb),
        cash_limit_alert=cash_limit_alert(mv, pos.type),
        equity_return_on_cost=eq_roc,
        equity_market_value_return=market_value_return(eq_roc, gl, cb, pos.classification),
        unit_value_cost=unit_value_cost(cb, pos.quantity),
        unit_value_market=uv_mkt,
        sell_indicator=sell_indicator,
        extras={"accrued_coupon": accrued_coupon(cb, pos.coupon_rate, pos.type)},
    )
