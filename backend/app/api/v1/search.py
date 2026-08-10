from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_role
from app.schemas.common import ResponseEnvelope
from app.schemas.search import SearchResponse
from app.services import search_service

router = APIRouter(prefix="/search", tags=["Global Search"])


@router.get(
    "",
    response_model=ResponseEnvelope[SearchResponse],
    dependencies=[Depends(require_role(["crc_admin", "crc_coordinator", "finance", "approver", "reporting_readonly"]))],
)
async def search(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
):
    result = await search_service.global_search(db, q)
    return ResponseEnvelope(data=result)
