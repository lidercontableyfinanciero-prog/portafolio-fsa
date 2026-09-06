from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import (
    auth,
    data_admin,
    etl,
    export,
    fx,
    parameters,
    portfolio,
    positions,
    returns,
    scenarios,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(portfolio.router)
api_router.include_router(positions.router)
api_router.include_router(returns.router)
api_router.include_router(scenarios.router)
api_router.include_router(fx.router)
api_router.include_router(parameters.router)
api_router.include_router(etl.router)
api_router.include_router(data_admin.router)
api_router.include_router(export.router)
