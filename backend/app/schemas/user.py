from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, ConfigDict
from app.schemas.auth import RoleResponse


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    role_names: List[str]


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    role_names: Optional[List[str]] = None


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    is_active: bool
    roles: List[RoleResponse]

    model_config = ConfigDict(from_attributes=True)
