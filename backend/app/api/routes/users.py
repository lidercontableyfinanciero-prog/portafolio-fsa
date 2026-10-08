"""Gestión de usuarios (Seguridad) — solo admin, validado en el backend.

Crear usuarios, nombre visible, rol, estado (activo/inactivo), permiso de carga,
módulos que puede consultar (perfil de acceso) y restablecer contraseñas.
El cambio de contraseña propia vive en `auth.change_password` porque lo usan
ambos roles, no solo el admin.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.database import get_db
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.schemas.auth import UserOut

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(require_admin)])

_MIN_PASSWORD = 6


class UserUpdate(BaseModel):
    full_name: str | None = None
    can_upload: bool | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    can_view_international: bool | None = None
    can_view_national: bool | None = None


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    full_name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=_MIN_PASSWORD)
    role: UserRole = UserRole.lector
    can_upload: bool = False
    can_view_international: bool = True
    can_view_national: bool = True


class PasswordReset(BaseModel):
    new_password: str = Field(min_length=_MIN_PASSWORD)


def _active_admins(db: Session) -> int:
    return len(db.execute(
        select(User.id).where(User.role == UserRole.admin, User.is_active.is_(True))
    ).all())


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.execute(select(User).order_by(User.role, User.username)).scalars().all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(body: UserCreate, db: Session = Depends(get_db)):
    username = body.username.strip().upper()
    if not username.replace("_", "").replace(".", "").replace("-", "").isalnum():
        raise HTTPException(
            status_code=400,
            detail="El usuario solo puede contener letras, números, guion, punto o guion bajo.",
        )
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=409, detail=f"El usuario {username} ya existe.")
    user = User(
        username=username,
        full_name=body.full_name.strip(),
        hashed_password=hash_password(body.password),
        role=body.role,
        is_active=True,
        can_upload=body.can_upload,
        can_view_international=body.can_view_international,
        can_view_national=body.can_view_national,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(require_admin),
):
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
    if body.can_view_international is not None:
        user.can_view_international = body.can_view_international
    if body.can_view_national is not None:
        user.can_view_national = body.can_view_national

    demote = body.role is not None and body.role != UserRole.admin and user.role == UserRole.admin
    deactivate = body.is_active is False and user.is_active
    if (demote or deactivate) and user.id == me.id:
        raise HTTPException(
            status_code=400,
            detail="No puedes quitarte el rol de administrador ni desactivar tu propia cuenta.",
        )
    if (demote or deactivate) and user.role == UserRole.admin and _active_admins(db) <= 1:
        raise HTTPException(
            status_code=400, detail="Debe existir al menos un administrador activo."
        )
    if body.role is not None:
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/reset-password")
def reset_password(user_id: int, body: PasswordReset, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    user.hashed_password = hash_password(body.new_password)
    db.add(user)
    db.commit()
    return {"message": f"Contraseña de {user.username} restablecida."}
