from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.system import AuditLog


async def list_audit_logs(db: AsyncSession, page: int = 1, page_size: int = 50) -> List[AuditLog]:
    offset = (page - 1) * page_size
    stmt = (
        select(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())
