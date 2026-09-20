"""Gestión de usuarios (Seguridad / Privacidad) — solo admin.

Nombre visible (full_name) y permiso de carga (can_upload) por usuario.
El cambio de contraseña propia vive en `auth.change_password` porque lo usan
ambos roles, no solo el admin.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import UserOut

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(require_admin)])


class UserUpdate(BaseModel):
    full_name: str | None = None
    can_upload: bool | None = None


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.execute(select(User).order_by(User.role, User.username)).scalars().all()


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, body: UserUpdate, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    if body.full_name is not None:
        name = body.full_name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="El nombre visible no puede quedar vacío.")
        user.full_name = name
    if body.can_upload is not None:
        user.can_upload = body.can_upload
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
