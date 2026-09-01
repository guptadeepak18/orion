from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_role
from app.schemas.common import ResponseEnvelope
from app.schemas.auth import RoleResponse
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserStatusUpdate,
    ResetPasswordRequest,
)
from app.services import user_service

router = APIRouter(prefix="/users", tags=["Users"])


@router.get(
    "/roles",
    response_model=ResponseEnvelope[List[RoleResponse]],
    dependencies=[Depends(require_role(["crc_admin"]))],
)
async def get_system_roles(db: AsyncSession = Depends(get_db)):
    """Fetch all defined roles in the system."""
    roles = await user_service.list_roles(db)
    return ResponseEnvelope(data=[RoleResponse.model_validate(r) for r in roles])


@router.get(
    "",
    response_model=ResponseEnvelope[List[UserResponse]],
    dependencies=[Depends(require_role(["crc_admin"]))],
)
async def list_user_directory(
    search: Optional[str] = Query(None, description="Search by name, email, or phone"),
    role: Optional[str] = Query(None, description="Filter by role name"),
    status: Optional[str] = Query(None, description="Filter by status: active, inactive"),
    include_all: bool = Query(False, description="Include students and faculty in the directory"),
    db: AsyncSession = Depends(get_db),
):
    """
    User Directory — Lists non-student & non-faculty system users (admins, coordinators, finance, approvers).
    Set include_all=true to include students and faculty.
    """
    users = await user_service.list_users(
        db,
        search=search,
        role_filter=role,
        status_filter=status,
        exclude_students_faculty=not include_all,
    )
    return ResponseEnvelope(data=[UserResponse.model_validate(u) for u in users])


@router.post(
    "",
    response_model=ResponseEnvelope[UserResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(["crc_admin"]))],
)
async def create_new_user(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    """Create a new system user and assign roles."""
    try:
        user = await user_service.create_user(db, user_in)
        return ResponseEnvelope(data=UserResponse.model_validate(user))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/{user_id}",
    response_model=ResponseEnvelope[UserResponse],
    dependencies=[Depends(require_role(["crc_admin"]))],
)
async def get_user_details(user_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get single user profile and assigned roles."""
    user = await user_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return ResponseEnvelope(data=UserResponse.model_validate(user))


@router.put(
    "/{user_id}",
    response_model=ResponseEnvelope[UserResponse],
    dependencies=[Depends(require_role(["crc_admin"]))],
)
async def update_user_profile(
    user_id: UUID, data: UserUpdate, db: AsyncSession = Depends(get_db)
):
    """Update user profile details, active status, and role assignments."""
    try:
        user = await user_service.update_user(db, user_id, data)
        return ResponseEnvelope(data=UserResponse.model_validate(user))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/{user_id}/reset-password",
    response_model=ResponseEnvelope[UserResponse],
    dependencies=[Depends(require_role(["crc_admin"]))],
)
async def reset_password(
    user_id: UUID, body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)
):
    """Reset user password."""
    try:
        user = await user_service.reset_user_password(db, user_id, body.new_password)
        return ResponseEnvelope(data=UserResponse.model_validate(user))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch(
    "/{user_id}/status",
    response_model=ResponseEnvelope[UserResponse],
    dependencies=[Depends(require_role(["crc_admin"]))],
)
async def update_user_status(
    user_id: UUID, body: UserStatusUpdate, db: AsyncSession = Depends(get_db)
):
    """Toggle user active / inactive status."""
    try:
        user = await user_service.set_user_active_status(db, user_id, body.is_active)
        return ResponseEnvelope(data=UserResponse.model_validate(user))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete(
    "/{user_id}",
    response_model=ResponseEnvelope[dict],
    dependencies=[Depends(require_role(["crc_admin"]))],
)
async def delete_user(user_id: UUID, db: AsyncSession = Depends(get_db)):
    """Delete a user from the system."""
    try:
        await user_service.delete_user(db, user_id)
        return ResponseEnvelope(data={"message": "User deleted successfully"})
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
