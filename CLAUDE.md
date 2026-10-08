# CLAUDE.md — Portafolio FSA

SPA de gestión y análisis de los portafolios de inversiones de la **Fundación San
Antonio**: **Internacional** (USD) y **Nacional** (COP), más **Seguridad**. Ingeniería
inversa de los libros Excel de `Referencias/`.

Rutas: `/` pantalla principal (módulos + marquesina) · `/internacional/*` ·
`/nacional/*` · `/seguridad`. Las URL antiguas (`/historico`, `/posiciones`…) redirigen.

## Arquitectura

- `backend/` — FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL. Auth JWT, roles `admin`/`lector`.
- `frontend/` — Next.js 14 (App Router, TS) + Tailwind + Recharts + TanStack Table + SWR + Framer Motion.
- `docs/` — diccionario de datos, lógica financiera (`FINANCIAL_LOGIC.md` internacional,
  `NATIONAL_LOGIC.md` nacional), tokens de diseño.
- **Permisos**: rol admin/lector + por usuario `can_upload`, `can_view_international`,
  `can_view_national`. Se validan en el backend (`deps.require_module`): todas las rutas
  internacionales exigen `international`, `/api/national/*` exige `national`.

## Portafolio Nacional
- Motor puro `services/national.py` (fuente única: dashboard, posiciones, alertas y
  reportes leen `GET /api/national/report`). Datos aislados en tablas `national_*`;
  parámetros con prefijo `nal_`; `ingestion_logs.portfolio = "national"`.
- Catálogo de activos, IPC y umbrales sembrados desde el Excel (`db/national_seed_data.py`),
  editables por el admin. Importador rechaza el archivo completo si hay errores.
- Cifras de referencia (corte ago‑2026): valor 8 710 191 750,48 · rent. E.A. 8,8426 % ·
  benchmark 10,294 % · 6 en riesgo / 2 seguimiento / 3 sobresalientes / 2 normales / 2 cerradas.

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
cd backend && .venv/Scripts/python.exe -m pytest -q          # 73 pruebas (unit + API + ETL + export + nacional + seguridad)
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
