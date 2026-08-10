from fastapi import APIRouter
from app.schemas.common import ResponseEnvelope

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=ResponseEnvelope[dict])
async def health_check():
    return ResponseEnvelope(
        data={"status": "healthy", "service": "crc_one_backend", "version": "1.0.0"}
    )
