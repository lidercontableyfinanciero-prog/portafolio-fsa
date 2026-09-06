#!/usr/bin/env sh
set -e

echo "[entrypoint] alembic upgrade head"
alembic upgrade head

if [ "${RUN_SEED:-0}" = "1" ]; then
  echo "[entrypoint] RUN_SEED=1 -> python -m app.db.seed"
  python -m app.db.seed || echo "[entrypoint] seed omitido (sin datos fuente)"
fi

echo "[entrypoint] starting uvicorn on :${PORT:-8000}"
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --proxy-headers \
  --forwarded-allow-ips="*" \
  --workers "${WEB_CONCURRENCY:-2}"
