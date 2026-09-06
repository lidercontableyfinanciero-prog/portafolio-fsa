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
    rating_grade: str | None = None,
    rating_agency: str = Query("moodys", pattern="^(moodys|sp)$"),
    as_of: date | None = None,
):
    year, month = _resolve_period(db, year, month)
    metrics = repo.load_metrics(db, year, month, as_of=as_of)
    filtered = filter_positions(
        metrics,
        type_=type,
        classification=classification,
        sector=sector,
        rating_grade=rating_grade,
        rating_agency=rating_agency,
    )
    payload = payload_to_dict(build_dashboard(filtered))
    payload["period"] = {"year": year, "month": month}
    payload["applied_filters"] = {
        "type": type,
        "classification": classification,
        "sector": sector,
        "rating_grade": rating_grade,
        "rating_agency": rating_agency,
    }
    return payload


@router.get("/evolution")
def evolution(db: Session = Depends(get_db)):
    """Serie mensual del portafolio (para el gráfico de línea Valor vs Costo)."""
    return repo.monthly_portfolio_values(db)
