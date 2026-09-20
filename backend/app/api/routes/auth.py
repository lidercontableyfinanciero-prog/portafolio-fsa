from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, Token, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
) -> Token:
    # OAuth2PasswordRequestForm expone el campo como 'username': aquí es el
    # nombre de usuario ("ADMIN_FSA"...), ya no un correo electrónico.
    # Se tolera espacios accidentales y diferencia de mayúsculas al escribirlo.
    username = form_data.username.strip().upper()
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inactivo")
    token = create_access_token(subject=user.username, role=user.role.value)
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Cambio de contraseña propia — disponible para admin y lector por igual
    (módulo Seguridad/Privacidad)."""
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="La contraseña actual no es correcta.")
    if len(body.new_password) < 6:
        raise HTTPException(
            status_code=400, detail="La nueva contraseña debe tener al menos 6 caracteres."
        )
    user.hashed_password = hash_password(body.new_password)
    db.add(user)
    db.commit()
    return {"message": "Contraseña actualizada correctamente."}
