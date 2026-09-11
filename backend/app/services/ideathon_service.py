import hashlib
import random
import re
import string
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple

from sqlalchemy import select, and_, or_, desc, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload
from fastapi import HTTPException, status

from app.models.system import Notification, AuditLog

from app.models.ideathon import (
    Ideathon,
    IdeathonTeam,
    IdeathonTeamMember,
    IdeathonSubmission,
    IdeathonEvaluation,
    HyperbuildIncubatedProject,
    HyperbuildProjectMilestone,
    IdeathonCertificate,
)
from app.models.student import Student
from app.models.auth import User, Role
from app.models.faculty import FacultyInternal, FacultyExternal
from app.models.academic import Program, Batch
from app.schemas.ideathon import (
    IdeathonCreate,
    IdeathonUpdate,
    IdeathonSubmissionCreate,
    IdeathonSubmissionUpdate,
    IdeathonEvaluationCreate,
    HyperbuildProjectUpdate,
    HyperbuildMilestoneCreate,
    HyperbuildMilestoneUpdate,
    IdeathonAdminAddMemberRequest,
    IdeathonAdminUpdateTeamRequest,
)


def generate_team_code(length: int = 6) -> str:
    """Generates unique alphanumeric team join code (e.g. IDEO-9X4A)."""
    chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
    rand_suffix = "".join(random.choice(chars) for _ in range(length))
    return f"IDEO-{rand_suffix}"


def slugify(text_val: str) -> str:
    text_val = re.sub(r"[^\w\s-]", "", text_val).strip().lower()
    return re.sub(r"[-\s]+", "-", text_val)


DEFAULT_RUBRICS = [
    {
        "id": "market_research",
        "name": "Market Dynamics & Research Depth",
        "weightage": 25.0,
        "max_score": 10.0,
        "description": "Thoroughness of market analysis, TAM/SAM/SOM sizing, macro trends, competitor landscape, and data-backed citations."
    },
    {
        "id": "market_gap",
        "name": "Market Gap & Problem Validation",
        "weightage": 25.0,
        "max_score": 10.0,
        "description": "Clear identification of an unmet customer pain point, validated need, and why existing market solutions fail."
    },
    {
        "id": "solution_innovation",
        "name": "Solution Innovation & Unique Value Prop",
        "weightage": 20.0,
        "max_score": 10.0,
        "description": "Creativity, originality of proposed solution, user experience journey, and defensible competitive moat."
    },
    {
        "id": "hyperbuild_viability",
        "name": "No-Code Stack & HyperBuild Feasibility",
        "weightage": 15.0,
        "max_score": 10.0,
        "description": "Practicality of rapid MVP execution using no-code tools (FlutterFlow, Supabase, Make.com/n8n, AI APIs)."
    },
    {
        "id": "pitch_delivery",
        "name": "Pitch Presentation & Storytelling",
        "weightage": 15.0,
        "max_score": 10.0,
        "description": "Clarity of communication, slide quality, compelling storytelling, and response to jury questions."
    }
]

DEFAULT_STAGES = [
    {"id": "registration", "title": "Registration & Team Formation", "description": "Form cross-program teams (or register solo) and select your innovation track."},
    {"id": "research_submission", "title": "Market Research & Idea Submission", "description": "Complete the 5-pillar research workspace: market dynamics, gap, UVP, and no-code stack."},
    {"id": "phase1_screening", "title": "Phase 1 Jury Review & Shortlisting", "description": "Jury evaluates submissions against structured rubrics. Top teams shortlisted for pitch round."},
    {"id": "pitch_presentations", "title": "Grand Pitch Presentations", "description": "Live presentation round in front of industry judges and faculty panel."},
    {"id": "leaderboard_awards", "title": "Podium Announcement & Awards", "description": "Top 3 teams awarded prizes and gold, silver, bronze recognition."},
    {"id": "hyperbuild_incubation", "title": "HyperBuild Project Incubation", "description": "Winning ideas converted into active projects to build the live MVP with no-code tools."}
]

DEFAULT_PRIZES = [
    {"rank": 1, "title": "1st Place - Gold Podium", "reward": "₹25,000 Cash Prize + HyperBuild Incubation Grant + Certificate of Excellence", "icon": "trophy-gold"},
    {"rank": 2, "title": "2nd Place - Silver Podium", "reward": "₹15,000 Cash Prize + HyperBuild Incubation Grant + Certificate of Excellence", "icon": "trophy-silver"},
    {"rank": 3, "title": "3rd Place - Bronze Podium", "reward": "₹10,000 Cash Prize + HyperBuild Incubation Grant + Certificate of Excellence", "icon": "trophy-bronze"},
    {"rank": 4, "title": "Best Market Research Award", "reward": "Special Jury Mention + Certificate of Merit", "icon": "award"},
    {"rank": 5, "title": "Best No-Code Architecture", "reward": "Special Jury Mention + Certificate of Merit", "icon": "zap"}
]

DEFAULT_RULES = [
    "Open to all students across any program (PGDM, Global MBA, BBA, HMCT) and any batch.",
    "Participation can be individual or in teams of up to 4 members. Every team or individual MUST provide a venture/team name.",
    "Each student can only belong to one team per competition.",
    "Cross-program and cross-batch teams are strongly encouraged to combine business strategy, design, and technical skills.",
    "Submissions must follow the structured 5-pillar analysis format provided in the Idea Workspace.",
    "The proposed technical architecture must leverage no-code/low-code tools under HyperBuild (e.g. FlutterFlow, Supabase, Make, n8n, AI APIs).",
    "All submissions must be original work. Plagiarism or copy-pasted concepts will lead to disqualification.",
    "Top 3 podium winners will receive cash prizes, incubation grants, and direct induction into the HyperBuild Project Incubation pipeline."
]

DEFAULT_FAQS = [
    {"question": "Can I participate individually without a team?", "answer": "Yes! Solo innovators are fully welcome. Simply enter your venture/project name when registering."},
    {"question": "Can my teammates be from a different program or batch?", "answer": "Absolutely. Orion Ideathons encourage interdisciplinary cross-cohort teams (e.g. a PGDM student teaming up with a BBA student)."},
    {"question": "What tools can we propose in the HyperBuild stack?", "answer": "Any modern no-code or low-code tools such as FlutterFlow, Bubble, Glide, Supabase, Airtable, Make.com, n8n, Google Gemini API, OpenAI APIs, etc."},
    {"question": "What happens after winning the Ideathon?", "answer": "Top and approved ideas are converted into actionable HyperBuild Incubated Projects with dedicated faculty mentors, sprint milestones, and live workspace tools to build and deploy the real product!"}
]


# =============================================================
# Ideathon Operations
# =============================================================

async def hydrate_faculty_details(
    db: AsyncSession, lead_faculty_id: Optional[uuid.UUID], assigned_faculty_ids: Optional[List[str]]
) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]]]:
    lead_faculty = None
    assigned_faculties: List[Dict[str, Any]] = []

    user_ids = []
    if lead_faculty_id:
        user_ids.append(lead_faculty_id)
    if assigned_faculty_ids:
        for fid in assigned_faculty_ids:
            try:
                user_ids.append(uuid.UUID(str(fid)))
            except (ValueError, TypeError):
                pass

    if user_ids:
        stmt = select(User).where(User.id.in_(user_ids))
        res = await db.execute(stmt)
        users_map = {
            u.id: {"id": str(u.id), "full_name": u.full_name or u.email, "email": u.email}
            for u in res.scalars().unique().all()
        }

        if lead_faculty_id and lead_faculty_id in users_map:
            lead_faculty = users_map[lead_faculty_id]

        if assigned_faculty_ids:
            for fid in assigned_faculty_ids:
                try:
                    uid = uuid.UUID(str(fid))
                    if uid in users_map and users_map[uid] not in assigned_faculties:
                        assigned_faculties.append(users_map[uid])
                except (ValueError, TypeError):
                    pass

    return lead_faculty, assigned_faculties


async def get_available_faculties(db: AsyncSession) -> List[Dict[str, Any]]:
    """Fetches all system users with faculty/coordinator/admin roles or entries in faculty tables."""
    items: List[Dict[str, Any]] = []
    user_ids_seen = set()

    # 1. Query users with faculty roles
    res = await db.execute(
        select(User)
        .options(selectinload(User.roles))
        .join(User.roles)
        .where(Role.name.in_(["faculty_internal", "faculty_external", "crc_admin", "crc_coordinator"]))
        .distinct()
        .order_by(User.full_name.asc())
    )
    users = res.scalars().unique().all()
    for u in users:
        role_names = [r.name for r in u.roles]
        f_type = "External" if "faculty_external" in role_names else "Internal"
        user_ids_seen.add(u.id)
        items.append({
            "id": str(u.id),
            "user_id": str(u.id),
            "name": u.full_name or u.email,
            "email": u.email,
            "type": f_type,
            "department": "Faculty Panel",
        })

    # 2. Check faculty_internal table
    try:
        fi_res = await db.execute(select(FacultyInternal).where(FacultyInternal.is_deleted == False))
        for fi in fi_res.scalars().all():
            if fi.user_id and fi.user_id not in user_ids_seen:
                user_ids_seen.add(fi.user_id)
                items.append({
                    "id": str(fi.user_id),
                    "user_id": str(fi.user_id),
                    "name": fi.full_name or fi.email,
                    "email": fi.email,
                    "type": "Internal",
                    "department": fi.department or "Internal Faculty",
                })
    except Exception:
        pass

    # 3. Check faculty_external table
    try:
        fe_res = await db.execute(select(FacultyExternal).where(FacultyExternal.is_deleted == False))
        for fe in fe_res.scalars().all():
            if fe.user_id and fe.user_id not in user_ids_seen:
                user_ids_seen.add(fe.user_id)
                items.append({
                    "id": str(fe.user_id),
                    "user_id": str(fe.user_id),
                    "name": fe.name or fe.email,
                    "email": fe.email,
                    "type": "External",
                    "department": fe.organization or "External Faculty",
                })
    except Exception:
        pass

    return items


async def list_ideathons(db: AsyncSession, status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    query = select(Ideathon).where(Ideathon.is_deleted == False)
    if status_filter and status_filter != "all":
        query = query.where(Ideathon.status == status_filter)
    query = query.order_by(desc(Ideathon.created_at))

    result = await db.execute(query)
    ideathons = result.scalars().all()

    items = []
    for ideo in ideathons:
        # Count teams & submissions
        t_count_stmt = select(func.count(IdeathonTeam.id)).where(IdeathonTeam.ideathon_id == ideo.id)
        s_count_stmt = select(func.count(IdeathonSubmission.id)).where(
            and_(IdeathonSubmission.ideathon_id == ideo.id, IdeathonSubmission.status != "draft")
        )
        t_count = (await db.execute(t_count_stmt)).scalar() or 0
        s_count = (await db.execute(s_count_stmt)).scalar() or 0

        lead_fac, assigned_facs = await hydrate_faculty_details(db, ideo.lead_faculty_id, ideo.assigned_faculty_ids)

        d = {
            "id": ideo.id,
            "title": ideo.title,
            "slug": ideo.slug,
            "theme": ideo.theme,
            "brief": ideo.brief,
            "description": ideo.description,
            "problem_statement": ideo.problem_statement,
            "banner_url": ideo.banner_url,
            "process_and_stages": ideo.process_and_stages or DEFAULT_STAGES,
            "rules_and_guidelines": ideo.rules_and_guidelines or DEFAULT_RULES,
            "faqs": ideo.faqs or DEFAULT_FAQS,
            "target_programs": ideo.target_programs or ["ALL"],
            "target_batches": ideo.target_batches or ["ALL"],
            "min_team_size": ideo.min_team_size,
            "max_team_size": ideo.max_team_size,
            "registration_start_at": ideo.registration_start_at,
            "registration_end_at": ideo.registration_end_at,
            "submission_start_at": ideo.submission_start_at,
            "submission_end_at": ideo.submission_end_at,
            "presentation_date": ideo.presentation_date,
            "results_announced_at": ideo.results_announced_at,
            "status": ideo.status,
            "tracks": ideo.tracks or [],
            "rubrics": ideo.rubrics or DEFAULT_RUBRICS,
            "prizes": ideo.prizes or DEFAULT_PRIZES,
            "is_double_blind_screening": ideo.is_double_blind_screening,
            "is_leaderboard_published": ideo.is_leaderboard_published,
            "lead_faculty_id": ideo.lead_faculty_id,
            "assigned_faculty_ids": ideo.assigned_faculty_ids or [],
            "lead_faculty": lead_fac,
            "assigned_faculties": assigned_facs,
            "created_by_id": ideo.created_by_id,
            "created_at": ideo.created_at,
            "updated_at": ideo.updated_at,
            "total_teams": t_count,
            "total_submissions": s_count,
        }
        items.append(d)

    return items


async def create_ideathon(db: AsyncSession, data: IdeathonCreate, creator_id: Optional[uuid.UUID] = None) -> Ideathon:
    base_slug = data.slug or slugify(data.title)
    # Ensure unique slug
    existing = await db.execute(select(Ideathon).where(Ideathon.slug == base_slug))
    if existing.scalar_one_or_none():
        base_slug = f"{base_slug}-{random.randint(100, 999)}"

    ideathon = Ideathon(
        title=data.title,
        slug=base_slug,
        theme=data.theme,
        brief=data.brief or "",
        description=data.description or "",
        problem_statement=data.problem_statement or "",
        banner_url=data.banner_url,
        process_and_stages=data.process_and_stages if data.process_and_stages else DEFAULT_STAGES,
        rules_and_guidelines=data.rules_and_guidelines if data.rules_and_guidelines else DEFAULT_RULES,
        faqs=data.faqs if data.faqs else DEFAULT_FAQS,
        target_programs=data.target_programs or ["ALL"],
        target_batches=data.target_batches or ["ALL"],
        min_team_size=data.min_team_size,
        max_team_size=data.max_team_size,
        registration_start_at=data.registration_start_at,
        registration_end_at=data.registration_end_at,
        submission_start_at=data.submission_start_at,
        submission_end_at=data.submission_end_at,
        presentation_date=data.presentation_date,
        results_announced_at=data.results_announced_at,
        status=data.status if data.status else ("registration_open" if (data.registration_start_at and data.registration_start_at <= datetime.now(timezone.utc)) else "draft"),
        tracks=data.tracks if data.tracks else [
            {"id": "open", "name": "Open Innovation Track", "description": "Novel solutions tackling verified enterprise or consumer pain points."}
        ],
        rubrics=data.rubrics if data.rubrics else DEFAULT_RUBRICS,
        prizes=data.prizes if data.prizes else DEFAULT_PRIZES,
        is_double_blind_screening=data.is_double_blind_screening,
        is_leaderboard_published=data.is_leaderboard_published,
        lead_faculty_id=data.lead_faculty_id,
        assigned_faculty_ids=data.assigned_faculty_ids or [],
        created_by_id=creator_id,
    )

    db.add(ideathon)
    await db.commit()
    await db.refresh(ideathon)
    return ideathon


async def get_ideathon(db: AsyncSession, ideathon_id_or_slug: str) -> Optional[Dict[str, Any]]:
    query = select(Ideathon).where(Ideathon.is_deleted == False)
    try:
        val_uuid = uuid.UUID(ideathon_id_or_slug)
        query = query.where(Ideathon.id == val_uuid)
    except ValueError:
        query = query.where(Ideathon.slug == ideathon_id_or_slug)

    result = await db.execute(query)
    ideo = result.scalar_one_or_none()
    if not ideo:
        return None

    t_count_stmt = select(func.count(IdeathonTeam.id)).where(IdeathonTeam.ideathon_id == ideo.id)
    s_count_stmt = select(func.count(IdeathonSubmission.id)).where(
        and_(IdeathonSubmission.ideathon_id == ideo.id, IdeathonSubmission.status != "draft")
    )
    t_count = (await db.execute(t_count_stmt)).scalar() or 0
    s_count = (await db.execute(s_count_stmt)).scalar() or 0

    lead_fac, assigned_facs = await hydrate_faculty_details(db, ideo.lead_faculty_id, ideo.assigned_faculty_ids)

    return {
        "id": ideo.id,
        "title": ideo.title,
        "slug": ideo.slug,
        "theme": ideo.theme,
        "brief": ideo.brief,
        "description": ideo.description,
        "problem_statement": ideo.problem_statement,
        "banner_url": ideo.banner_url,
        "process_and_stages": ideo.process_and_stages or DEFAULT_STAGES,
        "rules_and_guidelines": ideo.rules_and_guidelines or DEFAULT_RULES,
        "faqs": ideo.faqs or DEFAULT_FAQS,
        "target_programs": ideo.target_programs or ["ALL"],
        "target_batches": ideo.target_batches or ["ALL"],
        "min_team_size": ideo.min_team_size,
        "max_team_size": ideo.max_team_size,
        "registration_start_at": ideo.registration_start_at,
        "registration_end_at": ideo.registration_end_at,
        "submission_start_at": ideo.submission_start_at,
        "submission_end_at": ideo.submission_end_at,
        "presentation_date": ideo.presentation_date,
        "results_announced_at": ideo.results_announced_at,
        "status": ideo.status,
        "tracks": ideo.tracks or [],
        "rubrics": ideo.rubrics or DEFAULT_RUBRICS,
        "prizes": ideo.prizes or DEFAULT_PRIZES,
        "is_double_blind_screening": ideo.is_double_blind_screening,
        "is_leaderboard_published": ideo.is_leaderboard_published,
        "lead_faculty_id": ideo.lead_faculty_id,
        "assigned_faculty_ids": ideo.assigned_faculty_ids or [],
        "lead_faculty": lead_fac,
        "assigned_faculties": assigned_facs,
        "created_by_id": ideo.created_by_id,
        "created_at": ideo.created_at,
        "updated_at": ideo.updated_at,
        "total_teams": t_count,
        "total_submissions": s_count,
    }


async def update_ideathon(db: AsyncSession, ideathon_id: uuid.UUID, data: IdeathonUpdate) -> Optional[Ideathon]:
    ideo = await db.get(Ideathon, ideathon_id)
    if not ideo or ideo.is_deleted:
        return None

    update_dict = data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(ideo, field, val)

    await db.commit()
    await db.refresh(ideo)
    return ideo


async def update_ideathon_status(db: AsyncSession, ideathon_id: uuid.UUID, new_status: str) -> Optional[Ideathon]:
    allowed_statuses = ["draft", "registration_open", "submission_open", "evaluation", "presentation", "completed", "archived"]
    if new_status not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {allowed_statuses}")
    
    ideo = await db.get(Ideathon, ideathon_id)
    if not ideo or ideo.is_deleted:
        return None

    ideo.status = new_status
    await db.commit()
    await db.refresh(ideo)
    return ideo


async def delete_ideathon(db: AsyncSession, ideathon_id: uuid.UUID) -> bool:
    """Deletes an ideathon and safely cascades all child teams, submissions, evaluations, and projects."""
    ideo = await db.get(Ideathon, ideathon_id)
    if not ideo:
        return False

    # 1. Delete associated certificates
    await db.execute(delete(IdeathonCertificate).where(IdeathonCertificate.ideathon_id == ideathon_id))

    # 2. Delete incubated projects & milestones
    p_res = await db.execute(select(HyperbuildIncubatedProject.id).where(HyperbuildIncubatedProject.ideathon_id == ideathon_id))
    proj_ids = p_res.scalars().all()
    if proj_ids:
        await db.execute(delete(HyperbuildProjectMilestone).where(HyperbuildProjectMilestone.project_id.in_(proj_ids)))
        await db.execute(delete(HyperbuildIncubatedProject).where(HyperbuildIncubatedProject.ideathon_id == ideathon_id))

    # 3. Delete evaluations of all submissions belonging to this ideathon
    s_res = await db.execute(select(IdeathonSubmission.id).where(IdeathonSubmission.ideathon_id == ideathon_id))
    sub_ids = s_res.scalars().all()
    if sub_ids:
        await db.execute(delete(IdeathonEvaluation).where(IdeathonEvaluation.submission_id.in_(sub_ids)))
        await db.execute(delete(IdeathonSubmission).where(IdeathonSubmission.id.in_(sub_ids)))

    # 4. Delete team members and teams
    await db.execute(delete(IdeathonTeamMember).where(IdeathonTeamMember.ideathon_id == ideathon_id))
    await db.execute(delete(IdeathonTeam).where(IdeathonTeam.ideathon_id == ideathon_id))

    # 5. Delete associated notifications
    await db.execute(delete(Notification).where(
        and_(Notification.related_entity_type == "ideathon", Notification.related_entity_id == ideathon_id)
    ))

    # 6. Delete ideathon
    await db.delete(ideo)
    await db.commit()
    return True


async def broadcast_notification(
    db: AsyncSession,
    ideathon_id: uuid.UUID,
    program_ids: Optional[List[str]] = None,
    batch_ids: Optional[List[str]] = None,
    custom_title: Optional[str] = None,
    custom_message: Optional[str] = None,
) -> Dict[str, Any]:
    """Triggers in-app notification to all students in targeted programs & batches."""
    ideo = await db.get(Ideathon, ideathon_id)
    if not ideo:
        raise HTTPException(status_code=404, detail="Competition not found")

    stmt = select(Student).where(Student.is_deleted == False, Student.user_id.isnot(None))

    is_all_programs = not program_ids or "ALL" in program_ids
    is_all_batches = not batch_ids or "ALL" in batch_ids

    # Filter by programs if specified
    if not is_all_programs:
        prog_uuids = []
        for p in program_ids:
            try:
                prog_uuids.append(uuid.UUID(p))
            except (ValueError, TypeError):
                p_res = (await db.execute(select(Program.id).where(or_(Program.code == p, Program.name == p)))).scalar_one_or_none()
                if p_res:
                    prog_uuids.append(p_res)
        if prog_uuids:
            stmt = stmt.where(Student.program_id.in_(prog_uuids))

    # Filter by batches if specified
    if not is_all_batches:
        batch_uuids = []
        for b in batch_ids:
            try:
                batch_uuids.append(uuid.UUID(b))
            except (ValueError, TypeError):
                b_res = (await db.execute(select(Batch.id).where(Batch.name == b))).scalar_one_or_none()
                if b_res:
                    batch_uuids.append(b_res)
        if batch_uuids:
            stmt = stmt.where(Student.batch_id.in_(batch_uuids))

    students = (await db.execute(stmt)).scalars().all()
    if not students:
        return {
            "notified_count": 0,
            "programs_targeted": program_ids or ["ALL"],
            "batches_targeted": batch_ids or ["ALL"],
            "message": "No enrolled students found matching the selected program and batch criteria.",
        }

    title = custom_title or f"📢 Innovation Challenge: {ideo.title}"
    body = (
        custom_message
        or f"A new Ideathon '{ideo.title}' has been launched! Theme: {ideo.theme}. Explore problem statements and register your venture in the Competitions Hub."
    )

    for student in students:
        notif = Notification(
            user_id=student.user_id,
            type="ideathon_announcement",
            title=title,
            body=body,
            priority="high",
            source="ideathon",
            is_read=False,
            related_entity_type="ideathon",
            related_entity_id=ideo.id,
        )
        db.add(notif)

    audit = AuditLog(
        actor_type="human",
        module="competitions",
        action="broadcast_notification",
        entity_type="ideathon",
        entity_id=ideo.id,
        new_value={
            "students_notified": len(students),
            "program_ids": program_ids,
            "batch_ids": batch_ids,
            "title": title,
        }
    )
    db.add(audit)
    await db.commit()

    return {
        "notified_count": len(students),
        "programs_targeted": program_ids or ["ALL"],
        "batches_targeted": batch_ids or ["ALL"],
        "message": f"Successfully notified {len(students)} students across selected programs and batches.",
    }



# =============================================================
# Team Management & Cross-Cohort Participation
# =============================================================

async def get_student_by_user_id(db: AsyncSession, user_id: uuid.UUID) -> Optional[Student]:
    res = await db.execute(select(Student).where(Student.user_id == user_id, Student.is_deleted == False))
    return res.scalar_one_or_none()


async def register_team(
    db: AsyncSession, ideathon_id: uuid.UUID, team_name: str, leader_student_id: uuid.UUID, track_id: Optional[str] = None
) -> IdeathonTeam:
    # 1. Check if ideathon exists
    ideo = await db.get(Ideathon, ideathon_id)
    if not ideo or ideo.is_deleted:
        raise HTTPException(status_code=404, detail="Ideathon not found")

    # 1b. Enforce Registration Date & Time Deadline
    if ideo.registration_end_at:
        now = datetime.now(timezone.utc)
        reg_end = ideo.registration_end_at if ideo.registration_end_at.tzinfo else ideo.registration_end_at.replace(tzinfo=timezone.utc)
        if now > reg_end:
            deadline_str = reg_end.strftime("%b %d, %Y at %I:%M %p UTC")
            raise HTTPException(
                status_code=400,
                detail=f"Team registration closed on {deadline_str}. New team registrations are no longer accepted."
            )

    # 2. Strict Rule: One student can be in only 1 team per ideathon
    existing_membership = await db.execute(
        select(IdeathonTeamMember).where(
            and_(IdeathonTeamMember.ideathon_id == ideathon_id, IdeathonTeamMember.student_id == leader_student_id)
        )
    )
    if existing_membership.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="You are already registered in a team for this Ideathon. A student can only join one team."
        )

    # 3. Mandatory Team Name
    clean_name = team_name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Team name is mandatory for all participants.")

    # 4. Generate unique team code
    code = generate_team_code()
    while (await db.execute(select(IdeathonTeam).where(IdeathonTeam.code == code))).scalar_one_or_none():
        code = generate_team_code()

    team = IdeathonTeam(
        ideathon_id=ideathon_id,
        name=clean_name,
        code=code,
        leader_id=leader_student_id,
        track_id=track_id,
        status="registered",
    )
    db.add(team)
    await db.flush()

    # Add leader as first member
    member = IdeathonTeamMember(
        ideathon_id=ideathon_id,
        team_id=team.id,
        student_id=leader_student_id,
        role="Leader",
    )
    db.add(member)

    await db.commit()
    await db.refresh(team)
    return team


async def join_team_by_code(
    db: AsyncSession, ideathon_id: uuid.UUID, code: str, student_id: uuid.UUID, role: str = "Member"
) -> IdeathonTeam:
    clean_code = code.strip().upper()
    team_res = await db.execute(
        select(IdeathonTeam)
        .options(selectinload(IdeathonTeam.members))
        .where(and_(IdeathonTeam.ideathon_id == ideathon_id, IdeathonTeam.code == clean_code))
    )
    team = team_res.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Invalid team join code or team not found for this competition.")

    # Check Ideathon team size limits & registration deadline
    ideo = await db.get(Ideathon, ideathon_id)
    if ideo and ideo.registration_end_at:
        now = datetime.now(timezone.utc)
        reg_end = ideo.registration_end_at if ideo.registration_end_at.tzinfo else ideo.registration_end_at.replace(tzinfo=timezone.utc)
        if now > reg_end:
            deadline_str = reg_end.strftime("%b %d, %Y at %I:%M %p UTC")
            raise HTTPException(
                status_code=400,
                detail=f"Team registration closed on {deadline_str}. New members can no longer join teams."
            )

    max_size = ideo.max_team_size if ideo else 4
    if len(team.members) >= max_size:
        raise HTTPException(status_code=400, detail=f"This team has already reached the maximum team size of {max_size} members.")

    # Strict Rule: One student can be in only 1 team per ideathon
    existing_membership = await db.execute(
        select(IdeathonTeamMember).where(
            and_(IdeathonTeamMember.ideathon_id == ideathon_id, IdeathonTeamMember.student_id == student_id)
        )
    )
    if existing_membership.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="You are already registered in a team for this Ideathon. A student can only join one team."
        )

    member = IdeathonTeamMember(
        ideathon_id=ideathon_id,
        team_id=team.id,
        student_id=student_id,
        role=role or "Member",
    )
    db.add(member)
    await db.commit()
    await db.refresh(team)
    return team


async def list_ideathon_teams(db: AsyncSession, ideathon_id: uuid.UUID) -> List[Dict[str, Any]]:
    """Returns all registered teams and their full compositions for this competition."""
    stmt = (
        select(IdeathonTeam)
        .options(
            selectinload(IdeathonTeam.leader),
            selectinload(IdeathonTeam.members).selectinload(IdeathonTeamMember.student).selectinload(Student.program),
            selectinload(IdeathonTeam.members).selectinload(IdeathonTeamMember.student).selectinload(Student.batch),
            selectinload(IdeathonTeam.submission),
        )
        .where(IdeathonTeam.ideathon_id == ideathon_id)
        .order_by(IdeathonTeam.created_at.desc())
    )
    res = await db.execute(stmt)
    teams = res.scalars().all()

    results = []
    for team in teams:
        members_list = []
        for m in team.members:
            members_list.append({
                "id": str(m.id),
                "student_id": str(m.student_id),
                "student_name": m.student.full_name if m.student else "Student",
                "student_email": m.student.email_official if m.student else "",
                "student_prn": m.student.prn_number if m.student else "",
                "program_name": m.student.program.name if (m.student and m.student.program) else None,
                "batch_name": m.student.batch.name if (m.student and m.student.batch) else None,
                "role": m.role,
                "joined_at": m.joined_at,
            })

        sub_info = None
        if team.submission:
            sub_info = {
                "id": str(team.submission.id),
                "title": team.submission.title,
                "status": team.submission.status,
                "submitted_at": team.submission.submitted_at,
                "final_score": team.submission.final_score,
                "final_rank": team.submission.final_rank,
            }

        results.append({
            "id": str(team.id),
            "ideathon_id": str(team.ideathon_id),
            "name": team.name,
            "code": team.code,
            "leader_id": str(team.leader_id),
            "leader_name": team.leader.full_name if team.leader else None,
            "track_id": team.track_id,
            "status": team.status,
            "members": members_list,
            "has_submission": team.submission is not None,
            "submission_id": str(team.submission.id) if team.submission else None,
            "submission": sub_info,
            "created_at": team.created_at,
        })

    return results


async def get_team_for_student(db: AsyncSession, ideathon_id: uuid.UUID, student_id: uuid.UUID) -> Optional[Dict[str, Any]]:
    mem_stmt = (
        select(IdeathonTeamMember)
        .where(and_(IdeathonTeamMember.ideathon_id == ideathon_id, IdeathonTeamMember.student_id == student_id))
    )
    mem_res = await db.execute(mem_stmt)
    mem = mem_res.scalar_one_or_none()
    if not mem:
        return None

    return await get_team_details(db, mem.team_id)


async def get_team_details(db: AsyncSession, team_id: uuid.UUID) -> Optional[Dict[str, Any]]:
    stmt = (
        select(IdeathonTeam)
        .options(
            selectinload(IdeathonTeam.leader),
            selectinload(IdeathonTeam.members).selectinload(IdeathonTeamMember.student).selectinload(Student.program),
            selectinload(IdeathonTeam.members).selectinload(IdeathonTeamMember.student).selectinload(Student.batch),
            selectinload(IdeathonTeam.submission),
        )
        .where(IdeathonTeam.id == team_id)
    )
    res = await db.execute(stmt)
    team = res.scalar_one_or_none()
    if not team:
        return None

    members_list = []
    for m in team.members:
        members_list.append({
            "id": m.id,
            "student_id": m.student_id,
            "student_name": m.student.full_name if m.student else "Student",
            "student_email": m.student.email_official if m.student else "",
            "student_prn": m.student.prn_number if m.student else "",
            "program_name": m.student.program.name if (m.student and m.student.program) else None,
            "batch_name": m.student.batch.name if (m.student and m.student.batch) else None,
            "role": m.role,
            "joined_at": m.joined_at,
        })

    return {
        "id": team.id,
        "ideathon_id": team.ideathon_id,
        "name": team.name,
        "code": team.code,
        "leader_id": team.leader_id,
        "leader_name": team.leader.full_name if team.leader else None,
        "track_id": team.track_id,
        "status": team.status,
        "members": members_list,
        "has_submission": team.submission is not None,
        "submission_id": team.submission.id if team.submission else None,
        "created_at": team.created_at,
    }


async def get_available_students_for_ideathon(
    db: AsyncSession, ideathon_id: uuid.UUID, search: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Returns students eligible to be added to teams in this ideathon (not already in a team)."""
    subq = select(IdeathonTeamMember.student_id).where(IdeathonTeamMember.ideathon_id == ideathon_id)

    query = (
        select(Student)
        .options(
            selectinload(Student.program),
            selectinload(Student.batch),
        )
        .where(
            and_(
                Student.is_deleted == False,
                Student.is_active == True,
                Student.id.not_in(subq),
            )
        )
        .order_by(Student.full_name)
    )

    if search:
        s_term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Student.full_name.ilike(s_term),
                Student.email_official.ilike(s_term),
                Student.prn_number.ilike(s_term),
                Student.first_name.ilike(s_term),
                Student.last_name.ilike(s_term),
            )
        )

    res = await db.execute(query.limit(100))
    students = res.scalars().all()

    return [
        {
            "id": s.id,
            "full_name": s.full_name or f"{s.first_name} {s.last_name or ''}".strip(),
            "email_official": s.email_official or s.email,
            "prn_number": s.prn_number,
            "program_name": s.program.name if s.program else None,
            "batch_name": s.batch.name if s.batch else None,
            "specialization_major": s.specialization_major,
        }
        for s in students
    ]


async def admin_add_team_member(
    db: AsyncSession, team_id: uuid.UUID, student_id: uuid.UUID, role: str = "Member"
) -> Dict[str, Any]:
    """Admin adds a student to an existing ideathon team."""
    team = await db.get(IdeathonTeam, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    ideo = await db.get(Ideathon, team.ideathon_id)
    if not ideo:
        raise HTTPException(status_code=404, detail="Competition not found")

    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Check if student is already in a team for this competition
    existing_mem = await db.execute(
        select(IdeathonTeamMember).where(
            and_(
                IdeathonTeamMember.ideathon_id == team.ideathon_id,
                IdeathonTeamMember.student_id == student_id,
            )
        )
    )
    if existing_mem.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"{student.full_name} is already registered in a team for this competition"
        )

    # Check max team size
    current_count_res = await db.execute(
        select(func.count(IdeathonTeamMember.id)).where(IdeathonTeamMember.team_id == team_id)
    )
    current_count = current_count_res.scalar() or 0
    if ideo.max_team_size and current_count >= ideo.max_team_size:
        raise HTTPException(
            status_code=400,
            detail=f"Team has reached the maximum allowed size of {ideo.max_team_size} members"
        )

    new_member = IdeathonTeamMember(
        id=uuid.uuid4(),
        team_id=team.id,
        ideathon_id=team.ideathon_id,
        student_id=student_id,
        role=role or "Member",
        joined_at=datetime.now(timezone.utc),
    )
    db.add(new_member)
    await db.commit()

    details = await get_team_details(db, team_id)
    return details


async def admin_remove_team_member(
    db: AsyncSession, team_id: uuid.UUID, student_id: uuid.UUID
) -> Dict[str, Any]:
    """Admin removes a member from a team. If the leader is removed, leader is reassigned; if last member, team is deleted."""
    team = await db.get(IdeathonTeam, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    mem_res = await db.execute(
        select(IdeathonTeamMember).where(
            and_(
                IdeathonTeamMember.team_id == team_id,
                IdeathonTeamMember.student_id == student_id,
            )
        )
    )
    member = mem_res.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found in this team")

    all_members_res = await db.execute(
        select(IdeathonTeamMember).where(IdeathonTeamMember.team_id == team_id).order_by(IdeathonTeamMember.joined_at)
    )
    all_members = all_members_res.scalars().all()

    if len(all_members) <= 1:
        await admin_delete_team(db, team_id)
        return {"success": True, "team_deleted": True, "message": "Team deleted as last member was removed"}

    await db.delete(member)

    if team.leader_id == student_id:
        remaining = [m for m in all_members if m.student_id != student_id]
        if remaining:
            new_leader = remaining[0]
            team.leader_id = new_leader.student_id
            new_leader.role = "Leader"

    await db.commit()
    details = await get_team_details(db, team_id)
    return {"success": True, "team_deleted": False, "team": details}


async def admin_update_team(
    db: AsyncSession, team_id: uuid.UUID, data: IdeathonAdminUpdateTeamRequest
) -> Dict[str, Any]:
    """Admin updates team properties: name, track_id, or leader_id."""
    team = await db.get(IdeathonTeam, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if data.name is not None and data.name.strip():
        name_clean = data.name.strip()
        existing_name = await db.execute(
            select(IdeathonTeam).where(
                and_(
                    IdeathonTeam.ideathon_id == team.ideathon_id,
                    func.lower(IdeathonTeam.name) == name_clean.lower(),
                    IdeathonTeam.id != team_id,
                )
            )
        )
        if existing_name.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="A team with this name already exists in this competition")
        team.name = name_clean

    if data.track_id is not None:
        team.track_id = data.track_id
        sub_res = await db.execute(select(IdeathonSubmission).where(IdeathonSubmission.team_id == team_id))
        sub = sub_res.scalar_one_or_none()
        if sub:
            sub.track_id = data.track_id

    if data.leader_id is not None:
        mem_res = await db.execute(
            select(IdeathonTeamMember).where(
                and_(
                    IdeathonTeamMember.team_id == team_id,
                    IdeathonTeamMember.student_id == data.leader_id,
                )
            )
        )
        new_leader_mem = mem_res.scalar_one_or_none()
        if not new_leader_mem:
            raise HTTPException(status_code=400, detail="The designated leader must be an existing member of this team")

        old_mems = await db.execute(
            select(IdeathonTeamMember).where(
                and_(
                    IdeathonTeamMember.team_id == team_id,
                    IdeathonTeamMember.role == "Leader",
                )
            )
        )
        for m in old_mems.scalars().all():
            m.role = "Member"

        team.leader_id = data.leader_id
        new_leader_mem.role = "Leader"

    await db.commit()
    return await get_team_details(db, team_id)


async def admin_delete_team(db: AsyncSession, team_id: uuid.UUID) -> bool:
    """Deletes a team and safely cascades child submissions, evaluations, projects, and members."""
    team = await db.get(IdeathonTeam, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # 1. Certificates
    await db.execute(delete(IdeathonCertificate).where(IdeathonCertificate.team_id == team_id))

    # 2. Incubated projects & milestones
    p_res = await db.execute(select(HyperbuildIncubatedProject.id).where(HyperbuildIncubatedProject.team_id == team_id))
    proj_ids = p_res.scalars().all()
    if proj_ids:
        await db.execute(delete(HyperbuildProjectMilestone).where(HyperbuildProjectMilestone.project_id.in_(proj_ids)))
        await db.execute(delete(HyperbuildIncubatedProject).where(HyperbuildIncubatedProject.team_id == team_id))

    # 3. Submission & evaluations
    s_res = await db.execute(select(IdeathonSubmission.id).where(IdeathonSubmission.team_id == team_id))
    sub_ids = s_res.scalars().all()
    if sub_ids:
        await db.execute(delete(IdeathonEvaluation).where(IdeathonEvaluation.submission_id.in_(sub_ids)))
        await db.execute(delete(IdeathonSubmission).where(IdeathonSubmission.id.in_(sub_ids)))

    # 4. Members
    await db.execute(delete(IdeathonTeamMember).where(IdeathonTeamMember.team_id == team_id))

    # 5. Team
    await db.delete(team)
    await db.commit()
    return True



# =============================================================
# 5-Pillar Idea Submission Workspace
# =============================================================

async def get_submission(
    db: AsyncSession, submission_id: uuid.UUID, anonymize: bool = False
) -> Optional[Dict[str, Any]]:
    stmt = (
        select(IdeathonSubmission)
        .options(
            selectinload(IdeathonSubmission.team).selectinload(IdeathonTeam.members).selectinload(IdeathonTeamMember.student),
            selectinload(IdeathonSubmission.evaluations).selectinload(IdeathonEvaluation.judge),
            selectinload(IdeathonSubmission.incubated_project),
        )
        .where(IdeathonSubmission.id == submission_id)
    )
    res = await db.execute(stmt)
    sub = res.scalar_one_or_none()
    if not sub:
        return None

    team_name = "Team Confidential" if anonymize else (sub.team.name if sub.team else "")
    team_code = "ANON" if anonymize else (sub.team.code if sub.team else "")

    members_data = []
    if not anonymize and sub.team and sub.team.members:
        for m in sub.team.members:
            members_data.append({
                "id": m.id,
                "student_id": m.student_id,
                "student_name": m.student.full_name if m.student else "",
                "student_email": m.student.email_official if m.student else "",
                "student_prn": m.student.prn_number if m.student else "",
                "role": m.role,
                "joined_at": m.joined_at,
            })

    return {
        "id": sub.id,
        "ideathon_id": sub.ideathon_id,
        "team_id": sub.team_id,
        "team_name": team_name,
        "team_code": team_code,
        "track_id": sub.track_id,
        "title": sub.title,
        "tagline": sub.tagline,
        "executive_summary": sub.executive_summary,
        "market_dynamics": sub.market_dynamics,
        "market_gap": sub.market_gap,
        "proposed_solution": sub.proposed_solution,
        "target_audience": sub.target_audience,
        "competitive_moat": sub.competitive_moat,
        "hyperbuild_stack": sub.hyperbuild_stack or {},
        "pitch_deck_url": sub.pitch_deck_url,
        "demo_video_url": sub.demo_video_url,
        "prototype_url": sub.prototype_url,
        "status": sub.status,
        "submitted_at": sub.submitted_at,
        "presentation_slot": sub.presentation_slot,
        "phase1_score": sub.phase1_score,
        "phase2_score": sub.phase2_score,
        "final_score": sub.final_score,
        "final_rank": sub.final_rank,
        "award_title": sub.award_title,
        "members": members_data,
        "incubated_project_id": sub.incubated_project.id if sub.incubated_project else None,
        "created_at": sub.created_at,
        "updated_at": sub.updated_at,
    }


async def save_or_update_submission(
    db: AsyncSession,
    ideathon_id: uuid.UUID,
    team_id: uuid.UUID,
    data: IdeathonSubmissionCreate,
    student_id: uuid.UUID
) -> IdeathonSubmission:
    # 1. Verify student belongs to this team
    mem = await db.execute(
        select(IdeathonTeamMember).where(
            and_(IdeathonTeamMember.team_id == team_id, IdeathonTeamMember.student_id == student_id)
        )
    )
    if not mem.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You can only submit or edit ideas for your own team.")

    # 2. Check if submission exists
    sub_res = await db.execute(select(IdeathonSubmission).where(IdeathonSubmission.team_id == team_id))
    sub = sub_res.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    new_status = "submitted" if data.is_final_submission else "draft"

    if sub:
        # Update existing
        sub.track_id = data.track_id or sub.track_id
        sub.title = data.title
        sub.tagline = data.tagline
        sub.executive_summary = data.executive_summary
        sub.market_dynamics = data.market_dynamics
        sub.market_gap = data.market_gap
        sub.proposed_solution = data.proposed_solution
        sub.target_audience = data.target_audience
        sub.competitive_moat = data.competitive_moat
        sub.hyperbuild_stack = data.hyperbuild_stack or {}
        sub.pitch_deck_url = data.pitch_deck_url
        sub.demo_video_url = data.demo_video_url
        sub.prototype_url = data.prototype_url
        if data.is_final_submission:
            sub.status = "submitted"
            sub.submitted_at = now
    else:
        # Create new
        sub = IdeathonSubmission(
            ideathon_id=ideathon_id,
            team_id=team_id,
            track_id=data.track_id,
            title=data.title,
            tagline=data.tagline,
            executive_summary=data.executive_summary,
            market_dynamics=data.market_dynamics,
            market_gap=data.market_gap,
            proposed_solution=data.proposed_solution,
            target_audience=data.target_audience,
            competitive_moat=data.competitive_moat,
            hyperbuild_stack=data.hyperbuild_stack or {},
            pitch_deck_url=data.pitch_deck_url,
            demo_video_url=data.demo_video_url,
            prototype_url=data.prototype_url,
            status=new_status,
            submitted_at=now if data.is_final_submission else None,
        )
        db.add(sub)

    # Update team status as well
    team = await db.get(IdeathonTeam, team_id)
    if team:
        team.status = new_status

    await db.commit()
    await db.refresh(sub)
    return sub


async def list_submissions_for_ideathon(
    db: AsyncSession,
    ideathon_id: uuid.UUID,
    track_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
    is_judge: bool = False
) -> List[Dict[str, Any]]:
    ideo = await db.get(Ideathon, ideathon_id)
    double_blind = bool(ideo and ideo.is_double_blind_screening and is_judge and ideo.status in ["evaluation", "submission_open"])

    query = (
        select(IdeathonSubmission)
        .options(
            selectinload(IdeathonSubmission.team).selectinload(IdeathonTeam.members).selectinload(IdeathonTeamMember.student),
            selectinload(IdeathonSubmission.evaluations),
            selectinload(IdeathonSubmission.incubated_project),
        )
        .where(IdeathonSubmission.ideathon_id == ideathon_id)
    )
    if track_filter:
        query = query.where(IdeathonSubmission.track_id == track_filter)
    if status_filter:
        query = query.where(IdeathonSubmission.status == status_filter)

    query = query.order_by(desc(IdeathonSubmission.final_score), desc(IdeathonSubmission.submitted_at))

    res = await db.execute(query)
    subs = res.scalars().all()

    items = []
    for s in subs:
        team_name = "Confidential Team" if double_blind else (s.team.name if s.team else "")
        items.append({
            "id": s.id,
            "ideathon_id": s.ideathon_id,
            "team_id": s.team_id,
            "team_name": team_name,
            "track_id": s.track_id,
            "title": s.title,
            "tagline": s.tagline,
            "executive_summary": s.executive_summary,
            "market_dynamics": s.market_dynamics,
            "market_gap": s.market_gap,
            "proposed_solution": s.proposed_solution,
            "target_audience": s.target_audience,
            "competitive_moat": s.competitive_moat,
            "hyperbuild_stack": s.hyperbuild_stack or {},
            "pitch_deck_url": s.pitch_deck_url,
            "demo_video_url": s.demo_video_url,
            "prototype_url": s.prototype_url,
            "status": s.status,
            "submitted_at": s.submitted_at,
            "presentation_slot": s.presentation_slot,
            "phase1_score": s.phase1_score,
            "phase2_score": s.phase2_score,
            "final_score": s.final_score,
            "final_rank": s.final_rank,
            "award_title": s.award_title,
            "evaluations_count": len(s.evaluations),
            "is_incubated": s.incubated_project is not None,
            "incubated_project_id": s.incubated_project.id if s.incubated_project else None,
        })

    return items


# =============================================================
# Evaluation & Rubric Grading
# =============================================================

def calculate_weighted_rubric_score(rubrics: List[Dict[str, Any]], scores: Dict[str, float]) -> float:
    """Calculates weighted normalized score (0 - 100) based on ideathon rubrics."""
    if not rubrics:
        return 0.0

    total_weight = sum(r.get("weightage", 20.0) for r in rubrics) or 100.0
    weighted_sum = 0.0

    for r in rubrics:
        rid = r.get("id")
        max_score = float(r.get("max_score", 10.0)) or 10.0
        weight = float(r.get("weightage", 20.0))
        raw_score = float(scores.get(rid, 0.0))
        # Normalize score to 0 - 1
        normalized = min(max(raw_score / max_score, 0.0), 1.0)
        weighted_sum += (normalized * weight)

    # Scale to 100 if total_weight != 100
    final_val = (weighted_sum / total_weight) * 100.0
    return round(final_val, 2)


async def submit_evaluation(
    db: AsyncSession, submission_id: uuid.UUID, judge_id: uuid.UUID, data: IdeathonEvaluationCreate
) -> IdeathonEvaluation:
    sub = await db.get(IdeathonSubmission, submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    ideo = await db.get(Ideathon, sub.ideathon_id)
    rubrics = ideo.rubrics if ideo and ideo.rubrics else DEFAULT_RUBRICS

    total_weighted = calculate_weighted_rubric_score(rubrics, data.scores)

    # Check if judge already evaluated this submission in this round
    existing = await db.execute(
        select(IdeathonEvaluation).where(
            and_(
                IdeathonEvaluation.submission_id == submission_id,
                IdeathonEvaluation.judge_id == judge_id,
                IdeathonEvaluation.round == data.round
            )
        )
    )
    eval_record = existing.scalar_one_or_none()

    if eval_record:
        eval_record.scores = data.scores
        eval_record.total_score = total_weighted
        eval_record.feedback = data.feedback
        eval_record.strengths = data.strengths
        eval_record.improvements = data.improvements
        eval_record.recommendation = data.recommendation
    else:
        eval_record = IdeathonEvaluation(
            submission_id=submission_id,
            judge_id=judge_id,
            round=data.round,
            scores=data.scores,
            total_score=total_weighted,
            feedback=data.feedback,
            strengths=data.strengths,
            improvements=data.improvements,
            recommendation=data.recommendation,
        )
        db.add(eval_record)

    await db.flush()

    # Recalculate submission aggregate scores
    all_evals = (await db.execute(
        select(IdeathonEvaluation).where(IdeathonEvaluation.submission_id == submission_id)
    )).scalars().all()

    p1_scores = [e.total_score for e in all_evals if e.round == "phase1_prelim"]
    p2_scores = [e.total_score for e in all_evals if e.round == "phase2_presentation"]

    sub.phase1_score = round(sum(p1_scores) / len(p1_scores), 2) if p1_scores else 0.0
    sub.phase2_score = round(sum(p2_scores) / len(p2_scores), 2) if p2_scores else 0.0

    # Composite Final Score: if phase 2 exists, 40% phase 1 + 60% presentation; else 100% phase 1
    if sub.phase2_score > 0:
        sub.final_score = round((sub.phase1_score * 0.40) + (sub.phase2_score * 0.60), 2)
    else:
        sub.final_score = sub.phase1_score

    # Auto-advance status if shortlisted or recommended
    if data.recommendation == "shortlist_for_pitch" and sub.status in ["submitted", "draft"]:
        sub.status = "shortlisted"

    await db.commit()
    await db.refresh(eval_record)
    return eval_record


# =============================================================
# Dynamic Leaderboard & Awards
# =============================================================

async def get_leaderboard(db: AsyncSession, ideathon_id: uuid.UUID) -> Dict[str, Any]:
    ideo = await db.get(Ideathon, ideathon_id)
    if not ideo or ideo.is_deleted:
        raise HTTPException(status_code=404, detail="Ideathon not found")

    subs_stmt = (
        select(IdeathonSubmission)
        .options(
            selectinload(IdeathonSubmission.team).selectinload(IdeathonTeam.leader),
            selectinload(IdeathonSubmission.team).selectinload(IdeathonTeam.members).selectinload(IdeathonTeamMember.student),
            selectinload(IdeathonSubmission.evaluations),
            selectinload(IdeathonSubmission.incubated_project),
        )
        .where(
            and_(
                IdeathonSubmission.ideathon_id == ideathon_id,
                IdeathonSubmission.status.in_(["submitted", "shortlisted", "finalist", "podium_winner", "incubated"])
            )
        )
        .order_by(desc(IdeathonSubmission.final_score), desc(IdeathonSubmission.phase1_score))
    )
    subs = (await db.execute(subs_stmt)).scalars().all()

    rankings = []
    for idx, s in enumerate(subs, 1):
        # Determine podium tier
        podium_tier = None
        award_title = s.award_title
        if idx == 1:
            podium_tier = "gold"
            award_title = award_title or "1st Place - Gold Podium Winner"
        elif idx == 2:
            podium_tier = "silver"
            award_title = award_title or "2nd Place - Silver Podium Winner"
        elif idx == 3:
            podium_tier = "bronze"
            award_title = award_title or "3rd Place - Bronze Podium Winner"

        # Update final rank on submission
        s.final_rank = idx
        if podium_tier:
            s.award_title = award_title
            if s.status != "incubated":
                s.status = "podium_winner"

        member_names = [m.student.full_name for m in s.team.members if m.student] if s.team else []

        # Average rubric sub-scores across evaluations
        rubric_avgs: Dict[str, float] = {}
        if s.evaluations:
            for ev in s.evaluations:
                for k, v in ev.scores.items():
                    rubric_avgs[k] = rubric_avgs.get(k, 0.0) + float(v)
            for k in rubric_avgs:
                rubric_avgs[k] = round(rubric_avgs[k] / len(s.evaluations), 1)

        item = {
            "rank": idx,
            "submission_id": s.id,
            "team_id": s.team_id,
            "team_name": s.team.name if s.team else "Team",
            "project_title": s.title,
            "project_tagline": s.tagline,
            "track_id": s.track_id,
            "lead_name": s.team.leader.full_name if (s.team and s.team.leader) else "Lead",
            "members": member_names,
            "phase1_score": s.phase1_score,
            "phase2_score": s.phase2_score,
            "final_score": s.final_score,
            "rubric_averages": rubric_avgs,
            "award_title": award_title,
            "podium_tier": podium_tier,
            "is_incubated": s.incubated_project is not None,
            "incubated_project_id": s.incubated_project.id if s.incubated_project else None,
        }
        rankings.append(item)

    await db.commit()

    podium = rankings[:3]

    return {
        "ideathon_id": ideo.id,
        "ideathon_title": ideo.title,
        "is_published": ideo.is_leaderboard_published,
        "total_participants": len(rankings),
        "podium": podium,
        "rankings": rankings,
    }


async def toggle_publish_leaderboard(db: AsyncSession, ideathon_id: uuid.UUID) -> bool:
    ideo = await db.get(Ideathon, ideathon_id)
    if not ideo:
        raise HTTPException(status_code=404, detail="Ideathon not found")

    ideo.is_leaderboard_published = not ideo.is_leaderboard_published
    await db.commit()

    if ideo.is_leaderboard_published:
        # Auto-generate certificates for participants & podium winners
        await auto_generate_certificates(db, ideathon_id)

    return ideo.is_leaderboard_published


# =============================================================
# Digital Certificate Generation
# =============================================================

async def auto_generate_certificates(db: AsyncSession, ideathon_id: uuid.UUID) -> int:
    ideo = await db.get(Ideathon, ideathon_id)
    if not ideo:
        return 0

    subs_stmt = (
        select(IdeathonSubmission)
        .options(
            selectinload(IdeathonSubmission.team).selectinload(IdeathonTeam.members).selectinload(IdeathonTeamMember.student)
        )
        .where(IdeathonSubmission.ideathon_id == ideathon_id)
    )
    subs = (await db.execute(subs_stmt)).scalars().all()

    count = 0
    now = datetime.now(timezone.utc)

    for s in subs:
        if not s.team or not s.team.members:
            continue

        for m in s.team.members:
            if not m.student:
                continue

            cert_type = "participation"
            title = f"Certificate of Participation - {ideo.title}"

            if s.final_rank == 1:
                cert_type = "winner_1st"
                title = f"Certificate of Excellence (1st Place) - {ideo.title}"
            elif s.final_rank == 2:
                cert_type = "winner_2nd"
                title = f"Certificate of Excellence (2nd Place) - {ideo.title}"
            elif s.final_rank == 3:
                cert_type = "winner_3rd"
                title = f"Certificate of Excellence (3rd Place) - {ideo.title}"

            cert_num = f"MILE-{ideo.slug[:6].upper()}-{s.team.code[-4:]}-{m.student.prn_number[-4:] if m.student.prn_number else random.randint(1000, 9999)}"
            raw_hash_input = f"{cert_num}:{m.student.id}:{s.title}:{cert_type}"
            verification_hash = hashlib.sha256(raw_hash_input.encode("utf-8")).hexdigest()

            # Check if certificate exists
            existing = await db.execute(
                select(IdeathonCertificate).where(
                    and_(
                        IdeathonCertificate.ideathon_id == ideathon_id,
                        IdeathonCertificate.student_id == m.student_id
                    )
                )
            )
            cert = existing.scalar_one_or_none()

            if cert:
                cert.certificate_type = cert_type
                cert.title = title
                cert.recipient_name = m.student.full_name
                cert.team_name = s.team.name
                cert.project_title = s.title
            else:
                cert = IdeathonCertificate(
                    ideathon_id=ideathon_id,
                    student_id=m.student_id,
                    team_id=s.team_id,
                    certificate_type=cert_type,
                    title=title,
                    recipient_name=m.student.full_name,
                    team_name=s.team.name,
                    project_title=s.title,
                    certificate_number=cert_num,
                    verification_hash=verification_hash,
                    issued_at=now,
                )
                db.add(cert)
                count += 1

    await db.commit()
    return count


async def list_student_certificates(db: AsyncSession, student_id: uuid.UUID) -> List[Dict[str, Any]]:
    stmt = (
        select(IdeathonCertificate)
        .options(selectinload(IdeathonCertificate.ideathon))
        .where(IdeathonCertificate.student_id == student_id)
        .order_by(desc(IdeathonCertificate.issued_at))
    )
    certs = (await db.execute(stmt)).scalars().all()
    return [
        {
            "id": c.id,
            "ideathon_id": c.ideathon_id,
            "ideathon_title": c.ideathon.title if c.ideathon else "Ideathon",
            "student_id": c.student_id,
            "recipient_name": c.recipient_name,
            "team_name": c.team_name,
            "project_title": c.project_title,
            "certificate_type": c.certificate_type,
            "title": c.title,
            "certificate_number": c.certificate_number,
            "verification_hash": c.verification_hash,
            "issued_at": c.issued_at,
        }
        for c in certs
    ]


# =============================================================
# Post-Ideathon HyperBuild Incubation Pipeline
# =============================================================

DEFAULT_INCUBATION_SPRINTS = [
    {
        "order_index": 1,
        "title": "Sprint 1: Schema & Data Architecture (Supabase)",
        "description": "Design relational database schemas, tables, primary keys, foreign keys, row-level security (RLS) policies, and seed mock test data in Supabase.",
    },
    {
        "order_index": 2,
        "title": "Sprint 2: UI/UX Wireframes & Screen Architecture (FlutterFlow)",
        "description": "Build high-fidelity responsive mobile/web screens in FlutterFlow. Establish navigation routers, design system themes, and reusable UI components.",
    },
    {
        "order_index": 3,
        "title": "Sprint 3: Business Logic, Automations & AI Integration",
        "description": "Configure REST APIs, webhooks, and automation flows in Make.com or n8n. Wire Google Gemini / OpenAI LLM prompts and dynamic data bindings.",
    },
    {
        "order_index": 4,
        "title": "Sprint 4: End-to-End QA Testing & Deployed MVP Demo",
        "description": "Perform usability walkthroughs, cross-device testing, stress test queries, and deploy the functional production/staging build with a demo video.",
    },
]


async def convert_submission_to_incubated_project(
    db: AsyncSession, submission_id: uuid.UUID, mentor_faculty_id: Optional[uuid.UUID] = None
) -> HyperbuildIncubatedProject:
    sub_stmt = (
        select(IdeathonSubmission)
        .options(
            selectinload(IdeathonSubmission.team).selectinload(IdeathonTeam.leader),
            selectinload(IdeathonSubmission.incubated_project),
        )
        .where(IdeathonSubmission.id == submission_id)
    )
    res = await db.execute(sub_stmt)
    sub = res.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    if sub.incubated_project:
        return sub.incubated_project

    project = HyperbuildIncubatedProject(
        submission_id=sub.id,
        ideathon_id=sub.ideathon_id,
        team_id=sub.team_id,
        title=sub.title,
        tagline=sub.tagline,
        problem_statement=sub.market_gap or sub.executive_summary,
        solution_scope=sub.proposed_solution,
        lead_student_id=sub.team.leader_id,
        mentor_faculty_id=mentor_faculty_id,
        status="wireframing",
        no_code_stack=sub.hyperbuild_stack or {
            "frontend": "FlutterFlow",
            "backend": "Supabase",
            "automation": "Make.com",
            "ai": "Google Gemini 1.5 Flash"
        },
        tool_links={},
    )
    db.add(project)
    await db.flush()

    # Seed Default 4-Stage Sprint Milestones
    for sprint in DEFAULT_INCUBATION_SPRINTS:
        milestone = HyperbuildProjectMilestone(
            project_id=project.id,
            title=sprint["title"],
            description=sprint["description"],
            order_index=sprint["order_index"],
            status="pending" if sprint["order_index"] > 1 else "in_progress",
        )
        db.add(milestone)

    # Mark submission status as incubated
    sub.status = "incubated"

    await db.commit()
    await db.refresh(project)
    return project


async def list_incubated_projects(
    db: AsyncSession, ideathon_id: Optional[uuid.UUID] = None
) -> List[Dict[str, Any]]:
    query = (
        select(HyperbuildIncubatedProject)
        .options(
            selectinload(HyperbuildIncubatedProject.team).selectinload(IdeathonTeam.members).selectinload(IdeathonTeamMember.student),
            selectinload(HyperbuildIncubatedProject.lead_student),
            selectinload(HyperbuildIncubatedProject.mentor_faculty),
            selectinload(HyperbuildIncubatedProject.milestones),
            selectinload(HyperbuildIncubatedProject.ideathon),
        )
        .where(HyperbuildIncubatedProject.is_deleted == False)
    )
    if ideathon_id:
        query = query.where(HyperbuildIncubatedProject.ideathon_id == ideathon_id)

    query = query.order_by(desc(HyperbuildIncubatedProject.created_at))

    projects = (await db.execute(query)).scalars().all()
    results = []
    for p in projects:
        members_data = []
        if p.team and p.team.members:
            for m in p.team.members:
                members_data.append({
                    "id": m.id,
                    "student_id": m.student_id,
                    "student_name": m.student.full_name if m.student else "",
                    "student_email": m.student.email_official if m.student else "",
                    "student_prn": m.student.prn_number if m.student else "",
                    "role": m.role,
                    "joined_at": m.joined_at,
                })

        milestones_data = [
            {
                "id": ms.id,
                "project_id": ms.project_id,
                "title": ms.title,
                "description": ms.description,
                "order_index": ms.order_index,
                "target_date": ms.target_date,
                "status": ms.status,
                "submission_notes": ms.submission_notes,
                "deliverable_urls": ms.deliverable_urls or [],
                "reviewed_by_id": ms.reviewed_by_id,
                "review_feedback": ms.review_feedback,
                "reviewed_at": ms.reviewed_at,
                "created_at": ms.created_at,
                "updated_at": ms.updated_at,
            }
            for ms in p.milestones
        ]

        results.append({
            "id": p.id,
            "submission_id": p.submission_id,
            "ideathon_id": p.ideathon_id,
            "ideathon_title": p.ideathon.title if p.ideathon else None,
            "team_id": p.team_id,
            "team_name": p.team.name if p.team else "Team",
            "title": p.title,
            "tagline": p.tagline,
            "problem_statement": p.problem_statement,
            "solution_scope": p.solution_scope,
            "lead_student_id": p.lead_student_id,
            "lead_student_name": p.lead_student.full_name if p.lead_student else None,
            "mentor_faculty_id": p.mentor_faculty_id,
            "mentor_faculty_name": p.mentor_faculty.full_name if p.mentor_faculty else None,
            "status": p.status,
            "no_code_stack": p.no_code_stack or {},
            "tool_links": p.tool_links or {},
            "target_launch_date": p.target_launch_date,
            "members": members_data,
            "milestones": milestones_data,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
        })

    return results


async def get_incubated_project_details(
    db: AsyncSession, project_id: uuid.UUID
) -> Optional[Dict[str, Any]]:
    query = (
        select(HyperbuildIncubatedProject)
        .options(
            selectinload(HyperbuildIncubatedProject.team).selectinload(IdeathonTeam.members).selectinload(IdeathonTeamMember.student),
            selectinload(HyperbuildIncubatedProject.lead_student),
            selectinload(HyperbuildIncubatedProject.mentor_faculty),
            selectinload(HyperbuildIncubatedProject.milestones),
            selectinload(HyperbuildIncubatedProject.ideathon),
        )
        .where(HyperbuildIncubatedProject.id == project_id, HyperbuildIncubatedProject.is_deleted == False)
    )
    p = (await db.execute(query)).scalar_one_or_none()
    if not p:
        return None

    members_data = []
    if p.team and p.team.members:
        for m in p.team.members:
            members_data.append({
                "id": m.id,
                "student_id": m.student_id,
                "student_name": m.student.full_name if m.student else "",
                "student_email": m.student.email_official if m.student else "",
                "student_prn": m.student.prn_number if m.student else "",
                "role": m.role,
                "joined_at": m.joined_at,
            })

    milestones_data = [
        {
            "id": ms.id,
            "project_id": ms.project_id,
            "title": ms.title,
            "description": ms.description,
            "order_index": ms.order_index,
            "target_date": ms.target_date,
            "status": ms.status,
            "submission_notes": ms.submission_notes,
            "deliverable_urls": ms.deliverable_urls or [],
            "reviewed_by_id": ms.reviewed_by_id,
            "review_feedback": ms.review_feedback,
            "reviewed_at": ms.reviewed_at,
            "created_at": ms.created_at,
            "updated_at": ms.updated_at,
        }
        for ms in p.milestones
    ]

    return {
        "id": p.id,
        "submission_id": p.submission_id,
        "ideathon_id": p.ideathon_id,
        "ideathon_title": p.ideathon.title if p.ideathon else None,
        "team_id": p.team_id,
        "team_name": p.team.name if p.team else "Team",
        "title": p.title,
        "tagline": p.tagline,
        "problem_statement": p.problem_statement,
        "solution_scope": p.solution_scope,
        "lead_student_id": p.lead_student_id,
        "lead_student_name": p.lead_student.full_name if p.lead_student else None,
        "mentor_faculty_id": p.mentor_faculty_id,
        "mentor_faculty_name": p.mentor_faculty.full_name if p.mentor_faculty else None,
        "status": p.status,
        "no_code_stack": p.no_code_stack or {},
        "tool_links": p.tool_links or {},
        "target_launch_date": p.target_launch_date,
        "members": members_data,
        "milestones": milestones_data,
        "created_at": p.created_at,
        "updated_at": p.updated_at,
    }


async def update_incubated_project(
    db: AsyncSession, project_id: uuid.UUID, data: HyperbuildProjectUpdate
) -> Optional[HyperbuildIncubatedProject]:
    p = await db.get(HyperbuildIncubatedProject, project_id)
    if not p or p.is_deleted:
        return None

    update_dict = data.model_dump(exclude_unset=True)
    for k, v in update_dict.items():
        if k == "tool_links" and isinstance(v, dict):
            current_links = p.tool_links or {}
            current_links.update(v)
            p.tool_links = current_links
        else:
            setattr(p, k, v)

    await db.commit()
    await db.refresh(p)
    return p


async def add_project_milestone(
    db: AsyncSession, project_id: uuid.UUID, data: HyperbuildMilestoneCreate
) -> HyperbuildProjectMilestone:
    ms = HyperbuildProjectMilestone(
        project_id=project_id,
        title=data.title,
        description=data.description,
        order_index=data.order_index,
        target_date=data.target_date,
        status="pending",
    )
    db.add(ms)
    await db.commit()
    await db.refresh(ms)
    return ms


async def update_project_milestone(
    db: AsyncSession,
    milestone_id: uuid.UUID,
    data: HyperbuildMilestoneUpdate,
    reviewer_id: Optional[uuid.UUID] = None
) -> Optional[HyperbuildProjectMilestone]:
    ms = await db.get(HyperbuildProjectMilestone, milestone_id)
    if not ms:
        return None

    update_dict = data.model_dump(exclude_unset=True)
    for k, v in update_dict.items():
        setattr(ms, k, v)

    if reviewer_id and ("status" in update_dict or "review_feedback" in update_dict):
        ms.reviewed_by_id = reviewer_id
        ms.reviewed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(ms)
    return ms
