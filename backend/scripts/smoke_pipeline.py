"""Prueba de humo end-to-end SIN PostgreSQL (usa SQLite en memoria).

Valida: ETL sobre el Excel real -> upsert -> recálculo Dietz/TWR -> dashboard.
Uso:  .venv/Scripts/python.exe scripts/smoke_pipeline.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "smoke-test")

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

import app.core.database as database  # noqa: E402

# Motor SQLite compartido en memoria
engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
database.engine = engine
database.SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

import app.models  # noqa: E402,F401
from app.core.config import settings  # noqa: E402
from app.services import portfolio_repo as repo  # noqa: E402
from app.services.aggregations import build_dashboard  # noqa: E402
from app.services.etl import parse_upload  # noqa: E402
from app.services.twr import MonthlyReturnInput, time_weighted_return  # noqa: E402

database.Base.metadata.create_all(bind=engine)

xlsx = settings.seed_dir_path / settings.seed_informe_file
if not xlsx.exists():
    raise SystemExit(f"No se encontró el Excel: {xlsx}")

print(f"[1] ETL  {xlsx.name}")
parsed = parse_upload(xlsx.read_bytes(), xlsx.name)
print(f"    filas OK: {parsed.ok_rows} / {parsed.total_rows}  · errores: {len(parsed.errors)}")
print(f"    columnas detectadas: {len(parsed.detected_columns)}  · ignoradas: {len(parsed.ignored_columns)}")
assert parsed.ok_rows > 400, "muy pocas filas parseadas"

db = database.SessionLocal()
counts = repo.upsert_parsed_rows(db, parsed.rows)
db.commit()
print(f"[2] Upsert  {counts}")

periods = repo.list_periods(db)
print(f"[3] Períodos: {[p.label for p in periods]}")
last = periods[-1]

metrics = repo.load_metrics(db, last.year, last.month)
dash = build_dashboard(metrics)
k = dash.kpis
print(f"[4] Dashboard {last.label}")
print(f"    Costo Total.......... {k.costo_total:,.2f}")
print(f"    Valor de Mercado..... {k.valor_mercado:,.2f}")
print(f"    G/(P) No Realizada... {k.gp_no_realizada:,.2f}")
print(f"    Rentab. s/ Costo..... {k.rentab_sobre_costo:.4%}")
print(f"    N° Posiciones........ {k.n_posiciones}")
print(f"    por clasificación:  " + ", ".join(f"{r.label}={r.valor_mercado:,.0f}" for r in dash.por_clasificacion))

n = repo.recompute_monthly_returns(db)
print(f"[5] Rentabilidades mensuales (Dietz): {n}")
series = repo.monthly_portfolio_values(db)
for b in series:
    print(f"    {b['label']}: valor_informe={b['valor_informe']:,.2f}")

from app.models.monthly_return import MonthlyReturn  # noqa: E402

mrs = db.query(MonthlyReturn).order_by(MonthlyReturn.period_year, MonthlyReturn.period_month).all()
twr = time_weighted_return(
    [MonthlyReturnInput(m.period_year, m.period_month, float(m.dietz_return) if m.dietz_return is not None else None) for m in mrs]
)
print(f"[6] TWR acumulado: {twr.cumulative_twr:.4%}")
for row in twr.rows:
    r = f"{row.portfolio_return:.4%}" if row.portfolio_return is not None else "—"
    print(f"    {row.month_name} {row.year}: R={r}  acum={row.cumulative_twr:.4%}" if row.cumulative_twr is not None else f"    {row.month_name} {row.year}: R={r}")

# Comprobación FastAPI: la app importa y expone rutas
from app.main import app as fastapi_app  # noqa: E402

routes = [r.path for r in fastapi_app.routes]
assert "/api/portfolio/dashboard" in routes and "/api/scenarios" in routes
print(f"[7] FastAPI OK — {len(routes)} rutas registradas")
print("\nSMOKE OK")
