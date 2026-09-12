import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, status, HTTPException, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import get_current_user, require_role
from app.models.auth import User
from app.schemas.common import ResponseEnvelope
from app.schemas.ideathon import (
    IdeathonCreate,
    IdeathonUpdate,
    IdeathonResponse,
    IdeathonTeamCreate,
    IdeathonTeamJoinRequest,
    IdeathonTeamResponse,
    IdeathonSubmissionCreate,
    IdeathonSubmissionUpdate,
    IdeathonSubmissionResponse,
    IdeathonEvaluationCreate,
    IdeathonEvaluationResponse,
    IdeathonLeaderboardResponse,
    HyperbuildProjectResponse,
    HyperbuildProjectUpdate,
    HyperbuildMilestoneCreate,
    HyperbuildMilestoneUpdate,
    HyperbuildMilestoneResponse,
    IdeathonCertificateResponse,
    IdeathonBroadcastRequest,
    IdeathonBroadcastResponse,
    IdeathonAdminAddMemberRequest,
    IdeathonAdminUpdateTeamRequest,
    IdeathonAvailableStudentResponse,
)
from app.services import ideathon_service

router = APIRouter(prefix="/ideathons", tags=["Ideathons & Competitions"])


# =============================================================
# Ideathons Management
# =============================================================

@router.get("", response_model=ResponseEnvelope[List[Dict[str, Any]]])
async def list_ideathons(
    status: Optional[str] = Query(None, description="Filter by status (draft, registration_open, etc.) or 'all'"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all Ideathons and Competitions with stats."""
    ideathons = await ideathon_service.list_ideathons(db, status_filter=status)
    return ResponseEnvelope(data=ideathons)


@router.post("", response_model=ResponseEnvelope[Dict[str, Any]], status_code=status.HTTP_201_CREATED)
async def create_ideathon(
    data: IdeathonCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin / Coordinator launches a new Ideathon / Competition."""
    roles = [r.name for r in current_user.roles]
    if not any(r in ["crc_admin", "crc_coordinator"] for r in roles):
        raise HTTPException(status_code=403, detail="Only admins and coordinators can create competitions.")

    ideathon = await ideathon_service.create_ideathon(db, data, creator_id=current_user.id)
    detailed = await ideathon_service.get_ideathon(db, str(ideathon.id))
    return ResponseEnvelope(data=detailed or {})


# =============================================================
# Specific Subpath Endpoints (MUST precede /{id_or_slug})
# =============================================================

@router.get("/faculties", response_model=ResponseEnvelope[List[Dict[str, Any]]])
async def list_competition_faculties(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List available faculty members (internal & external) for competition assignment."""
    faculties = await ideathon_service.get_available_faculties(db)
    return ResponseEnvelope(data=faculties)


@router.get("/my-certificates", response_model=ResponseEnvelope[List[Dict[str, Any]]])
@router.get("/my/certificates", response_model=ResponseEnvelope[List[Dict[str, Any]]])
async def get_my_certificates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all digital certificates (awards & participation) earned by current student."""
    student = await ideathon_service.get_student_by_user_id(db, current_user.id)
    if not student:
        return ResponseEnvelope(data=[])

    certs = await ideathon_service.list_student_certificates(db, student.id)
    return ResponseEnvelope(data=certs)


@router.get("/incubated-projects", response_model=ResponseEnvelope[List[Dict[str, Any]]])
async def list_incubated_projects(
    ideathon_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all active HyperBuild Incubated Projects."""
    projects = await ideathon_service.list_incubated_projects(db, ideathon_id=ideathon_id)
    return ResponseEnvelope(data=projects)


@router.get("/incubated-projects/{project_id}", response_model=ResponseEnvelope[Dict[str, Any]])
async def get_incubated_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get project sprint milestones, tool links, and deliverables."""
    project = await ideathon_service.get_incubated_project_details(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ResponseEnvelope(data=project)


@router.put("/incubated-projects/{project_id}", response_model=ResponseEnvelope[Dict[str, Any]])
async def update_incubated_project(
    project_id: uuid.UUID,
    data: HyperbuildProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update project status, tools (FlutterFlow, Supabase, etc.), or mentor."""
    roles = [r.name for r in current_user.roles]
    student = await ideathon_service.get_student_by_user_id(db, current_user.id)
    is_admin = any(r in ["crc_admin", "crc_coordinator", "faculty_internal"] for r in roles)

    project_details = await ideathon_service.get_incubated_project_details(db, project_id)
    if not project_details:
        raise HTTPException(status_code=404, detail="Project not found")

    is_lead = student and student.id == project_details.get("lead_student_id")
    if not is_admin and not is_lead:
        raise HTTPException(status_code=403, detail="Only project leads and faculty can update this project.")

    updated = await ideathon_service.update_incubated_project(db, project_id, data)
    refreshed = await ideathon_service.get_incubated_project_details(db, project_id)
    return ResponseEnvelope(data=refreshed or {})


@router.post("/incubated-projects/{project_id}/milestones", response_model=ResponseEnvelope[Dict[str, Any]], status_code=status.HTTP_201_CREATED)
async def add_project_milestone(
    project_id: uuid.UUID,
    data: HyperbuildMilestoneCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin / Mentor adds a customized sprint milestone to an incubated project."""
    roles = [r.name for r in current_user.roles]
    if not any(r in ["crc_admin", "crc_coordinator", "faculty_internal"] for r in roles):
        raise HTTPException(status_code=403, detail="Only faculty and admins can add milestones.")

    ms = await ideathon_service.add_project_milestone(db, project_id, data)
    refreshed = await ideathon_service.get_incubated_project_details(db, project_id)
    return ResponseEnvelope(data=refreshed or {})


@router.patch("/incubated-projects/milestones/{milestone_id}", response_model=ResponseEnvelope[Dict[str, Any]])
async def update_milestone(
    milestone_id: uuid.UUID,
    data: HyperbuildMilestoneUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Student submits deliverables (notes, tool links) or Faculty reviews & approves."""
    roles = [r.name for r in current_user.roles]
    is_faculty_or_admin = any(r in ["crc_admin", "crc_coordinator", "faculty_internal"] for r in roles)
    reviewer_id = current_user.id if is_faculty_or_admin else None

    updated = await ideathon_service.update_project_milestone(
        db, milestone_id, data, reviewer_id=reviewer_id
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Milestone not found")

    refreshed = await ideathon_service.get_incubated_project_details(db, updated.project_id)
    return ResponseEnvelope(data=refreshed or {})


@router.get("/{id_or_slug}", response_model=ResponseEnvelope[Dict[str, Any]])
async def get_ideathon(
    id_or_slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get rich Ideathon brief, tracks, rules, rubrics, and dates."""
    ideathon = await ideathon_service.get_ideathon(db, id_or_slug)
    if not ideathon:
        raise HTTPException(status_code=404, detail="Competition not found")
    return ResponseEnvelope(data=ideathon)


@router.put("/{id}", response_model=ResponseEnvelope[Dict[str, Any]])
async def update_ideathon(
    id: uuid.UUID,
    data: IdeathonUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin updates Ideathon configuration, guidelines, or timeline."""
    roles = [r.name for r in current_user.roles]
    if not any(r in ["crc_admin", "crc_coordinator"] for r in roles):
        raise HTTPException(status_code=403, detail="Only admins can update competitions.")

    updated = await ideathon_service.update_ideathon(db, id, data)
    if not updated:
        raise HTTPException(status_code=404, detail="Competition not found")

    detailed = await ideathon_service.get_ideathon(db, str(updated.id))
    return ResponseEnvelope(data=detailed or {})


@router.patch("/{id}/status", response_model=ResponseEnvelope[Dict[str, Any]])
async def update_ideathon_status(
    id: uuid.UUID,
    new_status: str = Query(..., description="draft, registration_open, submission_open, evaluation, presentation, completed, archived"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin updates the lifecycle status of the competition."""
    roles = [r.name for r in current_user.roles]
    if not any(r in ["crc_admin", "crc_coordinator"] for r in roles):
        raise HTTPException(status_code=403, detail="Only admins can update competition status.")

    updated = await ideathon_service.update_ideathon_status(db, id, new_status)
    if not updated:
        raise HTTPException(status_code=404, detail="Competition not found")

    detailed = await ideathon_service.get_ideathon(db, str(updated.id))
    return ResponseEnvelope(data=detailed or {})


@router.delete("/{id}", response_model=ResponseEnvelope[Dict[str, Any]])
async def delete_ideathon(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin / Coordinator deletes an ideathon / competition and all its associated data."""
    roles = [r.name for r in current_user.roles]
    if not any(r in ["crc_admin", "crc_coordinator"] for r in roles):
        raise HTTPException(status_code=403, detail="Only admins can delete competitions.")

    success = await ideathon_service.delete_ideathon(db, id)
    if not success:
        raise HTTPException(status_code=404, detail="Competition not found")

    return ResponseEnvelope(data={"success": True, "message": "Competition and all associated records deleted successfully."})


@router.post("/{id}/broadcast", response_model=ResponseEnvelope[Dict[str, Any]])
async def broadcast_competition_notification(
    id: uuid.UUID,
    payload: IdeathonBroadcastRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin broadcasts competition notifications to targeted programs and batches."""
    roles = [r.name for r in current_user.roles]
    if not any(r in ["crc_admin", "crc_coordinator", "faculty_internal", "super_admin"] for r in roles):
        raise HTTPException(status_code=403, detail="Only admins can broadcast notifications.")

    res = await ideathon_service.broadcast_notification(
        db,
        ideathon_id=id,
        program_ids=payload.program_ids,
        batch_ids=payload.batch_ids,
        custom_title=payload.title,
        custom_message=payload.message,
        send_email=payload.send_email,
        background_tasks=background_tasks,
    )
    return ResponseEnvelope(data=res)



# =============================================================
# Teams & Cross-Cohort Registration
# =============================================================

@router.post("/{id}/teams", response_model=ResponseEnvelope[Dict[str, Any]], status_code=status.HTTP_201_CREATED)
async def register_team(
    id: uuid.UUID,
    data: IdeathonTeamCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Student registers a venture/team for the competition. Team name is mandatory."""
    student = await ideathon_service.get_student_by_user_id(db, current_user.id)
    if not student:
        roles = [r.name for r in current_user.roles]
        if any(r in ["crc_admin", "crc_coordinator"] for r in roles):
            from app.models.student import Student
            res = await db.execute(select(Student).where(Student.is_deleted == False).order_by(Student.created_at.asc()).limit(1))
            student = res.scalar_one_or_none()
        if not student:
            raise HTTPException(status_code=400, detail="Only registered students can participate in competitions.")

    team = await ideathon_service.register_team(
        db, ideathon_id=id, team_name=data.name, leader_student_id=student.id, track_id=data.track_id
    )
    details = await ideathon_service.get_team_details(db, team.id)
    return ResponseEnvelope(data=details or {})


@router.post("/{id}/teams/join", response_model=ResponseEnvelope[Dict[str, Any]])
async def join_team(
    id: uuid.UUID,
    data: IdeathonTeamJoinRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Student joins an existing cross-cohort team using unique 6-char code."""
    student = await ideathon_service.get_student_by_user_id(db, current_user.id)
    if not student:
        roles = [r.name for r in current_user.roles]
        if any(r in ["crc_admin", "crc_coordinator"] for r in roles):
            from app.models.student import Student
            res = await db.execute(select(Student).where(Student.is_deleted == False).order_by(Student.created_at.asc()).limit(1))
            student = res.scalar_one_or_none()
        if not student:
            raise HTTPException(status_code=400, detail="Only registered students can join teams.")

    team = await ideathon_service.join_team_by_code(
        db, ideathon_id=id, code=data.code, student_id=student.id
    )
    details = await ideathon_service.get_team_details(db, team.id)
    return ResponseEnvelope(data=details or {})


@router.get("/{id}/my-team", response_model=ResponseEnvelope[Optional[Dict[str, Any]]])
async def get_my_team(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the currently logged-in student's team and submission for this Ideathon."""
    student = await ideathon_service.get_student_by_user_id(db, current_user.id)
    if not student:
        roles = [r.name for r in current_user.roles]
        if any(r in ["crc_admin", "crc_coordinator"] for r in roles):
            from app.models.ideathon import IdeathonTeam
            team_res = await db.execute(
                select(IdeathonTeam).where(IdeathonTeam.ideathon_id == id).order_by(IdeathonTeam.created_at.desc()).limit(1)
            )
            demo_team = team_res.scalar_one_or_none()
            if demo_team:
                details = await ideathon_service.get_team_details(db, demo_team.id)
                return ResponseEnvelope(data=details)
        return ResponseEnvelope(data=None)

    team_data = await ideathon_service.get_team_for_student(db, id, student.id)
    return ResponseEnvelope(data=team_data)


@router.get("/{id}/teams", response_model=ResponseEnvelope[List[Dict[str, Any]]])
async def list_teams(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin, Coordinator, Faculty & Staff view all registered teams and their complete compositions."""
    teams = await ideathon_service.list_ideathon_teams(db, ideathon_id=id)
    return ResponseEnvelope(data=teams)


@router.get("/{id}/available-students", response_model=ResponseEnvelope[List[IdeathonAvailableStudentResponse]])
async def get_available_students(
    id: uuid.UUID,
    search: Optional[str] = Query(None, description="Search by name, PRN, or email"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin / Coordinator fetches students eligible to be added to teams in this competition."""
    roles = [r.name for r in current_user.roles]
    if not any(r in ["crc_admin", "crc_coordinator"] for r in roles):
        raise HTTPException(status_code=403, detail="Only admins and coordinators can view available students.")

    students = await ideathon_service.get_available_students_for_ideathon(db, ideathon_id=id, search=search)
    return ResponseEnvelope(data=students)


@router.post("/teams/{team_id}/members", response_model=ResponseEnvelope[Dict[str, Any]])
async def admin_add_team_member(
    team_id: uuid.UUID,
    data: IdeathonAdminAddMemberRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin adds a student to an existing competition team."""
    roles = [r.name for r in current_user.roles]
    if not any(r in ["crc_admin", "crc_coordinator"] for r in roles):
        raise HTTPException(status_code=403, detail="Only admins and coordinators can add members to teams.")

    updated_team = await ideathon_service.admin_add_team_member(
        db, team_id=team_id, student_id=data.student_id, role=data.role or "Member"
    )
    return ResponseEnvelope(data=updated_team)


@router.delete("/teams/{team_id}/members/{student_id}", response_model=ResponseEnvelope[Dict[str, Any]])
async def admin_remove_team_member(
    team_id: uuid.UUID,
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin removes a member from an existing competition team."""
    roles = [r.name for r in current_user.roles]
    if not any(r in ["crc_admin", "crc_coordinator"] for r in roles):
        raise HTTPException(status_code=403, detail="Only admins and coordinators can remove members from teams.")

    result = await ideathon_service.admin_remove_team_member(db, team_id=team_id, student_id=student_id)
    return ResponseEnvelope(data=result)


@router.patch("/teams/{team_id}", response_model=ResponseEnvelope[Dict[str, Any]])
async def admin_update_team(
    team_id: uuid.UUID,
    data: IdeathonAdminUpdateTeamRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin updates team name, innovation track, or designates a new leader."""
    roles = [r.name for r in current_user.roles]
    if not any(r in ["crc_admin", "crc_coordinator"] for r in roles):
        raise HTTPException(status_code=403, detail="Only admins and coordinators can update team details.")

    team = await ideathon_service.admin_update_team(db, team_id=team_id, data=data)
    return ResponseEnvelope(data=team)


@router.delete("/teams/{team_id}", response_model=ResponseEnvelope[Dict[str, Any]])
async def admin_delete_team(
    team_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin deletes a competition team altogether."""
    roles = [r.name for r in current_user.roles]
    if not any(r in ["crc_admin", "crc_coordinator"] for r in roles):
        raise HTTPException(status_code=403, detail="Only admins and coordinators can delete teams.")

    await ideathon_service.admin_delete_team(db, team_id=team_id)
    return ResponseEnvelope(data={"deleted": True, "team_id": str(team_id)})



# =============================================================
# 5-Pillar Idea Submission Workspace
# =============================================================

@router.get("/{id}/submissions", response_model=ResponseEnvelope[List[Dict[str, Any]]])
async def list_submissions(
    id: uuid.UUID,
    track: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Faculty / Jury / Admin list submissions with double-blind option."""
    roles = [r.name for r in current_user.roles]
    is_judge = any(r in ["faculty_internal", "faculty_external"] for r in roles) and "crc_admin" not in roles
    subs = await ideathon_service.list_submissions_for_ideathon(
        db, ideathon_id=id, track_filter=track, status_filter=status, is_judge=is_judge
    )
    return ResponseEnvelope(data=subs)


@router.get("/{id}/submissions/{submission_id}", response_model=ResponseEnvelope[Dict[str, Any]])
async def get_submission(
    id: uuid.UUID,
    submission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get full 5-pillar submission details."""
    roles = [r.name for r in current_user.roles]
    ideo = await ideathon_service.get_ideathon(db, str(id))
    double_blind = bool(
        ideo and ideo.get("is_double_blind_screening") and 
        any(r in ["faculty_internal", "faculty_external"] for r in roles) and 
        "crc_admin" not in roles
    )
    sub = await ideathon_service.get_submission(db, submission_id, anonymize=double_blind)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    return ResponseEnvelope(data=sub)


@router.post("/{id}/submissions", response_model=ResponseEnvelope[Dict[str, Any]])
async def save_submission(
    id: uuid.UUID,
    data: IdeathonSubmissionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save draft or final 5-pillar idea submission for student's team."""
    student = await ideathon_service.get_student_by_user_id(db, current_user.id)
    if not student:
        roles = [r.name for r in current_user.roles]
        if any(r in ["crc_admin", "crc_coordinator"] for r in roles):
            from app.models.student import Student
            res = await db.execute(select(Student).where(Student.is_deleted == False).order_by(Student.created_at.asc()).limit(1))
            student = res.scalar_one_or_none()
        if not student:
            raise HTTPException(status_code=400, detail="Only registered students can submit ideas.")

    team_data = await ideathon_service.get_team_for_student(db, id, student.id)
    if not team_data:
        raise HTTPException(status_code=400, detail="You must create or join a team before submitting an idea.")

    team_id = team_data["id"]
    sub = await ideathon_service.save_or_update_submission(
        db, ideathon_id=id, team_id=team_id, data=data, student_id=student.id
    )
    sub_detail = await ideathon_service.get_submission(db, sub.id)
    return ResponseEnvelope(data=sub_detail or {})


# =============================================================
# Faculty & Jury Evaluation
# =============================================================

@router.post("/{id}/submissions/{submission_id}/evaluate", response_model=ResponseEnvelope[Dict[str, Any]])
async def evaluate_submission(
    id: uuid.UUID,
    submission_id: uuid.UUID,
    data: IdeathonEvaluationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Faculty / Jury submits weighted rubric score and qualitative remarks."""
    roles = [r.name for r in current_user.roles]
    if not any(r in ["crc_admin", "crc_coordinator", "faculty_internal", "faculty_external"] for r in roles):
        raise HTTPException(status_code=403, detail="Only faculty and authorized evaluators can grade submissions.")

    evaluation = await ideathon_service.submit_evaluation(
        db, submission_id=submission_id, judge_id=current_user.id, data=data
    )
    return ResponseEnvelope(data={
        "id": evaluation.id,
        "submission_id": evaluation.submission_id,
        "round": evaluation.round,
        "total_score": evaluation.total_score,
        "recommendation": evaluation.recommendation,
        "feedback": evaluation.feedback,
    })


# =============================================================
# Leaderboard & Podium
# =============================================================

@router.get("/{id}/leaderboard", response_model=ResponseEnvelope[Dict[str, Any]])
async def get_leaderboard(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch live or published leaderboard with podium and sub-score metrics."""
    leaderboard = await ideathon_service.get_leaderboard(db, id)
    roles = [r.name for r in current_user.roles]
    is_admin = any(r in ["crc_admin", "crc_coordinator", "faculty_internal", "faculty_external"] for r in roles)

    if not leaderboard["is_published"] and not is_admin:
        return ResponseEnvelope(data={
            "ideathon_id": leaderboard["ideathon_id"],
            "ideathon_title": leaderboard["ideathon_title"],
            "is_published": False,
            "total_participants": leaderboard["total_participants"],
            "podium": [],
            "rankings": [],
            "message": "The official leaderboard and podium will be published following the presentation round."
        })

    return ResponseEnvelope(data=leaderboard)


@router.post("/{id}/publish-leaderboard", response_model=ResponseEnvelope[Dict[str, Any]])
async def toggle_publish_leaderboard(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin toggles official publication of the leaderboard and auto-generates certificates."""
    roles = [r.name for r in current_user.roles]
    if not any(r in ["crc_admin", "crc_coordinator"] for r in roles):
        raise HTTPException(status_code=403, detail="Only admins can publish the leaderboard.")

    is_pub = await ideathon_service.toggle_publish_leaderboard(db, id)
    return ResponseEnvelope(data={"is_published": is_pub, "message": "Leaderboard publication status updated."})


# =============================================================
# Certificates
# =============================================================

@router.post("/{id}/submissions/{submission_id}/incubate", response_model=ResponseEnvelope[Dict[str, Any]])
async def convert_to_incubated_project(
    id: uuid.UUID,
    submission_id: uuid.UUID,
    mentor_faculty_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """1-Click conversion of winning/approved ideathon submission into active HyperBuild Incubated Project."""
    roles = [r.name for r in current_user.roles]
    if not any(r in ["crc_admin", "crc_coordinator", "faculty_internal"] for r in roles):
        raise HTTPException(status_code=403, detail="Only faculty and admins can incubate projects.")

    project = await ideathon_service.convert_submission_to_incubated_project(
        db, submission_id=submission_id, mentor_faculty_id=mentor_faculty_id
    )
    details = await ideathon_service.get_incubated_project_details(db, project.id)
    return ResponseEnvelope(data=details or {})

