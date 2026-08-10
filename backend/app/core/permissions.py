from typing import List, Callable, Dict
from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_token
from app.models.auth import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

ROLE_PERMISSIONS: Dict[str, Dict[str, str]] = {
    "crc_admin": {
        "academic": "full",
        "faculty": "full",
        "remuneration": "full",
        "invoice": "full",
        "approvals": "full",
        "reporting": "full",
        "students": "full",
    },
    "crc_coordinator": {
        "academic": "edit",
        "faculty": "edit",
        "remuneration": "edit",
        "invoice": "view",
        "approvals": "initiate",
        "reporting": "view",
        "students": "edit",
    },
    "faculty_internal": {
        "academic": "view_own",
        "faculty": "edit_own",
        "remuneration": "view_own",
        "invoice": "none",
        "approvals": "none",
        "reporting": "view_own",
        "students": "view",
    },
    "faculty_external": {
        "academic": "view_own",
        "faculty": "edit_own",
        "remuneration": "view_own",
        "invoice": "submit",
        "approvals": "none",
        "reporting": "view_own",
        "students": "view",
    },
    "finance": {
        "academic": "view",
        "faculty": "view",
        "remuneration": "edit",
        "invoice": "edit",
        "approvals": "approve",
        "reporting": "view",
        "students": "view",
    },
    "approver": {
        "academic": "view",
        "faculty": "view",
        "remuneration": "view",
        "invoice": "view",
        "approvals": "approve",
        "reporting": "view",
        "students": "view",
    },
    "reporting_readonly": {
        "academic": "view",
        "faculty": "view",
        "remuneration": "view",
        "invoice": "view",
        "approvals": "none",
        "reporting": "view",
        "students": "view",
    },
    "student": {
        "academic": "view_own",
        "faculty": "view",
        "remuneration": "none",
        "invoice": "none",
        "approvals": "none",
        "reporting": "view_own",
        "students": "view_own",
    },
}

PERMISSION_LEVELS = {
    "none": 0,
    "view_own": 1,
    "view": 2,
    "initiate": 3,
    "submit": 3,
    "edit_own": 4,
    "edit": 5,
    "approve": 6,
    "full": 7,
}


async def get_current_token_payload(token: str = Depends(oauth2_scheme)) -> dict:
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials or token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


async def get_current_user_roles(
    payload: dict = Depends(get_current_token_payload)
) -> List[str]:
    roles = payload.get("roles", [])
    if not roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User has no assigned roles",
        )
    return roles


async def get_current_user(
    payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
) -> User:
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")
    stmt = select(User).where(User.id == UUID(user_id))
    res = await db.execute(stmt)
    user = res.unique().scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def require_role(allowed_roles: List[str]) -> Callable:
    async def role_checker(roles: List[str] = Depends(get_current_user_roles)):
        if "crc_admin" in roles:
            return True
        if not any(r in allowed_roles for r in roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Required roles: {allowed_roles}",
            )
        return True

    return role_checker


def require_permission(module: str, required_level: str) -> Callable:
    async def permission_checker(roles: List[str] = Depends(get_current_user_roles)):
        req_numeric = PERMISSION_LEVELS.get(required_level, 0)
        has_permission = False

        for role in roles:
            if role == "crc_admin":
                has_permission = True
                break
            
            user_level_str = ROLE_PERMISSIONS.get(role, {}).get(module, "none")
            user_numeric = PERMISSION_LEVELS.get(user_level_str, 0)
            
            if user_numeric >= req_numeric:
                has_permission = True
                break

        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions for module '{module}'. Required level: {required_level}",
            )
        return True

    return permission_checker
