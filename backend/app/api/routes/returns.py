from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.monthly_return import MonthlyReturn
from app.schemas.analytics import DietzRequest
from app.services import portfolio_repo as repo
from app.services.dietz import CashFlowInput, modified_dietz
from app.services.twr import MonthlyReturnInput, time_weighted_return

router = APIRouter(prefix="/returns", tags=["returns"], dependencies=[Depends(get_current_user)])


@router.post("/dietz")
def dietz(req: DietzRequest, db: Session = Depends(get_db)):
    """Rentabilidad del período por Dietz Modificado.

    Si no se envían `value_start`/`value_end`, se toman de la serie mensual
    del portafolio (Σ Valor Informe) por los meses de las fechas indicadas.
    """
    v_start, v_end = req.value_start, req.value_end
    if v_start is None or v_end is None:
        series = {(b["year"], b["month_index"]): b["valor_informe"]
                  for b in repo.monthly_portfolio_values(db)}
        v_start = v_start if v_start is not None else series.get(
            (req.start_date.year, req.start_date.month)
        )
        v_end = v_end if v_end is not None else series.get((req.end_date.year, req.end_date.month))
    if v_start is None or v_end is None:
        return {"error": "No hay valores de portafolio para esas fechas; envíe value_start/value_end."}

    res = modified_dietz(
        start_date=req.start_date,
        end_date=req.end_date,
        value_start=float(v_start),
        value_end=float(v_end),
        cash_flows=[CashFlowInput(f.flow_date, f.amount, f.description) for f in req.cash_flows],
        benchmark_composite_annual=req.benchmark_composite_annual,
        benchmark_institutional_annual=req.benchmark_institutional_annual,
    )
    out = asdict(res)
    out["flows"] = [asdict(f) for f in res.flows]
    return out


@router.get("/twr")
def twr(db: Session = Depends(get_db), year: int | None = None):
    q = select(MonthlyReturn)
    stored = db.execute(q).scalars().all()
    if not stored:
        repo.recompute_monthly_returns(db)
        db.commit()
        stored = db.execute(q).scalars().all()

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
    result = time_weighted_return(rows)
    return {
        "rows": [asdict(x) for x in result.rows],
        "cumulative_twr": result.cumulative_twr,
        "cumulative_benchmark": result.cumulative_benchmark,
    }


@router.post("/twr/recompute")
def twr_recompute(db: Session = Depends(get_db)):
    n = repo.recompute_monthly_returns(db)
    db.commit()
    return {"recomputed_months": n}
