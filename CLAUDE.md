# CLAUDE.md — Portafolio FSA

SPA de gestión y análisis del portafolio de inversiones internacionales de la
**Fundación San Antonio**. Ingeniería inversa de dos libros Excel (`Referencias/`).

## Arquitectura

- `backend/` — FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL. Auth JWT, roles `admin`/`lector`.
- `frontend/` — Next.js 14 (App Router, TS) + Tailwind + Recharts + TanStack Table + SWR + Framer Motion.
- `docs/` — diccionario de datos, lógica financiera, tokens de diseño.

## Reglas del dominio (no romper)

- **Fuente de verdad de la lógica financiera:** `backend/app/services/` (funciones puras)
  + `docs/FINANCIAL_LOGIC.md`. Cada regla está cubierta por `backend/tests/` cotejando
  contra valores del Excel. Si cambias una fórmula, actualiza doc + test.
- **Mark-to-Market:** `G/(P) = Valor de Mercado − Costo`. Excepción: Efectivo (sin costo) → 0.
- **Clave del hecho:** `(statement_year, statement_month, instrument_id, acquired_date)` —
  un CUSIP puede tener varios lotes en un mes. No colapsar.
- **ETL** (`services/etl.py`): lee la hoja `Base Datos` (NO `Hoja2`), descarta `Unnamed:*`
  y columnas vacías, mapea encabezados bilingües, sintetiza identificador para Efectivo/acciones
  sin CUSIP (usa la descripción, como el `VLOOKUP` del Excel).
- Cifras del dashboard deben coincidir con el SUMIFS del libro `DASHBOARD` (agosto-2026:
  costo 13 631 136,30 · valor 13 821 554,40 · 63 posiciones).

## Comandos

```bash
# backend
cd backend && .venv/Scripts/python.exe -m pytest -q          # 41 pruebas (unit + API + ETL + export)
cd backend && .venv/Scripts/python.exe scripts/smoke_pipeline.py   # E2E sin Postgres (SQLite)
cd backend && .venv/Scripts/python.exe -m uvicorn app.main:app --reload

# frontend
cd frontend && npx tsc --noEmit && npx next build
cd frontend && npm run dev

# stack completo
docker compose --profile full up --build
```

## Notas

- **PostgreSQL local**: servicio `postgresql-16` (Windows), superusuario `postgres`/`postgres`,
  rol de app `fsa`/`fsa`, base `portafolio_fsa`. `backend/.env` → `DATABASE_URL` ya apunta ahí.
  Binarios en `C:\Program Files\PostgreSQL\16\bin`.
- Migración `0001` usa `metadata.create_all` (greenfield). `0002_ingestion_logs` añade el
  histórico con `Table.create(checkfirst=True)` → idempotente sobre bases ya materializadas.
  Migraciones nuevas: `alembic revision --autogenerate`.
- **ETL / anti-duplicado**: `/api/etl/upload` rechaza (409) un mes ya cargado salvo
  `?replace=true` (que borra e reinserta). Todo queda en `ingestion_logs` / `GET /api/etl/history`.
- Benchmarks: el seed carga 6,793 % / 8,2 % anual por defecto; editables vía
  `PUT /api/data/benchmarks` (solo admin) → recalcula Dietz/TWR.
- Sin Python en el equipo original: se instaló 3.12 en `~/AppData/Local/Programs/Python/Python312`.
