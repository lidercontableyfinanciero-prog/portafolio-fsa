"""Puente entre los modelos ORM y las funciones puras de `app/services`."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.models.benchmark import Benchmark
from app.models.cashflow import CashFlow
from app.models.instrument import Instrument
from app.models.monthly_return import MonthlyReturn
from app.models.snapshot import PositionSnapshot
from app.services.constants import (
    month_index_to_name,
    month_name_to_index,
    report_label,
)
from app.services.dietz import CashFlowInput, modified_dietz
from app.services.etl import ParsedRow
from app.services.valuation import PositionInput, PositionMetrics, compute_position, valor_informe


@dataclass(slots=True)
class Period:
    year: int
    month: str
    month_index: int
    report_date: date
    label: str
    positions: int


def list_periods(db: Session) -> list[Period]:
    rows = db.execute(
        select(
            PositionSnapshot.statement_year,
            PositionSnapshot.statement_month,
            PositionSnapshot.report_date,
            func.count(PositionSnapshot.id),
        ).group_by(
            PositionSnapshot.statement_year,
            PositionSnapshot.statement_month,
            PositionSnapshot.report_date,
        )
    ).all()
    periods = [
        Period(
            year=y,
            month=m,
            month_index=month_name_to_index(m),
            report_date=rd,
            label=report_label(y, month_name_to_index(m)),
            positions=cnt,
        )
        for (y, m, rd, cnt) in rows
    ]
    periods.sort(key=lambda p: (p.year, p.month_index))
    return periods


def latest_period(db: Session) -> Period | None:
    periods = list_periods(db)
    return periods[-1] if periods else None


def previous_period(db: Session, year: int, month: str) -> Period | None:
    periods = list_periods(db)
    mi = month_name_to_index(month)
    prev = [p for p in periods if (p.year, p.month_index) < (year, mi)]
    return prev[-1] if prev else None


def param_value(db: Session, key: str, default: float) -> float:
    from app.models.parameter import Parameter

    p = db.get(Parameter, key)
    if p is None or p.value_numeric is None:
        return default
    return float(p.value_numeric)


def _rows_for_period(db: Session, year: int, month: str):
    stmt = (
        select(PositionSnapshot, Instrument)
        .join(Instrument, PositionSnapshot.instrument_id == Instrument.identifier)
        .where(
            PositionSnapshot.statement_year == year,
            func.lower(PositionSnapshot.statement_month) == month.lower(),
        )
    )
    return db.execute(stmt).all()


def load_position_inputs(db: Session, year: int, month: str) -> list[PositionInput]:
    out: list[PositionInput] = []
    for snap, inst in _rows_for_period(db, year, month):
        out.append(
            PositionInput(
                identifier=inst.identifier,
                description=inst.description,
                classification=inst.classification,
                type=inst.type,
                sector=inst.sector,
                moodys_rating=inst.moodys_rating,
                sp_rating=inst.sp_rating,
                coupon_rate=float(inst.coupon_rate) if inst.coupon_rate is not None else None,
                acquired_date=snap.acquired_date,
                maturity_date=inst.maturity_date,
                quantity=_flt(snap.quantity),
                total_cost_basis=_flt(snap.total_cost_basis),
                market_price=_flt(snap.market_price),
                estimated_market_value=_flt(snap.estimated_market_value),
                accrued_interest=_flt(snap.accrued_interest),
                annual_income=_flt(snap.annual_income),
                current_yield=_flt(snap.current_yield),
                dividends_paid=_flt(snap.dividends_paid),
                tax=_flt(snap.tax),
                target_unit_value=_flt(inst.target_unit_value),
            )
        )
    return out


def load_metrics(
    db: Session, year: int, month: str, as_of: date | None = None
) -> list[PositionMetrics]:
    return [compute_position(p, as_of=as_of) for p in load_position_inputs(db, year, month)]


def instrument_history(db: Session, identifier: str) -> dict | None:
    """Evolución histórica de una posición (todos los meses disponibles)."""
    inst = db.get(Instrument, identifier)
    if inst is None:
        return None
    snaps = db.execute(
        select(PositionSnapshot).where(PositionSnapshot.instrument_id == identifier)
    ).scalars().all()
    if not snaps:
        return None
    points = []
    for s in snaps:
        mi = month_name_to_index(s.statement_month)
        points.append(
            {
                "year": s.statement_year,
                "month": s.statement_month,
                "month_index": mi,
                "label": report_label(s.statement_year, mi),
                "report_date": s.report_date,
                "market_value": _flt(s.estimated_market_value) or 0.0,
                "market_price": _flt(s.market_price),
                "cost_basis": _flt(s.total_cost_basis) or 0.0,
                "quantity": _flt(s.quantity),
                "current_yield": _flt(s.current_yield),
                "unrealized_gain_loss": (
                    (_flt(s.estimated_market_value) or 0.0)
                    - (_flt(s.total_cost_basis) or 0.0)
                    if s.total_cost_basis is not None
                    else 0.0
                ),
                "dividends_paid": _flt(s.dividends_paid) or 0.0,
                "accrued_interest": _flt(s.accrued_interest) or 0.0,
            }
        )
    points.sort(key=lambda p: (p["year"], p["month_index"]))
    return {
        "identifier": inst.identifier,
        "description": inst.description,
        "classification": inst.classification,
        "type": inst.type,
        "sector": inst.sector,
        "moodys_rating": inst.moodys_rating,
        "sp_rating": inst.sp_rating,
        "points": points,
    }


def _flt(v) -> float | None:
    return float(v) if v is not None else None


def filter_options(db: Session) -> dict:
    def distinct(col):
        return sorted(
            v for (v,) in db.execute(select(col).distinct()).all() if v not in (None, "")
        )

    years = sorted({y for (y,) in db.execute(select(PositionSnapshot.statement_year).distinct())})
    months_present = {
        m for (m,) in db.execute(select(PositionSnapshot.statement_month).distinct())
    }
    months = sorted(months_present, key=month_name_to_index)
    return {
        "years": years,
        "months": months,
        "types": distinct(Instrument.type),
        "classifications": distinct(Instrument.classification),
        "sectors": distinct(Instrument.sector),
        "rating_grades": ["Grado de Inversión", "Grado Especulativo"],
    }


def monthly_portfolio_values(db: Session) -> list[dict]:
    """Σ 'Valor Informe' por (año, mes), ordenado cronológicamente."""
    rows = _all_rows(db)
    buckets: dict[tuple[int, int], dict] = {}
    for snap, inst in rows:
        mi = month_name_to_index(snap.statement_month)
        key = (snap.statement_year, mi)
        b = buckets.setdefault(
            key,
            {
                "year": snap.statement_year,
                "month_index": mi,
                "month": month_index_to_name(mi),
                "label": report_label(snap.statement_year, mi),
                "valor_informe": 0.0,
                "costo": 0.0,
                "valor_mercado": 0.0,
                "gp_no_realizada": 0.0,
                "ingreso_anual_est": 0.0,
            },
        )
        mv = _flt(snap.estimated_market_value) or 0.0
        cb = _flt(snap.total_cost_basis)
        b["valor_informe"] += valor_informe(mv, _flt(snap.accrued_interest), inst.type)
        b["costo"] += cb or 0.0
        b["valor_mercado"] += mv
        # Sin base de costo (Efectivo) no hay G/(P) no realizada.
        b["gp_no_realizada"] += 0.0 if cb is None else (mv - cb)
        b["ingreso_anual_est"] += _flt(snap.annual_income) or 0.0
    series = sorted(buckets.values(), key=lambda b: (b["year"], b["month_index"]))
    for b in series:
        b["rentab_sobre_costo"] = b["gp_no_realizada"] / b["costo"] if b["costo"] else 0.0
    return series


def _all_rows(db: Session):
    stmt = select(PositionSnapshot, Instrument).join(
        Instrument, PositionSnapshot.instrument_id == Instrument.identifier
    )
    return db.execute(stmt).all()


# --------------------------------------------------------------------------- #
# Escritura (ETL)
# --------------------------------------------------------------------------- #
def upsert_parsed_rows(db: Session, rows: list[ParsedRow]) -> dict:
    # Cachés locales: `db.get`/`select` no ven objetos aún no volcados (autoflush=off),
    # así que se lleva el registro de lo creado en esta misma pasada.
    inst_cache: dict[str, Instrument] = {}
    snap_cache: dict[tuple, PositionSnapshot] = {}
    inst_seen: set[str] = set()
    inserted = updated = 0

    # Mapa descripción -> identificador REAL (no sintético) para reconciliar los
    # meses en que el extracto trae la acción sin CUSIP/ticker.
    desc_to_real_id: dict[str, str] = {
        (d or "").strip().lower(): i
        for i, d in db.execute(
            select(Instrument.identifier, Instrument.description).where(
                Instrument.identifier != Instrument.description
            )
        ).all()
        if d
    }

    for row in rows:
        ident = row.instrument["identifier"]
        desc = (row.instrument.get("description") or "").strip()

        # Fila con identificador sintético (== descripción): si ya existe un
        # instrumento REAL con esa misma descripción, reutiliza su identificador.
        if ident == desc and desc:
            real = desc_to_real_id.get(desc.lower())
            if real:
                ident = real
                row.instrument["identifier"] = real

        inst = inst_cache.get(ident) or db.get(Instrument, ident)
        if inst is None:
            inst = Instrument(
                identifier=ident,
                description=row.instrument.get("description") or ident,
            )
            db.add(inst)
        inst_cache[ident] = inst
        if ident not in inst_seen:
            for k, v in row.instrument.items():
                if k != "identifier" and v is not None:
                    setattr(inst, k, v)
            inst_seen.add(ident)
        if ident != desc and desc:
            desc_to_real_id.setdefault(desc.lower(), ident)

        year = int(row.snapshot["statement_year"])
        month = str(row.snapshot["statement_month"]).lower()
        acq = row.snapshot.get("acquired_date")
        key = (ident, year, month, acq)
        snap = snap_cache.get(key)
        if snap is None:
            snap = db.execute(
                select(PositionSnapshot).where(
                    PositionSnapshot.instrument_id == ident,
                    PositionSnapshot.statement_year == year,
                    func.lower(PositionSnapshot.statement_month) == month,
                    PositionSnapshot.acquired_date.is_(acq)
                    if acq is None
                    else PositionSnapshot.acquired_date == acq,
                )
            ).scalar_one_or_none()

        if snap is None:
            snap = PositionSnapshot(instrument_id=ident)
            db.add(snap)
            inserted += 1
        else:
            updated += 1
        snap_cache[key] = snap
        for k, v in row.snapshot.items():
            setattr(snap, k, v)

    db.flush()
    return {
        "instruments": len(inst_seen),
        "snapshots_inserted": inserted,
        "snapshots_updated": updated,
    }


def periods_with_data(
    db: Session, periods: list[tuple[int, str]]
) -> dict[tuple[int, str], int]:
    """De los `periods` (año, mes) dados, cuáles ya tienen snapshots y con cuántas filas."""
    if not periods:
        return {}
    clauses = [
        (PositionSnapshot.statement_year == y)
        & (func.lower(PositionSnapshot.statement_month) == m.lower())
        for y, m in periods
    ]
    rows = db.execute(
        select(
            PositionSnapshot.statement_year,
            PositionSnapshot.statement_month,
            func.count(PositionSnapshot.id),
        )
        .where(or_(*clauses))
        .group_by(PositionSnapshot.statement_year, PositionSnapshot.statement_month)
    ).all()
    # normaliza la clave al par (año, mes) tal cual viene en `periods`
    canon = {(y, m.lower()): (y, m) for y, m in periods}
    out: dict[tuple[int, str], int] = {}
    for y, m, cnt in rows:
        out[canon.get((y, m.lower()), (y, m))] = cnt
    return out


def delete_snapshots_for_periods(db: Session, periods: list[tuple[int, str]]) -> int:
    """Borra todos los snapshots de los períodos dados (para recarga 'replace')."""
    if not periods:
        return 0
    clauses = [
        (PositionSnapshot.statement_year == y)
        & (func.lower(PositionSnapshot.statement_month) == m.lower())
        for y, m in periods
    ]
    res = db.execute(
        delete(PositionSnapshot).where(or_(*clauses)).execution_options(
            synchronize_session=False
        )
    )
    db.flush()
    return res.rowcount or 0


def recompute_monthly_returns(db: Session) -> int:
    """Dietz Modificado mes a mes a partir de la serie de valores y los flujos/benchmarks."""
    series = monthly_portfolio_values(db)
    if len(series) < 2:
        return 0

    flows = db.execute(select(CashFlow)).scalars().all()
    benchmarks = {
        (b.period_year, b.period_month): b for b in db.execute(select(Benchmark)).scalars().all()
    }

    count = 0
    for prev, curr in zip(series, series[1:], strict=False):
        start = date(prev["year"], prev["month_index"], 1)
        end = date(curr["year"], curr["month_index"], 1)
        # fin de período = primer día del mes actual (como en la hoja Rentabilidad)
        cfs = [
            CashFlowInput(f.flow_date, float(f.amount), f.description or "")
            for f in flows
            if start < f.flow_date <= end
        ]
        bm = benchmarks.get((curr["year"], curr["month_index"]))
        res = modified_dietz(
            start_date=start,
            end_date=end,
            value_start=prev["valor_informe"],
            value_end=curr["valor_informe"],
            cash_flows=cfs,
            benchmark_composite_annual=float(bm.composite_rate) if bm and bm.composite_rate else None,
        )
        existing = db.execute(
            select(MonthlyReturn).where(
                MonthlyReturn.period_year == curr["year"],
                MonthlyReturn.period_month == curr["month_index"],
            )
        ).scalar_one_or_none()
        if existing is None:
            existing = MonthlyReturn(
                period_year=curr["year"], period_month=curr["month_index"]
            )
            db.add(existing)
        existing.dietz_return = res.period_return
        existing.benchmark_return = res.benchmark_composite_monthly
        count += 1

    db.flush()
    return count
