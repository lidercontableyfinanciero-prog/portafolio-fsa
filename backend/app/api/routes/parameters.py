from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db
from app.models.parameter import Parameter, RatingScale, SectorLimit

router = APIRouter(prefix="/parameters", tags=["parameters"])


class ParameterIn(BaseModel):
    value_numeric: float | None = None
    value_text: str | None = None
    description: str | None = None


@router.get("", dependencies=[Depends(get_current_user)])
def list_parameters(db: Session = Depends(get_db)):
    # Los parámetros "nal_*" pertenecen al Portafolio Nacional (rutas /national).
    params = db.execute(
        select(Parameter).where(~Parameter.key.startswith("nal_"))
    ).scalars().all()
    ratings = db.execute(select(RatingScale).order_by(RatingScale.scale_1_7)).scalars().all()
    sectors = db.execute(select(SectorLimit)).scalars().all()
    return {
        "parameters": [
            {
                "key": p.key,
                "value_numeric": float(p.value_numeric) if p.value_numeric is not None else None,
                "value_text": p.value_text,
                "description": p.description,
            }
            for p in params
        ],
        "rating_scale": [
            {
                "fitch": r.fitch, "sp": r.sp, "moodys": r.moodys,
                "grade": r.grade, "description": r.description, "scale": r.scale_1_7,
            }
            for r in ratings
        ],
        "sector_limits": [
            {"sector": s.sector, "limit_value": float(s.limit_value)} for s in sectors
        ],
    }


@router.put("/{key}", dependencies=[Depends(require_admin)])
def upsert_parameter(key: str, body: ParameterIn, db: Session = Depends(get_db)):
    if key.startswith("nal_"):
        raise HTTPException(status_code=400, detail="Use /national/parameters para este parámetro.")
    param = db.get(Parameter, key) or Parameter(key=key)
    param.value_numeric = body.value_numeric
    param.value_text = body.value_text
    if body.description is not None:
        param.description = body.description
    db.add(param)
    db.commit()
    return {"ok": True, "key": key}
