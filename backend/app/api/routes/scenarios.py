from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.schemas.analytics import ScenarioRequest
from app.services import portfolio_repo as repo
from app.services.scenarios import ScenarioAssetInput, run_matrix

router = APIRouter(prefix="/scenarios", tags=["scenarios"], dependencies=[Depends(get_current_user)])


def _resolve_year(db: Session, month: str, year: int | None) -> int:
    if year:
        return year
    candidates = [p for p in repo.list_periods(db) if p.month.lower() == month.lower()]
    if candidates:
        return candidates[-1].year
    latest = repo.latest_period(db)
    if not latest:
        raise HTTPException(status_code=404, detail="No hay datos cargados todavía.")
    return latest.year


@router.get("/assets")
def scenario_assets(db: Session = Depends(get_db), month: str | None = None, year: int | None = None):
    """Activos disponibles para analizar (excluye Cash)."""
    latest = repo.latest_period(db)
    if not latest:
        return []
    y = year or latest.year
    m = month or latest.month
    inputs = repo.load_position_inputs(db, y, m)
    seen: dict[str, dict] = {}
    for p in inputs:
        if (p.type or "").lower() == "cash" or (p.quantity or 0) <= 0:
            continue
        seen.setdefault(
            p.identifier,
            {
                "identifier": p.identifier,
                "description": p.description,
                "type": p.type,
                "classification": p.classification,
                "sector": p.sector,
            },
        )
    return sorted(seen.values(), key=lambda x: x["description"])


@router.post("")
def run(req: ScenarioRequest, db: Session = Depends(get_db)):
    year = _resolve_year(db, req.month, req.year)
    inputs = repo.load_position_inputs(db, year, req.month)
    match = next((p for p in inputs if p.identifier == req.identifier), None)
    if match is None:
        match = next(
            (p for p in inputs if p.description.lower() == req.identifier.lower()), None
        )
    if match is None:
        raise HTTPException(
            status_code=404,
            detail=f"No se encontró el activo {req.identifier!r} en {req.month} {year}.",
        )

    asset = ScenarioAssetInput(
        identifier=match.identifier,
        description=match.description,
        type=match.type,
        purchase_date=match.acquired_date,
        quantity=float(match.quantity or 0),
        purchase_value=float(match.total_cost_basis or 0),
        market_value=float(match.estimated_market_value or 0),
        as_of=req.as_of,
    )
    if asset.quantity <= 0:
        raise HTTPException(status_code=400, detail="El activo no tiene cantidad para simular.")

    results = run_matrix(asset, req.pct_sales)
    return {
        "asset": asdict(asset),
        "period": {"year": year, "month": req.month},
        "scenarios": [asdict(r) for r in results],
    }
