import io
import re
import json
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy import select, delete, update
from sqlalchemy.ext.asyncio import AsyncSession
import docx
from uuid import UUID

from app.models.activity import SubjectActivity
from app.models.academic import Subject
from app.schemas.activity import ActivityCreate, ActivityUpdate


class ActivityService:
    async def list_activities(
        self,
        db: AsyncSession,
        subject_id: UUID,
        is_student: bool = False,
        current_user_id: Optional[UUID] = None
    ) -> List[SubjectActivity]:
        # 1. Fetch all activities for the subject
        stmt = select(SubjectActivity).where(
            SubjectActivity.subject_id == subject_id
        ).order_by(SubjectActivity.activity_no)
        
        res = await db.execute(stmt)
        activities = list(res.scalars().all())
        
        # 2. Resolve student info if applicable
        from app.models.student import Student
        from app.models.session import Session
        
        student = None
        if current_user_id and is_student:
            student_stmt = select(Student).where(Student.user_id == current_user_id)
            student_res = await db.execute(student_stmt)
            student = student_res.scalar_one_or_none()

        # 3. Fetch active sessions for timetable automatic time-gated release
        from app.models.session import HyperbuildActivity
        from datetime import timezone, timedelta

        # Indian Standard Time (UTC+05:30) for scheduled timetable comparison
        ist = timezone(timedelta(hours=5, minutes=30))
        now_ist = datetime.now(ist).replace(tzinfo=None)

        release_schedule = {}

        # 3a. Direct sessions mapped to this subject
        session_stmt = select(Session).where(
            Session.subject_id == subject_id,
            Session.is_deleted == False
        )
        if student and student.batch_id:
            session_stmt = session_stmt.where(Session.batch_id == student.batch_id)
            
        session_res = await db.execute(session_stmt)
        active_sessions = session_res.scalars().all()
        
        for s in active_sessions:
            if s.hyperbuild_activity_no:
                try:
                    act_num = int(s.hyperbuild_activity_no)
                    start_dt = datetime.combine(s.session_date, s.start_time)
                    if act_num not in release_schedule or start_dt < release_schedule[act_num]:
                        release_schedule[act_num] = start_dt
                except Exception:
                    continue

        # 3b. Multi-activity HyperBuild sessions where activities are in hyperbuild_activities table
        ha_stmt = (
            select(HyperbuildActivity, Session)
            .join(Session, HyperbuildActivity.session_id == Session.id)
            .where(
                HyperbuildActivity.subject_id == subject_id,
                HyperbuildActivity.is_deleted == False,
                Session.is_deleted == False,
            )
        )
        if student and student.batch_id:
            ha_stmt = ha_stmt.where(Session.batch_id == student.batch_id)

        ha_res = await db.execute(ha_stmt)
        for ha, s in ha_res.all():
            try:
                act_num = int(ha.activity_no)
                start_dt = datetime.combine(s.session_date, ha.start_time)
                if act_num not in release_schedule or start_dt < release_schedule[act_num]:
                    release_schedule[act_num] = start_dt
            except Exception:
                continue

        # 4. Mark activities as released if scheduled timetable time has arrived
        needs_commit = False
        utc_now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
        for a in activities:
            if not a.is_released and a.activity_no in release_schedule:
                if now_ist >= release_schedule[a.activity_no]:
                    a.is_released = True
                    a.released_at = utc_now_naive
                    a.released_by = "Timetable Auto-Release"
                    needs_commit = True

        if needs_commit:
            try:
                await db.commit()
                # Re-fetch activities cleanly after commit to prevent expired attribute access
                res = await db.execute(stmt)
                activities = list(res.scalars().all())
            except Exception:
                await db.rollback()

        return activities

    async def get_activity(self, db: AsyncSession, activity_id: UUID) -> Optional[SubjectActivity]:
        return await db.get(SubjectActivity, activity_id)

    async def create_activity(self, db: AsyncSession, subject_id: UUID, payload: ActivityCreate) -> SubjectActivity:
        data = payload.model_dump()
        act = SubjectActivity(
            subject_id=subject_id,
            **data
        )
        db.add(act)
        await db.commit()
        await db.refresh(act)
        return act

    async def update_activity(self, db: AsyncSession, activity_id: UUID, payload: ActivityUpdate) -> Optional[SubjectActivity]:
        act = await db.get(SubjectActivity, activity_id)
        if not act:
            return None
        data = payload.model_dump(exclude_unset=True)
        for k, v in data.items():
            setattr(act, k, v)
        await db.commit()
        await db.refresh(act)
        return act

    async def toggle_release(self, db: AsyncSession, activity_id: UUID, is_released: bool, released_by: Optional[str] = None) -> Optional[SubjectActivity]:
        act = await db.get(SubjectActivity, activity_id)
        if not act:
            return None
        act.is_released = is_released
        if is_released:
            act.released_at = datetime.utcnow()
            act.released_by = released_by
        else:
            act.released_at = None
            act.released_by = None
        await db.commit()
        await db.refresh(act)
        return act

    async def batch_release(self, db: AsyncSession, subject_id: UUID, activity_ids: List[UUID], is_released: bool, released_by: Optional[str] = None) -> List[SubjectActivity]:
        stmt = select(SubjectActivity).where(
            SubjectActivity.subject_id == subject_id,
            SubjectActivity.id.in_(activity_ids)
        )
        res = await db.execute(stmt)
        acts = list(res.scalars().all())
        now = datetime.utcnow()
        for a in acts:
            a.is_released = is_released
            if is_released:
                a.released_at = now
                a.released_by = released_by
            else:
                a.released_at = None
                a.released_by = None
        await db.commit()
        return acts

    async def delete_activity(self, db: AsyncSession, activity_id: UUID) -> bool:
        act = await db.get(SubjectActivity, activity_id)
        if not act:
            return False
        await db.delete(act)
        await db.commit()
        return True


activity_service = ActivityService()


def parse_docx_perfect_bytes(docx_bytes: bytes):
    doc = docx.Document(io.BytesIO(docx_bytes))
    
    def iter_block_items(parent):
        from docx.document import Document
        from docx.table import Table
        from docx.text.paragraph import Paragraph

        if isinstance(parent, Document):
            parent_elm = parent.element.body
        else:
            raise ValueError("parent must be Document")

        for child in parent_elm.iterchildren():
            if child.tag.endswith('p'):
                yield Paragraph(child, parent)
            elif child.tag.endswith('tbl'):
                yield Table(child, parent)

    blocks = list(iter_block_items(doc))
    activities = []
    current_act = None
    current_section = None

    for b in blocks:
        if hasattr(b, 'rows'):
            rows = b.rows
            if not rows:
                continue
            row_txt = " /// ".join([c.text.strip() for c in rows[0].cells if c.text.strip()])
            
            if "ACTIVITY" in row_txt.upper() or "CAPSTONE" in row_txt.upper():
                if any(hdr in row_txt.upper() for hdr in ["WHY THIS ACTIVITY", "STEP-BY-STEP INSTRUCTIONS", "CAPSTONE STRUCTURE", "AI TOOLS", "LEARNING OUTCOMES", "ASSESSMENT TASK", "GRADING RUBRIC"]):
                    pass
                elif re.search(r'ACTIVITY\s*\d+', row_txt, re.IGNORECASE) or ("CAPSTONE" in row_txt.upper() and ("PROJECT" in row_txt.upper() or "CAPSTONE STRUCTURE" in row_txt.upper() or "WORKSHOP" in row_txt.upper() or "LAB" in row_txt.upper())):
                    if current_act:
                        activities.append(current_act)
                    
                    act_num = len(activities) + 1
                    m = re.search(r'ACTIVITY\s*(\d+)', row_txt, re.IGNORECASE)
                    if m:
                        act_num = int(m.group(1))
                    elif "CAPSTONE" in row_txt.upper():
                        act_num = 16

                    full_text = " ".join([c.text.strip() for c in rows[0].cells])
                    title = full_text
                    unit_mapping = ""
                    
                    unit_m = re.search(r'(Unit\s*\d+.*)$', full_text, re.IGNORECASE)
                    if unit_m:
                        unit_mapping = unit_m.group(1).strip()
                        title = full_text[:unit_m.start()].strip()
                    
                    title = re.sub(r'^ACTIVITY\s*\d+\s*[:|—\-]*\s*', '', title, flags=re.IGNORECASE).strip()
                    title = re.sub(r'^CAPSTONE.*[:|—\-]*\s*', 'Capstone Project: ', title, flags=re.IGNORECASE).strip()

                    current_act = {
                        "activity_no": act_num,
                        "title": title,
                        "unit_mapping": unit_mapping,
                        "estimated_time": "",
                        "mode": "",
                        "file_naming": "",
                        "why_this_activity": [],
                        "instructions": [],
                        "ai_tools": [],
                        "learning_outcomes": [],
                        "submission_requirements": [],
                        "rubric": [],
                        "is_released": False
                    }
                    current_section = None
                    continue

            if current_act and "Estimated Time:" in row_txt:
                for cell in rows[0].cells:
                    txt = cell.text.strip()
                    if "Estimated Time:" in txt:
                        current_act["estimated_time"] = txt.replace("Estimated Time:", "").strip()
                    elif "Mode:" in txt:
                        current_act["mode"] = txt.replace("Mode:", "").strip()
                    elif "File Naming:" in txt:
                        current_act["file_naming"] = txt.replace("File Naming:", "").strip()
                continue

            if current_act:
                upper_row = row_txt.upper()
                if "WHY THIS ACTIVITY" in upper_row:
                    current_section = "why_this_activity"
                    continue
                elif "STEP-BY-STEP INSTRUCTIONS" in upper_row or "CAPSTONE STRUCTURE" in upper_row:
                    current_section = "instructions"
                    continue
                elif "AI TOOLS & PLATFORMS" in upper_row:
                    current_section = "ai_tools"
                    continue
                elif "LEARNING OUTCOMES" in upper_row:
                    current_section = "learning_outcomes"
                    continue
                elif "ASSESSMENT TASK & SUBMISSION REQUIREMENTS" in upper_row or "ASSESSMENT TASK" in upper_row:
                    current_section = "submission_requirements"
                    continue
                elif "GRADING RUBRIC" in upper_row:
                    current_section = "rubric"
                    continue

            if current_act and current_section == "ai_tools":
                if len(rows[0].cells) >= 4 and "Tool / Platform" in rows[0].cells[0].text:
                    tools = []
                    for r in rows[1:]:
                        if len(r.cells) >= 4:
                            tools.append({
                                "tool": r.cells[0].text.strip(),
                                "category": r.cells[1].text.strip(),
                                "purpose": r.cells[2].text.strip(),
                                "access": r.cells[3].text.strip(),
                            })
                    current_act["ai_tools"] = tools
                    current_section = None
                    continue

            if current_act and current_section == "rubric":
                if len(rows[0].cells) >= 5 and "Distinction" in rows[0].cells[1].text:
                    rubric = []
                    for r in rows[1:]:
                        if len(r.cells) >= 5:
                            rubric.append({
                                "criterion": r.cells[0].text.strip(),
                                "distinction": r.cells[1].text.strip(),
                                "merit": r.cells[2].text.strip(),
                                "pass_grade": r.cells[3].text.strip(),
                                "needs_work": r.cells[4].text.strip(),
                            })
                    current_act["rubric"] = rubric
                    current_section = None
                    continue

        else:
            p_text = b.text.strip()
            if current_act and current_section and p_text:
                if current_section in ["why_this_activity", "instructions", "learning_outcomes", "submission_requirements"]:
                    current_act[current_section].append(p_text)

    if current_act:
        activities.append(current_act)

    for a in activities:
        for key in ["why_this_activity", "instructions", "learning_outcomes", "submission_requirements"]:
            if isinstance(a[key], list):
                a[key] = "\n".join(a[key])

    return activities


DEFAULT_LEGAL_ACTIVITIES = [
    {
        "activity_no": 1,
        "title": "Amazon v. Future Retail Case Lab — Emergency Arbitration and the Group of Companies Doctrine",
        "unit_mapping": "Unit 1 — Foundations of Business Law, the Indian Legal System and Dispute Resolution",
        "estimated_time": "3–4 hours",
        "mode": "Individual",
        "file_naming": "[RollNo]_LAW_Act01",
        "why_this_activity": "Test activity",
        "instructions": "Test instructions",
        "ai_tools": [],
        "learning_outcomes": "Test outcomes",
        "submission_requirements": "Test requirements",
        "rubric": [],
        "is_released": False
    }
]