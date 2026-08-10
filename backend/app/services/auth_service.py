from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.schemas.auth import LoginRequest, TokenResponse, UserSummary
from app.services.user_service import get_user_by_email, get_user_by_id


async def authenticate_user(
    db: AsyncSession, login_data: LoginRequest
) -> Optional[TokenResponse]:
    user = await get_user_by_email(db, login_data.email)
    if not user or not user.is_active:
        return None

    if not verify_password(login_data.password, user.password_hash):
        return None

    role_names = [role.name for role in user.roles]
    access_token = create_access_token(subject=user.id, roles=role_names)
    refresh_token = create_refresh_token(subject=user.id)

    user_summary = UserSummary(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        is_active=user.is_active,
        roles=role_names,
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=user_summary,
    )


async def refresh_access_token(
    db: AsyncSession, refresh_token: str
) -> Optional[TokenResponse]:
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        return None

    user_id_str = payload.get("sub")
    if not user_id_str:
        return None

    user = await get_user_by_id(db, user_id_str)
    if not user or not user.is_active:
        return None

    role_names = [role.name for role in user.roles]
    new_access_token = create_access_token(subject=user.id, roles=role_names)
    new_refresh_token = create_refresh_token(subject=user.id)

    user_summary = UserSummary(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        is_active=user.is_active,
        roles=role_names,
    )

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        user=user_summary,
    )
