# Despliegue a la nube — arquitectura híbrida

| Componente | Plataforma | Config |
|---|---|---|
| Front-End (Next.js) | **Vercel** | `frontend/vercel.json` |
| Back-End (FastAPI) | **Render** (Web Service · Docker) | `render.yaml` → `backend/Dockerfile` + `backend/entrypoint.sh` |
| Base de datos | **Render** (PostgreSQL 16) | `render.yaml` (`databases:`) |

Otros archivos: `backend/Procfile` (Railway/Heroku), `docker-compose.yml --profile full`
(stack local), `*/.env.production.example` (plantillas de variables).

---

## Flujo de comunicación

```
navegador ──/api/*──▶  Vercel (Next.js)  ──rewrite server-side──▶  Render (API FastAPI)  ──▶  Render (PostgreSQL)
```

- El navegador **nunca** llama a la API directamente: usa rutas relativas `/api/*`.
- Next.js las reescribe en el servidor hacia `NEXT_PUBLIC_API_URL` (`next.config.mjs`).
- La API solo acepta peticiones cuyo `Origin` esté en `BACKEND_CORS_ORIGINS`.
- Por eso las dos variables cruzadas deben apuntarse mutuamente:
  `NEXT_PUBLIC_API_URL` = URL de Render · `BACKEND_CORS_ORIGINS` = URL de Vercel.

---

## Paso a paso

### 1 · PostgreSQL + API en Render (Blueprint)

1. **New → Blueprint** → conecta el repo `portafolio-fsa`. Render detecta `render.yaml`
   y crea `portafolio-fsa-db` (Postgres) + `portafolio-fsa-api` (Docker).
2. `DATABASE_URL` se enlaza sola desde la BD; `SECRET_KEY` la genera Render.
3. Deja `BACKEND_CORS_ORIGINS` con el placeholder por ahora; lo ajustas en el paso 3.
4. Espera a que el deploy termine y `GET /health` responda `{"status":"ok"}`.
   Anota la URL, p. ej. `https://portafolio-fsa-api.onrender.com`.
5. Crea los usuarios y parámetros: en el servicio API → **Shell** →
   `python -m app.db.seed`
   (sin los Excel montados igualmente crea `admin` / `lector` y los parámetros;
   los datos del portafolio se cargan luego desde la propia app en **Importar**).

### 2 · Front-End en Vercel

1. **Add New → Project** → importa el repo. Framework: **Next.js** (autodetectado).
   Root Directory: **`frontend`**.
2. En **Settings → Environment Variables** añade `NEXT_PUBLIC_API_URL` con la URL de
   Render del paso 1 (para *Production*, *Preview* y *Development*).
3. **Deploy**. Anota la URL, p. ej. `https://portafolio-fsa.vercel.app`.

### 3 · Enlazar los dos (CORS)

1. En Render → servicio API → **Environment** → edita `BACKEND_CORS_ORIGINS` con la
   URL real de Vercel: `["https://portafolio-fsa.vercel.app"]`
   (añade también el dominio de previews si los usas).
2. Guarda → Render redeploya la API.
3. Entra a la URL de Vercel, inicia sesión con `admin@fundacionsanantonio.org`
   y carga el Excel en **Importar**.

---

## Variables de entorno

Ver el resumen exacto para copiar/pegar en `docs/DEPLOY.md` no; está más abajo en la
respuesta del asistente. Plantillas versionadas: `backend/.env.production.example` y
`frontend/.env.production.example`.

| Servicio | Variable | Valor |
|---|---|---|
| Render · API | `DATABASE_URL` | *(enlazada por el blueprint)* |
| Render · API | `SECRET_KEY` | *(generada por Render)* |
| Render · API | `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` |
| Render · API | `DEBUG` | `false` |
| Render · API | `BACKEND_CORS_ORIGINS` | `["https://<tu-app>.vercel.app"]` |
| Render · API | `RUN_SEED` | `0` |
| Render · API | `WEB_CONCURRENCY` | `2` |
| Vercel · Web | `NEXT_PUBLIC_API_URL` | `https://<tu-api>.onrender.com` |

`DATABASE_URL` de Render llega como `postgresql://…`; `app/core/config.py` la
normaliza a `postgresql+psycopg://…` automáticamente.

---

## Checklist de producción

- [ ] `SECRET_KEY` aleatorio y largo (Render lo genera; si lo pones a mano, ≥ 32 bytes).
- [ ] `DEBUG=false`.
- [ ] `BACKEND_CORS_ORIGINS` solo con los dominios reales de Vercel.
- [ ] `NEXT_PUBLIC_API_URL` definida en Vercel para *Production* **y** *Preview*.
- [ ] Cambiar las contraseñas de `admin` / `lector` tras el primer login.
- [ ] HTTPS lo gestionan Vercel y Render (uvicorn corre con `--proxy-headers`).
- [ ] Activar backups automáticos de la BD en Render (plan de pago).
- [ ] El plan *free* de Render duerme el servicio tras inactividad: la 1.ª petición
      tras el reposo tarda ~30 s (cold start).

## Alternativa: todo en Render

`render.yaml` puede incluir también el servicio web del frontend (Docker,
`frontend/Dockerfile`). No es la arquitectura elegida, pero si se quisiera:
añadir un `- type: web` con `NEXT_PUBLIC_API_URL` apuntando a la API interna.
