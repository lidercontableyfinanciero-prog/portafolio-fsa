#!/usr/bin/env sh
set -e

# Migraciones + seed base UNA sola vez, antes de levantar los workers (cada
# worker repetía antes este trabajo en su lifespan y alargaba el arranque en frío).
# Un fallo de la BD no debe impedir que la API arranque: queda en el log.
echo "[entrypoint] alembic upgrade head + init_db"
python - <<'PY' || echo "[entrypoint] (!) migraciones / init_db fallaron (ver traza)"
from app.main import _run_migrations
from app.db.seed import init_db
_run_migrations()
init_db()
PY

if [ "${RUN_SEED:-0}" = "1" ]; then
  echo "[entrypoint] RUN_SEED=1 -> python -m app.db.seed"
  python -m app.db.seed || echo "[entrypoint] seed omitido (sin datos fuente)"
fi

export RUN_STARTUP_TASKS=0
echo "[entrypoint] starting uvicorn on :${PORT:-8000}"
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --proxy-headers \
  --forwarded-allow-ips="*" \
  --workers "${WEB_CONCURRENCY:-1}"
