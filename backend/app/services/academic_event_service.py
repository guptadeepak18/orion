import asyncio
import logging
import os
import uuid
from datetime import date
from typing import List, Optional
from sqlalchemy import select, and_, or_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from app.core.config import settings
from app.models.academic_event import AcademicEvent
from app.models.academic import Program, Batch, Division
from app.models.student import Student
from app.models.auth import User
from app.schemas.academic_event import (
    AcademicEventCreate,
    AcademicEventUpdate,
    AcademicEventResponse,
)

logger = logging.getLogger(__name__)


def resolve_poster_url(raw_poster_url: Optional[str]) -> Optional[str]:
    """Resolves poster URL to high-speed public CDN (Cloudflare R2) or preserves absolute URL."""
    if not raw_poster_url:
        return None
    url = raw_poster_url.strip()
    if url.startswith("http://") or url.startswith("https://"):
        return url
    filename = os.path.basename(url)
    if settings.R2_PUBLIC_URL:
        return f"{settings.R2_PUBLIC_URL.rstrip('/')}/academic_events/{filename}"
    return url


def _enrich_event_response(ev: AcademicEvent) -> AcademicEventResponse:
    return AcademicEventResponse(
        id=ev.id,
        title=ev.title,
        event_category=ev.event_category or "other",
        program_id=ev.program_id,
        batch_id=ev.batch_id,
        division_id=ev.division_id,
        start_date=ev.start_date,
        end_date=ev.end_date,
        start_time=ev.start_time,
        end_time=ev.end_time,
        is_all_day=ev.is_all_day,
        venue=ev.venue,
        mode=ev.mode or "offline",
        organizer_name=ev.organizer_name,
        speaker_guest_details=ev.speaker_guest_details,
        description=ev.description,
        target_audience=ev.target_audience or "all_students",
        is_mandatory=ev.is_mandatory,
        registration_link=ev.registration_link,
        status=ev.status or "scheduled",
        color_code=ev.color_code,
        poster_url=resolve_poster_url(ev.poster_url) or ev.poster_url,
        poster_filename=ev.poster_filename,
        created_by_id=ev.created_by_id,
        created_at=ev.created_at,
        updated_at=ev.updated_at,
        program_name=ev.program.name if ev.program else None,
        program_code=ev.program.code if ev.program else None,
        batch_name=ev.batch.name if ev.batch else None,
        batch_code=ev.batch.code if ev.batch else None,
        division_name=ev.division.name if ev.division else None,
        division_code=ev.division.code if ev.division else None,
        created_by_name=ev.created_by.full_name if ev.created_by else None,
    )


async def list_academic_events(
    db: AsyncSession,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category: Optional[str] = None,
    program_id: Optional[uuid.UUID] = None,
    batch_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
) -> List[AcademicEventResponse]:
    stmt = (
        select(AcademicEvent)
        .options(
            joinedload(AcademicEvent.program),
            joinedload(AcademicEvent.batch),
            joinedload(AcademicEvent.division),
            joinedload(AcademicEvent.created_by),
        )
        .where(AcademicEvent.is_deleted == False)
    )

    if start_date:
        stmt = stmt.where(or_(AcademicEvent.end_date >= start_date, AcademicEvent.start_date >= start_date))
    if end_date:
        stmt = stmt.where(AcademicEvent.start_date <= end_date)
    if category and category != "all":
        stmt = stmt.where(AcademicEvent.event_category == category)
    if program_id:
        stmt = stmt.where(or_(AcademicEvent.program_id == program_id, AcademicEvent.program_id.is_(None)))
    if batch_id:
        stmt = stmt.where(or_(AcademicEvent.batch_id == batch_id, AcademicEvent.batch_id.is_(None)))
    if status and status != "all":
        stmt = stmt.where(AcademicEvent.status == status)

    stmt = stmt.order_by(AcademicEvent.start_date.asc(), AcademicEvent.start_time.asc())
    res = await db.execute(stmt)
    events = res.unique().scalars().all()

    return [_enrich_event_response(e) for e in events]


async def get_academic_event(
    db: AsyncSession,
    event_id: uuid.UUID,
) -> Optional[AcademicEventResponse]:
    stmt = (
        select(AcademicEvent)
        .options(
            joinedload(AcademicEvent.program),
            joinedload(AcademicEvent.batch),
            joinedload(AcademicEvent.division),
            joinedload(AcademicEvent.created_by),
        )
        .where(AcademicEvent.id == event_id, AcademicEvent.is_deleted == False)
    )
    res = await db.execute(stmt)
    ev = res.unique().scalar_one_or_none()
    if not ev:
        return None
    return _enrich_event_response(ev)


async def create_academic_event(
    db: AsyncSession,
    req: AcademicEventCreate,
    created_by_user_id: Optional[uuid.UUID] = None,
) -> AcademicEventResponse:
    ev = AcademicEvent(
        title=req.title.strip(),
        event_category=req.event_category or "other",
        program_id=req.program_id,
        batch_id=req.batch_id,
        division_id=req.division_id,
        start_date=req.start_date,
        end_date=req.end_date or req.start_date,
        start_time=req.start_time,
        end_time=req.end_time,
        is_all_day=req.is_all_day,
        venue=req.venue.strip() if req.venue else None,
        mode=req.mode or "offline",
        organizer_name=req.organizer_name.strip() if req.organizer_name else None,
        speaker_guest_details=req.speaker_guest_details.strip() if req.speaker_guest_details else None,
        description=req.description.strip() if req.description else None,
        target_audience=req.target_audience or "all_students",
        is_mandatory=req.is_mandatory,
        registration_link=req.registration_link.strip() if req.registration_link else None,
        status=req.status or "scheduled",
        color_code=req.color_code,
        poster_url=req.poster_url,
        poster_filename=req.poster_filename,
        created_by_id=created_by_user_id,
    )
    db.add(ev)
    await db.commit()

    saved = await get_academic_event(db, ev.id)
    if not saved:
        raise ValueError("Failed to retrieve created academic event")

    # Trigger student email notifications in the background
    if getattr(req, "notify_students", True):
        try:
            asyncio.create_task(notify_event_students(ev.id))
        except Exception as err:
            logger.error(f"Failed to schedule event notification task: {err}")

    return saved


async def notify_event_students(event_id: uuid.UUID) -> int:
    """
    Dispatches announcement notification emails to all students targeted by an academic event.
    Runs asynchronously with its own database session.
    """
    from app.core.database import AsyncSessionLocal
    from app.services.email_template_service import trigger_activity_email

    logger.info(f"Initiating notification email dispatch for academic event {event_id}...")
    async with AsyncSessionLocal() as db:
        stmt = (
            select(AcademicEvent)
            .options(
                joinedload(AcademicEvent.program),
                joinedload(AcademicEvent.batch),
                joinedload(AcademicEvent.division),
            )
            .where(AcademicEvent.id == event_id, AcademicEvent.is_deleted == False)
        )
        res = await db.execute(stmt)
        ev = res.unique().scalar_one_or_none()
        if not ev:
            logger.warning(f"Academic event {event_id} not found for notification.")
            return 0

        # Query targeted active students
        st_stmt = select(Student).where(Student.status == "active", Student.is_deleted == False)
        
        # Scope filters: if specific batch or program is set, target only those students
        if ev.batch_id:
            st_stmt = st_stmt.where(Student.batch_id == ev.batch_id)
        elif ev.program_id:
            st_stmt = st_stmt.where(Student.program_id == ev.program_id)
        
        if ev.division_id:
            from app.models.student import StudentDivision
            st_stmt = st_stmt.join(StudentDivision, StudentDivision.student_id == Student.id).where(StudentDivision.division_id == ev.division_id)

        st_res = await db.execute(st_stmt)
        students = st_res.scalars().all()
        logger.info(f"Event '{ev.title}' targets {len(students)} student(s).")

        time_str = "All Day" if ev.is_all_day else (
            f"{ev.start_time.strftime('%I:%M %p') if ev.start_time else '10:00 AM'} - {ev.end_time.strftime('%I:%M %p') if ev.end_time else '12:00 PM'}"
        )
        date_str = str(ev.start_date)
        if ev.end_date and ev.end_date != ev.start_date:
            date_str = f"{ev.start_date} to {ev.end_date}"

        category_label = (ev.event_category or "Event").replace("_", " ").title()

        desc_raw = ev.description or "Please check Orion calendar for full event details and schedule."
        desc_formatted = desc_raw.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br />")

        badge_bg = "#fee2e2" if ev.is_mandatory else "#f1f5f9"
        badge_color = "#991b1b" if ev.is_mandatory else "#475569"
        badge_border = "#fecaca" if ev.is_mandatory else "#e2e8f0"
        mandatory_label = "🔴 Mandatory Attendance" if ev.is_mandatory else "🟢 Attendance Optional"

        poster_section = ""
        resolved_poster = resolve_poster_url(ev.poster_url)
        if resolved_poster:
            poster_section = f'''
            <div style="margin: 24px 0 16px; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 8px 24px rgba(0,0,0,0.07); background: #ffffff;">
              <div style="padding: 12px 18px; background: #0f172a; color: #f8fafc; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                📸 Event Poster / Creative Flyer
              </div>
              <div style="background: #0b0f19; padding: 14px; text-align: center;">
                <a href="{resolved_poster}" target="_blank" style="display: block; text-decoration: none;">
                  <img src="{resolved_poster}" alt="{ev.title}" style="max-width: 100%; height: auto; border-radius: 10px; display: block; margin: 0 auto; box-shadow: 0 4px 16px rgba(0,0,0,0.25);" />
                </a>
              </div>
              <div style="background: #f8fafc; padding: 11px 16px; text-align: center; border-top: 1px solid #e2e8f0;">
                <a href="{resolved_poster}" target="_blank" style="color: #4f46e5; font-size: 12.5px; font-weight: 700; text-decoration: none; display: inline-block;">
                  🔍 Click to View &amp; Download Full Flyer ↗
                </a>
              </div>
            </div>
            '''

        registration_btn = ""
        if ev.registration_link:
            registration_btn = f'''
            <a href="{ev.registration_link}" target="_blank" style="display: inline-block; background: #059669; color: #ffffff !important; padding: 13px 28px; border-radius: 12px; font-weight: 800; text-decoration: none; font-size: 13.5px; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.35); margin: 6px 4px;">
              Join / Register Online →
            </a>
            '''

        venue_text = ev.venue or "College Turf / Campus Ground, Lexicon MILE"
        organizer_text = ev.organizer_name or "Academic Operations & Cultural Committee"
        speaker_text = ev.speaker_guest_details or "Faculty Coordinators & Student Council"

        sem = asyncio.Semaphore(8)

        async def _send_to_student(st: Student) -> bool:
            recipient = (st.email_official or st.email or st.email_personal or "").strip()
            if not recipient:
                return False

            full_name = st.full_name or f"{st.first_name} {st.last_name or ''}".strip() or "Student"
            context = {
                "full_name": full_name,
                "event_title": ev.title,
                "event_category": category_label,
                "event_date": date_str,
                "event_time": time_str,
                "venue": venue_text,
                "mode": (ev.mode or "offline").upper(),
                "is_mandatory": mandatory_label,
                "badge_bg": badge_bg,
                "badge_color": badge_color,
                "badge_border": badge_border,
                "speaker_guest_details": speaker_text,
                "description_html": desc_formatted,
                "organizer_name": organizer_text,
                "poster_section": poster_section,
                "registration_btn": registration_btn,
                "app_name": "Orion Portal",
                "support_email": "deepak.gupta@mile.education",
            }

            async with sem:
                try:
                    return await trigger_activity_email(
                        db=db,
                        event_key="academic_event_scheduled",
                        recipient_email=recipient,
                        context=context,
                        fallback_subject=f"Orion — Academic Event: {ev.title} ({date_str})",
                    )
                except Exception as ex:
                    logger.error(f"Error emailing student {recipient} for event {ev.id}: {ex}")
                    return False

        results = await asyncio.gather(*[_send_to_student(st) for st in students])
        dispatched_count = sum(1 for r in results if r)
        logger.info(f"Successfully dispatched {dispatched_count} notification email(s) for event '{ev.title}'.")
        return dispatched_count


async def update_academic_event(
    db: AsyncSession,
    event_id: uuid.UUID,
    req: AcademicEventUpdate,
) -> AcademicEventResponse:
    stmt = select(AcademicEvent).where(AcademicEvent.id == event_id, AcademicEvent.is_deleted == False)
    res = await db.execute(stmt)
    ev = res.unique().scalar_one_or_none()
    if not ev:
        raise ValueError("Academic event not found")

    update_dict = req.model_dump(exclude_unset=True)
    for k, v in update_dict.items():
        if isinstance(v, str):
            v = v.strip()
        setattr(ev, k, v)

    await db.commit()

    saved = await get_academic_event(db, ev.id)
    if not saved:
        raise ValueError("Failed to retrieve updated academic event")
    return saved


async def delete_academic_event(
    db: AsyncSession,
    event_id: uuid.UUID,
) -> bool:
    stmt = select(AcademicEvent).where(AcademicEvent.id == event_id, AcademicEvent.is_deleted == False)
    res = await db.execute(stmt)
    ev = res.unique().scalar_one_or_none()
    if not ev:
        raise ValueError("Academic event not found")

    ev.is_deleted = True
    await db.commit()
    return True
