from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_role
from app.schemas.common import ResponseEnvelope, MetaSchema
from app.schemas.user import UserCreate, UserResponse
from app.services.user_service import create_user, list_users, get_user_by_id

router = APIRouter(prefix="/users", tags=["Users"])


@router.post(
    "",
    response_model=ResponseEnvelope[UserResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(["crc_admin"]))],
)
async def create_new_user(
    user_in: UserCreate, db: AsyncSession = Depends(get_db)
):
    try:
        user = await create_user(db, user_in)
        return ResponseEnvelope(data=UserResponse.model_validate(user))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "",
    response_model=ResponseEnvelope[List[UserResponse]],
    dependencies=[Depends(require_role(["crc_admin"]))],
)
async def get_users_list(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    users = await list_users(db, page=page, page_size=page_size)
    user_responses = [UserResponse.model_validate(u) for u in users]
    meta = MetaSchema(page=page, page_size=page_size, total_count=len(users))
    return ResponseEnvelope(data=user_responses, meta=meta)
