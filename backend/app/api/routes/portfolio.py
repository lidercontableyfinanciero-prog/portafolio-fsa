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


@router.get("/historical")
def historical(db: Session = Depends(get_db)):
    """Análisis horizontal: métricas en filas, meses en columnas (consecutivas)."""
    from app.models.monthly_return import MonthlyReturn
    from app.services.twr import MonthlyReturnInput, time_weighted_return

    series = repo.monthly_portfolio_values(db)  # ya viene ordenado cronológicamente
    periods = [
        {
            "year": b["year"],
            "month": b["month"],
            "month_index": b["month_index"],
            "label": b["label"],
        }
        for b in series
    ]

    # Dietz / TWR por período
    mrs = {
        (m.period_year, m.period_month): m
        for m in db.query(MonthlyReturn).all()
    }
    twr_inputs = [
        MonthlyReturnInput(
            year=b["year"],
            month=b["month_index"],
            portfolio_return=(
                float(mrs[(b["year"], b["month_index"])].dietz_return)
                if (b["year"], b["month_index"]) in mrs
                and mrs[(b["year"], b["month_index"])].dietz_return is not None
                else None
            ),
        )
        for b in series
    ]
    twr = {(r.year, r.month): r for r in time_weighted_return(twr_inputs).rows}

    def col(getter):
        return [getter(i, b) for i, b in enumerate(series)]

    prev_vi = [None] + [series[i - 1]["valor_informe"] for i in range(1, len(series))]

    rows = [
        {"key": "valor_mercado", "label": "Valor de Mercado", "kind": "money",
         "values": col(lambda i, b: b["valor_mercado"])},
        {"key": "costo", "label": "Costo", "kind": "money",
         "values": col(lambda i, b: b["costo"])},
        {"key": "valor_informe", "label": "Total del portafolio (Valor Informe)",
         "kind": "money", "values": col(lambda i, b: b["valor_informe"])},
        {"key": "gp_no_realizada", "label": "Ganancia/(Pérdida) no realizada",
         "kind": "money", "values": col(lambda i, b: b["gp_no_realizada"])},
        {"key": "rentab_sobre_costo", "label": "Rentabilidad s/ Costo", "kind": "pct",
         "values": col(lambda i, b: b["rentab_sobre_costo"])},
        {"key": "dietz", "label": "Rentabilidad del mes (Dietz)", "kind": "pct",
         "values": col(
             lambda i, b: (
                 twr[(b["year"], b["month_index"])].portfolio_return
                 if (b["year"], b["month_index"]) in twr
                 else None
             )
         )},
        {"key": "twr_acumulado", "label": "Rentabilidad acumulada (TWR)", "kind": "pct",
         "values": col(
             lambda i, b: (
                 twr[(b["year"], b["month_index"])].cumulative_twr
                 if (b["year"], b["month_index"]) in twr
                 else None
             )
         )},
        {"key": "variacion_abs", "label": "Variación vs mes anterior", "kind": "money",
         "values": col(
             lambda i, b: None if prev_vi[i] is None else b["valor_informe"] - prev_vi[i]
         )},
        {"key": "variacion_pct", "label": "Variación % vs mes anterior", "kind": "pct",
         "values": col(
             lambda i, b: (
                 None
                 if not prev_vi[i]
                 else (b["valor_informe"] - prev_vi[i]) / prev_vi[i]
             )
         )},
    ]
    return {"periods": periods, "rows": rows}
