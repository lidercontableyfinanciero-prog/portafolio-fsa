# Despliegue a la nube

Dos servicios web (API FastAPI + SPA Next.js) y una base PostgreSQL 16.

| Archivo | Para qué |
|---|---|
| `render.yaml` | Blueprint de **Render**: BD + API + SPA en un clic |
| `frontend/vercel.json` | Desplegar la **SPA en Vercel** (API en otro host) |
| `backend/Dockerfile` + `backend/entrypoint.sh` | Imagen de la API (migra y arranca) |
| `frontend/Dockerfile` | Imagen de la SPA (`next build` → `standalone`) |
| `backend/Procfile` | Railway / Heroku-style (`web:` + `release:`) |
| `docker-compose.yml` (`--profile full`) | Stack completo local |
| `*/.env.production.example` | Variables requeridas |

## Variables de entorno

### Backend
| Var | Ejemplo | Nota |
|---|---|---|
| `DATABASE_URL` | `postgresql://u:p@host:5432/portafolio_fsa` | Se normaliza a `postgresql+psycopg://` automáticamente (`config.py`) |
| `SECRET_KEY` | *(48 bytes aleatorios)* | `python -c "import secrets;print(secrets.token_urlsafe(48))"` |
| `BACKEND_CORS_ORIGINS` | `["https://web.example.com"]` | JSON array con el/los dominios del frontend |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | |
| `RUN_SEED` | `0` | `1` sólo si montas `Referencias/` en `/app/seed_data` |
| `WEB_CONCURRENCY` | `2` | procesos uvicorn |

### Frontend
| Var | Ejemplo |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.example.com` (URL pública de la API) |

El navegador siempre llama a rutas relativas `/api/*`; Next las reescribe
server-side hacia `NEXT_PUBLIC_API_URL` (`next.config.mjs`). Debe estar
disponible **en build y en runtime**.

## Opción A — Render (un blueprint)

1. Sube el repo a GitHub.
2. En Render: **New → Blueprint** → selecciona el repo. Detecta `render.yaml`.
3. Tras el primer deploy, ajusta:
   - API → `BACKEND_CORS_ORIGINS` con la URL real de `portafolio-fsa-web`.
   - Web → `NEXT_PUBLIC_API_URL` con la URL real de `portafolio-fsa-api` y **redeploy**
     (es build-time).
4. Crear el usuario admin y cargar datos:
   - Opción 1: `Shell` del servicio API → `python -m app.db.seed`
     (requiere los Excel; súbelos a `/app/seed_data` o usa la carga por la UI).
   - Opción 2: entra a la SPA como admin y usa **Datos → Cargar extracto**.
     (Primero crea los usuarios: `Shell` → `python -m app.db.seed` sin los Excel
     igual crea `admin`/`lector` y parámetros.)

## Opción B — Vercel (SPA) + Render/Fly/Railway (API + BD)

1. **API + BD** en Render (servicio `web` docker + Postgres) o Railway (`Procfile`).
2. **SPA** en Vercel: importa `frontend/`, framework Next.js detectado.
   Configura `NEXT_PUBLIC_API_URL` = URL de la API. Deploy.
3. En la API, `BACKEND_CORS_ORIGINS` = URL de Vercel.

## Opción C — Docker Compose (VPS)

```bash
cp backend/.env.production.example backend/.env      # editar
cp frontend/.env.production.example frontend/.env    # editar NEXT_PUBLIC_API_URL
docker compose --profile full up -d --build
```

Migraciones: el `entrypoint.sh` corre `alembic upgrade head` en cada arranque.

## Checklist de producción

- [ ] `SECRET_KEY` aleatorio y largo (no el de ejemplo).
- [ ] `DEBUG=false`.
- [ ] `BACKEND_CORS_ORIGINS` sólo con los dominios reales.
- [ ] Cambiar las contraseñas de `admin` / `lector` del seed.
- [ ] HTTPS gestionado por la plataforma (uvicorn corre con `--proxy-headers`).
- [ ] Backups automáticos de PostgreSQL activados en el proveedor.
