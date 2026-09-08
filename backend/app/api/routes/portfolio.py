from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.services import portfolio_repo as repo
from app.services.aggregations import build_dashboard, filter_positions, payload_to_dict

router = APIRouter(prefix="/portfolio", tags=["portfolio"], dependencies=[Depends(get_current_user)])


def _resolve_period(db: Session, year: int | None, month: str | None):
    if year and month:
        return year, month
    latest = repo.latest_period(db)
    if not latest:
        raise HTTPException(status_code=404, detail="No hay datos cargados todavía.")
    return latest.year, latest.month


@router.get("/periods")
def periods(db: Session = Depends(get_db)):
    return [
        {
            "year": p.year,
            "month": p.month,
            "month_index": p.month_index,
            "report_date": p.report_date,
            "label": p.label,
            "positions": p.positions,
        }
        for p in repo.list_periods(db)
    ]


@router.get("/filters")
def filters(db: Session = Depends(get_db)):
    return repo.filter_options(db)


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    year: int | None = None,
    month: str | None = None,
    type: str | None = Query(None),
    classification: str | None = None,
    sector: str | None = None,
    moodys_grade: str | None = None,
    sp_grade: str | None = None,
    as_of: date | None = None,
):
    year, month = _resolve_period(db, year, month)
    metrics = repo.load_metrics(db, year, month, as_of=as_of)
    filtered = filter_positions(
        metrics,
        type_=type,
        classification=classification,
        sector=sector,
        moodys_grade=moodys_grade,
        sp_grade=sp_grade,
    )

    prev = repo.previous_period(db, year, month)
    prev_filtered = None
    prev_label = ""
    if prev:
        prev_metrics = repo.load_metrics(db, prev.year, prev.month, as_of=as_of)
        prev_filtered = filter_positions(
            prev_metrics,
            type_=type,
            classification=classification,
            sector=sector,
            moodys_grade=moodys_grade,
            sp_grade=sp_grade,
        )
        prev_label = prev.label

    limite_rf = repo.param_value(db, "peso_max_renta_fija", 0.70)
    limite_rv = repo.param_value(db, "peso_max_renta_variable", 0.30)

    payload = payload_to_dict(
        build_dashboard(
            filtered,
            prev_positions=prev_filtered,
            prev_label=prev_label,
            current_label=f"{month} {year}",
            limite_rf=limite_rf,
            limite_rv=limite_rv,
        )
    )
    payload["period"] = {"year": year, "month": month}
    payload["applied_filters"] = {
        "type": type,
        "classification": classification,
        "sector": sector,
        "moodys_grade": moodys_grade,
        "sp_grade": sp_grade,
    }
    return payload


@router.get("/evolution")
def evolution(db: Session = Depends(get_db)):
    """Serie mensual del portafolio (para el gráfico de línea Valor vs Costo)."""
    return repo.monthly_portfolio_values(db)
