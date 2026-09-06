from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.schemas.analytics import FxRequest
from app.services.fx_simulator import FxInput, sensitivity, simulate_fx

router = APIRouter(prefix="/fx-simulator", tags=["fx"], dependencies=[Depends(get_current_user)])


@router.post("")
def run_fx(req: FxRequest):
    data = FxInput(
        quantity=req.quantity,
        gross_sale_usd=req.gross_sale_usd,
        sale_commission_usd=req.sale_commission_usd,
        purchase_cost_usd=req.purchase_cost_usd,
        purchase_date=req.purchase_date,
        sale_date=req.sale_date,
        trm_purchase=req.trm_purchase,
        trm_sale=req.trm_sale,
        trm_close=req.trm_close,
    )
    result = asdict(simulate_fx(data))

    curve = None
    if req.sensitivity_from is not None and req.sensitivity_to is not None:
        curve = [
            asdict(p)
            for p in sensitivity(
                data, req.sensitivity_from, req.sensitivity_to, req.sensitivity_steps
            )
        ]
    return {"result": result, "sensitivity": curve}
