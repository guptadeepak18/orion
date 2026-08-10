import logging
from datetime import date, time, timedelta, datetime
from typing import List, Optional, Tuple, Dict, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from app.models.session import Session
from app.models.system import AIAgentRun

logger = logging.getLogger("crc_one.scheduler_sentinel")


class SchedulerConflictException(Exception):
    def __init__(self, message: str, conflict_type: str, details: Dict[str, Any], alternate_slots: List[Dict[str, Any]]):
        super().__init__(message)
        self.message = message
        self.conflict_type = conflict_type
        self.details = details
        self.alternate_slots = alternate_slots


class SchedulerSentinel:
    """
    Synchronous guard agent that validates session schedules against:
    1. Faculty overlapping session conflict (same date & overlapping time)
    2. Venue overlapping session conflict (same venue, date & overlapping time)
    Proposes up to 3 alternate available slots if conflict is detected.
    """

    async def _is_slot_free(
        self,
        db: AsyncSession,
        session_date: date,
        start_time: time,
        end_time: time,
        venue: str,
        faculty_type: str,
        faculty_internal_id: Optional[UUID] = None,
        faculty_external_id: Optional[UUID] = None,
        exclude_session_id: Optional[UUID] = None,
    ) -> Tuple[bool, Optional[str], Optional[Session]]:

        # 1. Venue check
        v_stmt = select(Session).where(
            and_(
                Session.is_deleted == False,
                Session.status != "cancelled",
                Session.session_date == session_date,
                Session.venue == venue,
                Session.start_time < end_time,
                Session.end_time > start_time,
            )
        )
        if exclude_session_id:
            v_stmt = v_stmt.where(Session.id != exclude_session_id)
        v_res = await db.execute(v_stmt)
        v_conflict = v_res.scalars().first()
        if v_conflict:
            return False, "venue_overlap", v_conflict

        # 2. Faculty check
        f_stmt = select(Session).where(
            and_(
                Session.is_deleted == False,
                Session.status != "cancelled",
                Session.session_date == session_date,
                Session.start_time < end_time,
                Session.end_time > start_time,
            )
        )
        if faculty_type == "internal" and faculty_internal_id:
            f_stmt = f_stmt.where(Session.faculty_internal_id == faculty_internal_id)
        elif faculty_type == "external" and faculty_external_id:
            f_stmt = f_stmt.where(Session.faculty_external_id == faculty_external_id)
        else:
            f_stmt = None

        if f_stmt is not None:
            if exclude_session_id:
                f_stmt = f_stmt.where(Session.id != exclude_session_id)
            f_res = await db.execute(f_stmt)
            f_conflict = f_res.scalars().first()
            if f_conflict:
                return False, "faculty_overlap", f_conflict

        return True, None, None

    async def validate_session_slot(
        self,
        db: AsyncSession,
        session_date: date,
        start_time: time,
        end_time: time,
        venue: str,
        faculty_type: str,
        faculty_internal_id: Optional[UUID] = None,
        faculty_external_id: Optional[UUID] = None,
        exclude_session_id: Optional[UUID] = None,
    ) -> None:

        is_free, conflict_type, conflicting_session = await self._is_slot_free(
            db, session_date, start_time, end_time, venue, faculty_type, faculty_internal_id, faculty_external_id, exclude_session_id
        )

        if not is_free and conflicting_session:
            alternates = await self._propose_alternate_slots(
                db, session_date, start_time, end_time, venue, faculty_type, faculty_internal_id, faculty_external_id
            )
            msg = (
                f"Venue conflict: '{venue}' is already booked from {conflicting_session.start_time} to {conflicting_session.end_time} on {session_date}"
                if conflict_type == "venue_overlap"
                else f"Faculty conflict: Assigned faculty is already teaching from {conflicting_session.start_time} to {conflicting_session.end_time} on {session_date}"
            )
            await self._log_run(
                db,
                triggered_by="event",
                input_context={"date": str(session_date), "venue": venue},
                output={"status": "conflict_blocked", "type": conflict_type},
                action_taken=f"Blocked session creation due to {conflict_type}"
            )
            raise SchedulerConflictException(
                message=msg,
                conflict_type=conflict_type,
                details={
                    "conflicting_session_id": str(conflicting_session.id),
                    "venue": venue,
                    "date": str(session_date),
                    "existing_start": str(conflicting_session.start_time),
                    "existing_end": str(conflicting_session.end_time),
                },
                alternate_slots=alternates,
            )

    async def _propose_alternate_slots(
        self,
        db: AsyncSession,
        session_date: date,
        start_time: time,
        end_time: time,
        venue: str,
        faculty_type: str,
        faculty_internal_id: Optional[UUID] = None,
        faculty_external_id: Optional[UUID] = None,
    ) -> List[Dict[str, Any]]:
        duration = datetime.combine(session_date, end_time) - datetime.combine(session_date, start_time)
        possible_starts = [time(9, 0), time(11, 0), time(14, 0), time(16, 0)]
        alternates = []

        for day_offset in [0, 1, -1, 2]:
            candidate_date = session_date + timedelta(days=day_offset)
            if candidate_date.weekday() >= 6:  # Skip Sunday
                continue

            for st in possible_starts:
                if candidate_date == session_date and st == start_time:
                    continue  # Skip requested conflicting slot
                et = (datetime.combine(candidate_date, st) + duration).time()
                is_free, _, _ = await self._is_slot_free(
                    db, candidate_date, st, et, venue, faculty_type, faculty_internal_id, faculty_external_id
                )
                if is_free:
                    alternates.append({
                        "session_date": str(candidate_date),
                        "start_time": str(st),
                        "end_time": str(et),
                        "venue": venue
                    })
                    if len(alternates) >= 3:
                        return alternates

        return alternates

    async def _log_run(self, db: AsyncSession, triggered_by: str, input_context: dict, output: dict, action_taken: str):
        run = AIAgentRun(
            agent_name="scheduler_sentinel",
            triggered_by=triggered_by,
            input_context=input_context,
            output=output,
            action_taken=action_taken
        )
        db.add(run)
        await db.commit()


scheduler_sentinel = SchedulerSentinel()
