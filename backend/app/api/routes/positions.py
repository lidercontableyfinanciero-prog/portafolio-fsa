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
    "description", "identifier", "classification", "type", "sector", "market_value",
    "cost_basis", "unrealized_gain_loss", "return_on_cost", "annual_income",
    "current_yield", "dividends_paid", "tax", "tax_rate", "equity_return_on_cost",
    "equity_market_value_return", "stop_loss", "moodys_grade", "sp_grade",
}


@router.get("")
def list_positions(
    db: Session = Depends(get_db),
    year: int | None = None,
    month: str | None = None,
    type: str | None = Query(None),
    classification: str | None = None,
    sector: str | None = None,
    moodys_grade: str | None = None,
    sp_grade: str | None = None,
    search: str | None = None,
    sort_by: str = "market_value",
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=500),
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
        moodys_grade=moodys_grade,
        sp_grade=sp_grade,
    )
    if search:
        s = search.lower()
        rows = [r for r in rows if s in r.description.lower() or s in r.identifier.lower()]

    key = sort_by if sort_by in _SORTABLE else "market_value"

    def sort_key(r):
        v = getattr(r, key)
        return (v is None, (v if isinstance(v, (int, float)) else str(v).lower()))

    rows.sort(key=sort_key, reverse=(sort_dir == "desc"))

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


@router.get("/{identifier:path}/history")
def position_history(identifier: str, db: Session = Depends(get_db)):
    """Evolución histórica del valor de mercado y el yield de una posición."""
    data = repo.instrument_history(db, identifier)
    if data is None:
        raise HTTPException(status_code=404, detail=f"No se encontró la posición {identifier!r}.")
    return data
