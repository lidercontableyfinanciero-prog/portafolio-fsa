from __future__ import annotations

from dataclasses import asdict
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.services import portfolio_repo as repo
from app.services.aggregations import filter_positions

router = APIRouter(prefix="/positions", tags=["positions"], dependencies=[Depends(get_current_user)])

_SORTABLE = {
    "description", "classification", "type", "sector", "market_value", "cost_basis",
    "unrealized_gain_loss", "return_on_cost", "annual_income", "stop_loss",
}


@router.get("")
def list_positions(
    db: Session = Depends(get_db),
    year: int | None = None,
    month: str | None = None,
    type: str | None = Query(None),
    classification: str | None = None,
    sector: str | None = None,
    rating_grade: str | None = None,
    rating_agency: str = Query("moodys", pattern="^(moodys|sp)$"),
    search: str | None = None,
    sort_by: str = "market_value",
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    as_of: date | None = None,
):
    if year is None or month is None:
        latest = repo.latest_period(db)
        if not latest:
            raise HTTPException(status_code=404, detail="No hay datos cargados todavía.")
        year, month = latest.year, latest.month

    metrics = repo.load_metrics(db, year, month, as_of=as_of)
    rows = filter_positions(
        metrics,
        type_=type,
        classification=classification,
        sector=sector,
        rating_grade=rating_grade,
        rating_agency=rating_agency,
    )
    if search:
        s = search.lower()
        rows = [r for r in rows if s in r.description.lower() or s in r.identifier.lower()]

    key = sort_by if sort_by in _SORTABLE else "market_value"
    rows.sort(key=lambda r: (getattr(r, key) is None, getattr(r, key)), reverse=(sort_dir == "desc"))

    total = len(rows)
    start = (page - 1) * page_size
    page_rows = rows[start : start + page_size]
    return {
        "period": {"year": year, "month": month},
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [asdict(r) for r in page_rows],
    }
