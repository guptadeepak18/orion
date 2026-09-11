from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, ConfigDict


import re
from pydantic import field_validator
from app.core.security import validate_password_policy


def clean_auth_identifier(v: str) -> str:
    if not v or not str(v).strip():
        raise ValueError("Email, PRN, or registered mobile number is required.")
    return re.sub(r"[\u200B-\u200D\uFEFF\u00A0\s]+", "", str(v)).strip()


class LoginRequest(BaseModel):
    email: str  # Official email, personal email, PRN, or mobile
    password: str

    @field_validator("email")
    @classmethod
    def sanitize_identifier(cls, v: str) -> str:
        return clean_auth_identifier(v)


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class RoleResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class UserSummary(BaseModel):
    id: UUID
    email: str
    full_name: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    roles: List[str]

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserSummary


class ForgotPasswordRequest(BaseModel):
    email: str  # Official email, personal email, PRN, or mobile

    @field_validator("email")
    @classmethod
    def sanitize_identifier(cls, v: str) -> str:
        return clean_auth_identifier(v)


class ForgotPasswordVerifyRequest(BaseModel):
    email: str
    code: str

    @field_validator("email")
    @classmethod
    def sanitize_identifier(cls, v: str) -> str:
        return clean_auth_identifier(v)


class ForgotPasswordResetRequest(BaseModel):
    email: str
    code: str
    new_password: str

    @field_validator("email")
    @classmethod
    def sanitize_identifier(cls, v: str) -> str:
        return clean_auth_identifier(v)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return validate_password_policy(v)


class ChangePasswordConfirmRequest(BaseModel):
    code: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return validate_password_policy(v)


