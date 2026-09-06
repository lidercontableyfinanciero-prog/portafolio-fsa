from __future__ import annotations

from dataclasses import asdict
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.monthly_return import MonthlyReturn
from app.services import exporters, portfolio_repo as repo
from app.services.aggregations import build_dashboard, filter_positions, payload_to_dict
from app.services.twr import MonthlyReturnInput, time_weighted_return

router = APIRouter(prefix="/export", tags=["export"], dependencies=[Depends(get_current_user)])

_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _resolve(db: Session, year: int | None, month: str | None):
    if year and month:
        return year, month
    latest = repo.latest_period(db)
    if not latest:
        raise HTTPException(status_code=404, detail="No hay datos cargados todavía.")
    return latest.year, latest.month


def _filtered_metrics(
    db, year, month, type_, classification, sector, rating_grade, rating_agency, as_of
):
    metrics = repo.load_metrics(db, year, month, as_of=as_of)
    return filter_positions(
        metrics,
        type_=type_,
        classification=classification,
        sector=sector,
        rating_grade=rating_grade,
        rating_agency=rating_agency,
    )


def _twr_dict(db: Session, year: int | None = None) -> dict:
    stored = db.execute(select(MonthlyReturn)).scalars().all()
    if not stored:
        repo.recompute_monthly_returns(db)
        db.commit()
        stored = db.execute(select(MonthlyReturn)).scalars().all()
    rows = [
        MonthlyReturnInput(
            year=r.period_year,
            month=r.period_month,
            portfolio_return=float(r.dietz_return) if r.dietz_return is not None else None,
            benchmark_return=float(r.benchmark_return) if r.benchmark_return is not None else None,
        )
        for r in stored
        if year is None or r.period_year == year
    ]
    res = time_weighted_return(rows)
    return {
        "rows": [asdict(x) for x in res.rows],
        "cumulative_twr": res.cumulative_twr,
        "cumulative_benchmark": res.cumulative_benchmark,
    }


def _common_params(
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
    y, m = _resolve(db, year, month)
    metrics = _filtered_metrics(
        db, y, m, type, classification, sector, rating_grade, rating_agency, as_of
    )
    meta = {
        "period": {"year": y, "month": m},
        "filters": {
            "tipo": type,
            "clasificación": classification,
            "sector": sector,
            "calificación": rating_grade,
        },
    }
    return db, metrics, meta, y


def _attach(data: bytes, media: str, filename: str) -> Response:
    return Response(
        content=data,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _slug(meta: dict) -> str:
    p = meta["period"]
    return f"{p['month']}_{p['year']}".lower()


# --------------------------------------------------------------------------- #
@router.get("/positions.xlsx")
def positions_xlsx(bundle=Depends(_common_params)):
    _db, metrics, meta, _ = bundle
    rows = [asdict(m) for m in metrics]
    data = exporters.positions_to_xlsx(rows, meta)
    return _attach(data, _XLSX, f"posiciones_{_slug(meta)}.xlsx")


@router.get("/positions.pdf")
def positions_pdf(bundle=Depends(_common_params)):
    _db, metrics, meta, _ = bundle
    rows = [asdict(m) for m in metrics]
    data = exporters.positions_to_pdf(rows, meta)
    return _attach(data, "application/pdf", f"posiciones_{_slug(meta)}.pdf")


@router.get("/dashboard.xlsx")
def dashboard_xlsx(bundle=Depends(_common_params)):
    db, metrics, meta, _year = bundle
    dash = payload_to_dict(build_dashboard(metrics))
    evolution = repo.monthly_portfolio_values(db)
    twr = _twr_dict(db)
    data = exporters.dashboard_to_xlsx(dash, evolution, twr, meta)
    return _attach(data, _XLSX, f"dashboard_{_slug(meta)}.xlsx")


@router.get("/dashboard.pdf")
def dashboard_pdf(bundle=Depends(_common_params)):
    db, metrics, meta, _year = bundle
    dash = payload_to_dict(build_dashboard(metrics))
    evolution = repo.monthly_portfolio_values(db)
    twr = _twr_dict(db)
    data = exporters.dashboard_to_pdf(dash, evolution, twr, meta)
    return _attach(data, "application/pdf", f"dashboard_{_slug(meta)}.pdf")
