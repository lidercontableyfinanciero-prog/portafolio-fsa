# Portafolio FSA — Plataforma de Inversiones Internacionales

SPA para gestión y análisis del portafolio de inversiones internacionales de la
**Fundación San Antonio (FSA)**. Ingeniería inversa de los libros Excel
`INFORME` y `DASHBOARD INVERSIONES INTERNACIONALES FSA 2026`.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 (App Router, TS), Tailwind CSS, Framer Motion, TanStack Table, Recharts + Tremor |
| Backend | Python 3.11+ · FastAPI · SQLAlchemy 2 · Alembic · Pydantic v2 · pandas · numpy-financial |
| Base de datos | PostgreSQL 16 |
| Auth | JWT (OAuth2 password flow) · roles `admin` / `lector` |

## Estructura

```
Portafolio_App_FSA/
├── backend/          API FastAPI + motor financiero + ETL
├── frontend/         SPA Next.js
├── docs/             Diccionario de datos, lógica financiera, tokens de diseño
├── Referencias/      Archivos Excel fuente + manual de marca (no versionar)
└── docker-compose.yml
```

## Opción rápida: todo en Docker

```bash
docker compose --profile full up --build
```

Levanta PostgreSQL + API (`:8000`, migra y siembra sola) + SPA (`:3000`).

## Puesta en marcha (desarrollo)

### 1. Base de datos

```bash
docker compose up -d db
```

Levanta PostgreSQL en `localhost:5432` (db `portafolio_fsa`, user `fsa`, pass `fsa`).

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env             # ajustar si hace falta
pytest                            # 48 pruebas (motor + API + ETL + export) vs. el Excel
alembic upgrade head              # crea el esquema
python -m app.db.seed             # carga usuarios + datos de los Excel de Referencias/
uvicorn app.main:app --reload     # http://localhost:8000  (docs: /docs)
```

### Validación end-to-end sin PostgreSQL

```bash
python scripts/smoke_pipeline.py   # ETL del Excel real -> dashboard -> Dietz/TWR (SQLite en memoria)
```

### 3. Frontend

```bash
cd frontend
npm install
copy .env.local.example .env.local
npm run dev                        # http://localhost:3000
```

## Usuarios semilla

| Email | Contraseña | Rol |
|---|---|---|
| `admin@fundacionsanantonio.org` | `admin123` | `admin` (ve carga de CSV/Excel) |
| `lector@fundacionsanantonio.org` | `lector123` | `lector` (solo visualización) |

> Cambiar las contraseñas semilla antes de cualquier despliegue.

## Documentación

- [`docs/DATA_DICTIONARY.md`](docs/DATA_DICTIONARY.md) — modelo de datos y mapeo de columnas del Excel.
- [`docs/FINANCIAL_LOGIC.md`](docs/FINANCIAL_LOGIC.md) — fórmulas: Mark-to-Market, Dietz Modificado, TWR, escenarios, FX.
- [`docs/DESIGN_TOKENS.md`](docs/DESIGN_TOKENS.md) — paleta y tipografía FSA (modo light).
