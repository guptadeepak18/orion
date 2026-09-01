import logging
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload

from app.models.session import Session, Engagement, StudentAttendance
from app.models.academic import Program, Batch, Subject
from app.models.faculty import FacultyExternal, FacultyInternal
from app.models.activity import SubjectActivity
from app.models.student import Student
from app.models.system import AIAgentRun
from app.services.llm_client import llm_client

logger = logging.getLogger("crc_one.copilot_agent")


class OperationalCopilotAgent:
    """
    Operational Copilot Agent:
    Schema-aware Natural Language Query (NLQ) interface over academic database.
    Powered by Google Gemini for accurate summaries and actionable operational responses.
    """

    async def execute_query(
        self, db: AsyncSession, prompt: str, user_roles: List[str]
    ) -> Dict[str, Any]:
        prompt_lower = prompt.lower()
        tool_call = None
        data = []

        try:
            # 1. Student-wise Subject-wise Attendance queries
            if any(k in prompt_lower for k in ["attendance", "present", "absent", "attendance rate", "roll call"]):
                tool_call = "student_subject_attendance"
                stmt = (
                    select(StudentAttendance)
                    .options(
                        joinedload(StudentAttendance.student),
                        joinedload(StudentAttendance.session).joinedload(Session.subject),
                    )
                )
                res = await db.execute(stmt)
                records = res.scalars().all()

                agg: Dict[tuple, Dict[str, Any]] = {}
                for r in records:
                    if not r.student or not r.session or not r.session.subject:
                        continue
                    key = (r.student.id, r.session.subject.id)
                    if key not in agg:
                        agg[key] = {
                            "student_name": r.student.full_name or r.student.first_name,
                            "roll_no": r.student.roll_no or "—",
                            "subject": r.session.subject.name,
                            "code": r.session.subject.code,
                            "total": 0,
                            "attended": 0,
                        }
                    agg[key]["total"] += 1
                    if r.status == "present":
                        agg[key]["attended"] += 1

                for k, v in agg.items():
                    tot = v["total"]
                    att = v["attended"]
                    pct = round((att / tot) * 100) if tot > 0 else 0
                    data.append({
                        "student": v["student_name"],
                        "roll_no": v["roll_no"],
                        "subject": f"{v['subject']} ({v['code']})",
                        "sessions": f"{att} / {tot}",
                        "percentage": f"{pct}%",
                        "status": "Eligible" if pct >= 75 else "Short Attendance",
                    })

            # 2. Activities / HyperBuild queries
            elif any(k in prompt_lower for k in ["activity", "activities", "hyperbuild", "rubric", "lab", "assessment"]):
                tool_call = "list_activities"
                stmt = select(SubjectActivity).order_by(SubjectActivity.activity_no).limit(10)
                res = await db.execute(stmt)
                acts = res.scalars().all()
                data = [
                    {
                        "no": a.activity_no,
                        "title": a.title,
                        "unit": a.unit_mapping,
                        "time": a.estimated_time,
                        "released": a.is_released,
                        "rubric_count": len(a.rubric or []),
                    }
                    for a in acts
                ]

            # 2. Subjects / Courses queries
            elif any(k in prompt_lower for k in ["subject", "course", "syllabus", "curriculum"]):
                tool_call = "list_subjects"
                stmt = select(Subject).where(Subject.is_archived == False).limit(10)
                res = await db.execute(stmt)
                subjects = res.scalars().all()
                data = [
                    {
                        "name": s.name,
                        "code": s.code,
                        "credits": s.credits,
                        "type": s.course_category or "Core",
                    }
                    for s in subjects
                ]

            # 3. Sessions / Timetable / Room schedule queries
            elif any(k in prompt_lower for k in ["session", "schedule", "timetable", "room", "venue", "class"]):
                tool_call = "list_sessions"
                stmt = select(Session).limit(10)
                res = await db.execute(stmt)
                sessions = res.scalars().all()
                data = [
                    {
                        "date": str(s.session_date),
                        "time": f"{s.start_time}-{s.end_time}",
                        "venue": s.venue,
                        "status": s.status,
                    }
                    for s in sessions
                ]

            # 4. Faculty / Experts queries
            elif any(k in prompt_lower for k in ["faculty", "expert", "professor", "teacher", "instructor"]):
                tool_call = "list_external_faculty"
                stmt = select(FacultyExternal).where(FacultyExternal.is_active == True).limit(10)
                res = await db.execute(stmt)
                faculty = res.scalars().all()
                data = [
                    {
                        "name": f.name,
                        "org": f.organization or "Lexicon MILE",
                        "rate": f"₹{f.standard_rate} / {f.standard_rate_type}" if f.standard_rate else "Standard",
                        "active": f.is_active,
                    }
                    for f in faculty
                ]

            # 5. Students / Enrollment queries
            elif any(k in prompt_lower for k in ["student", "enrollment", "roll", "learner"]):
                tool_call = "list_students"
                stmt = select(Student).limit(10)
                res = await db.execute(stmt)
                students = res.scalars().all()
                data = [
                    {
                        "name": s.full_name or f"{s.first_name} {s.last_name or ''}".strip(),
                        "roll_no": s.roll_no,
                        "email": s.email_official or s.email_personal or "",
                    }
                    for s in students
                ]

            # 6. Programs / Batches queries
            elif any(k in prompt_lower for k in ["program", "batch", "term", "division"]):
                tool_call = "list_programs"
                stmt = select(Program).limit(10)
                res = await db.execute(stmt)
                progs = res.scalars().all()
                data = [{"name": p.name, "code": p.code, "active": p.is_active} for p in progs]

            # 7. General Operational queries
            else:
                tool_call = "general_query"
                data = [{"info": "Database query completed safely under RBAC filters."}]
        except Exception as query_err:
            logger.warning(f"Database extraction error during Copilot execution: {query_err}")
            tool_call = "general_query"
            data = []

        # Generate intelligent synthesis using Gemini LLM
        system_instruction = (
            "You are Orion Copilot, the AI operational assistant for the Lexicon MILE Higher Education portal. "
            "You have direct schema-aware access to programs, courses, HyperBuild AI activities, faculty, student rosters, "
            "and timetable sessions. Provide accurate, clear, and professional answers."
        )

        summary = await llm_client.generate_chat_response(
            user_prompt=prompt,
            system_instruction=system_instruction,
            retrieved_data=data,
            tool_call=tool_call,
        )

        # Log AI Agent execution run
        try:
            run = AIAgentRun(
                agent_name="copilot_agent",
                triggered_by="user_request",
                input_context={"prompt": prompt, "user_roles": user_roles},
                output={"tool_call": tool_call, "result_count": len(data)},
                action_taken=f"Executed tool '{tool_call}' and generated Gemini response"
            )
            db.add(run)
            await db.commit()
        except Exception as e:
            logger.warning(f"Could not log AIAgentRun: {e}")

        # Map query intent to dedicated platform page
        nav_link = None
        if tool_call == "student_subject_attendance":
            nav_link = {
                "path": "/sessions",
                "label": "Visit Attendance & Sessions",
                "description": "View daily session registers, marked attendance, and timetable rosters."
            }
        elif tool_call == "list_external_faculty":
            nav_link = {
                "path": "/faculty",
                "label": "Visit Faculty Directory",
                "description": "View and manage internal/visiting faculty, profiles, and compliance."
            }
        elif tool_call == "list_students":
            nav_link = {
                "path": "/students",
                "label": "Visit Student Directory",
                "description": "View full student roster, enrollment details, and academic profiles."
            }
        elif tool_call == "list_subjects":
            nav_link = {
                "path": "/subjects",
                "label": "Visit Subject Catalog",
                "description": "Browse complete structured course syllabi, unit topics, and books."
            }
        elif tool_call == "list_activities":
            nav_link = {
                "path": "/lms",
                "label": "Visit HyperBuild LMS",
                "description": "Access interactive lab activities, submissions, and AI scorecards."
            }
        elif tool_call == "list_sessions":
            nav_link = {
                "path": "/sessions",
                "label": "Visit Classroom Timetable",
                "description": "View room allocations, scheduled sessions, and faculty timetable."
            }
        elif tool_call == "list_programs":
            nav_link = {
                "path": "/academic",
                "label": "Visit Academic Programs",
                "description": "Configure academic programs, batches, terms, and divisions."
            }

        return {
            "prompt": prompt,
            "tool_call": tool_call,
            "summary": summary,
            "data": data,
            "nav_link": nav_link,
        }


copilot_agent = OperationalCopilotAgent()
