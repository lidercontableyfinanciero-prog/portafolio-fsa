from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.user import UserRole


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str | None
    role: UserRole
    is_active: bool
    can_upload: bool

    model_config = {"from_attributes": True}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)
