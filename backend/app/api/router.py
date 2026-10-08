from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import require_international
from app.api.routes import (
    auth,
    data_admin,
    etl,
    export,
    fx,
    national,
    parameters,
    portfolio,
    positions,
    returns,
    scenarios,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)

# Portafolio Internacional: todas sus rutas exigen el permiso del módulo.
_intl = [Depends(require_international)]
for r in (
    portfolio.router, positions.router, returns.router, scenarios.router, fx.router,
    parameters.router, etl.router, data_admin.router, export.router,
):
    api_router.include_router(r, dependencies=_intl)

# Portafolio Nacional (el router aplica `require_national`).
api_router.include_router(national.router)
