"""CRUD mínimo de flujos de caja y benchmarks (insumos de Dietz / TWR). Solo admin."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db
from app.models.benchmark import Benchmark
from app.models.cashflow import CashFlow
from app.services import portfolio_repo as repo

router = APIRouter(prefix="/data", tags=["data-admin"])


class CashFlowIn(BaseModel):
    flow_date: date
    amount: float
    description: str = ""


class BenchmarkIn(BaseModel):
    period_year: int
    period_month: int
    composite_rate: float | None = None
    institutional_rate: float | None = None


@router.get("/cash-flows", dependencies=[Depends(get_current_user)])
def list_cash_flows(db: Session = Depends(get_db)):
    return [
        {"id": c.id, "flow_date": c.flow_date, "amount": float(c.amount), "description": c.description}
        for c in db.execute(select(CashFlow).order_by(CashFlow.flow_date)).scalars()
    ]


@router.post("/cash-flows", dependencies=[Depends(require_admin)])
def add_cash_flow(body: CashFlowIn, db: Session = Depends(get_db)):
    cf = CashFlow(flow_date=body.flow_date, amount=body.amount, description=body.description)
    db.add(cf)
    db.commit()
    repo.recompute_monthly_returns(db)
    db.commit()
    return {"id": cf.id}


@router.delete("/cash-flows/{cf_id}", dependencies=[Depends(require_admin)])
def delete_cash_flow(cf_id: int, db: Session = Depends(get_db)):
    cf = db.get(CashFlow, cf_id)
    if cf:
        db.delete(cf)
        db.commit()
        repo.recompute_monthly_returns(db)
        db.commit()
    return {"ok": True}


@router.get("/benchmarks", dependencies=[Depends(get_current_user)])
def list_benchmarks(db: Session = Depends(get_db)):
    return [
        {
            "period_year": b.period_year,
            "period_month": b.period_month,
            "composite_rate": float(b.composite_rate) if b.composite_rate is not None else None,
            "institutional_rate": float(b.institutional_rate)
            if b.institutional_rate is not None
            else None,
        }
        for b in db.execute(
            select(Benchmark).order_by(Benchmark.period_year, Benchmark.period_month)
        ).scalars()
    ]


@router.put("/benchmarks", dependencies=[Depends(require_admin)])
def upsert_benchmark(body: BenchmarkIn, db: Session = Depends(get_db)):
    b = db.execute(
        select(Benchmark).where(
            Benchmark.period_year == body.period_year,
            Benchmark.period_month == body.period_month,
        )
    ).scalar_one_or_none() or Benchmark(
        period_year=body.period_year, period_month=body.period_month
    )
    b.composite_rate = body.composite_rate
    b.institutional_rate = body.institutional_rate
    db.add(b)
    db.commit()
    repo.recompute_monthly_returns(db)
    db.commit()
    return {"ok": True}
