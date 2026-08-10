from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.models.academic import Program, Batch, Subject
from app.models.faculty import FacultyExternal, FacultyInternal
from app.models.session import Session
from app.models.finance import Invoice, Payment
from app.schemas.search import SearchResultItem, SearchResponse


async def global_search(db: AsyncSession, q: str) -> SearchResponse:
    pattern = f"%{q}%"
    results: List[SearchResultItem] = []

    # 1. Search Programs
    stmt_prog = select(Program).where(or_(Program.name.ilike(pattern), Program.code.ilike(pattern)))
    res_prog = await db.execute(stmt_prog)
    for p in res_prog.scalars().all():
        results.append(
            SearchResultItem(
                id=str(p.id),
                entity_type="program",
                title=f"{p.code} — {p.name}",
                subtitle="Academic Program",
                url=f"/academic?program_id={p.id}",
            )
        )

    # 2. Search External Faculty
    stmt_fac_ext = select(FacultyExternal).where(
        or_(FacultyExternal.name.ilike(pattern), FacultyExternal.email.ilike(pattern))
    )
    res_fac_ext = await db.execute(stmt_fac_ext)
    for f in res_fac_ext.scalars().all():
        results.append(
            SearchResultItem(
                id=str(f.id),
                entity_type="faculty_external",
                title=f.name,
                subtitle=f"External Faculty ({f.organization or 'Visiting'})",
                url=f"/faculty?id={f.id}",
            )
        )

    # 3. Search Internal Faculty
    stmt_fac_int = select(FacultyInternal).where(
        or_(FacultyInternal.employee_id.ilike(pattern), FacultyInternal.email.ilike(pattern))
    )
    res_fac_int = await db.execute(stmt_fac_int)
    for f in res_fac_int.scalars().all():
        results.append(
            SearchResultItem(
                id=str(f.id),
                entity_type="faculty_internal",
                title=f.email,
                subtitle=f"Internal Faculty ({f.department})",
                url=f"/faculty?id={f.id}",
            )
        )

    # 4. Search Invoices
    stmt_inv = select(Invoice).where(Invoice.invoice_number.ilike(pattern))
    res_inv = await db.execute(stmt_inv)
    for inv in res_inv.scalars().all():
        results.append(
            SearchResultItem(
                id=str(inv.id),
                entity_type="invoice",
                title=f"Invoice #{inv.invoice_number}",
                subtitle=f"Total: ₹{inv.total_amount:,.2f} ({inv.status})",
                url=f"/finance?invoice_id={inv.id}",
            )
        )

    return SearchResponse(query=q, total_results=len(results), results=results)
