import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import String, Text, Integer, Float, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.models.base import Base, TimestampMixin, SoftDeleteMixin


class Ideathon(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "ideathons"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    theme: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Rich Information & Brief Sections
    brief: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Executive summary of the challenge
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    problem_statement: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    banner_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Process, Rules, FAQs (JSON structured lists)
    process_and_stages: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONB, nullable=True, default=list)
    rules_and_guidelines: Mapped[Optional[List[str]]] = mapped_column(JSONB, nullable=True, default=list)
    faqs: Mapped[Optional[List[Dict[str, str]]]] = mapped_column(JSONB, nullable=True, default=list)

    # Cross-Cohort Eligibility
    target_programs: Mapped[List[str]] = mapped_column(JSONB, nullable=False, default=lambda: ["ALL"])
    target_batches: Mapped[List[str]] = mapped_column(JSONB, nullable=False, default=lambda: ["ALL"])
    
    # Team Limits (1 means individual allowed)
    min_team_size: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    max_team_size: Mapped[int] = mapped_column(Integer, default=4, nullable=False)

    # Timelines
    registration_start_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    registration_end_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    submission_start_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    submission_end_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    presentation_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    results_announced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Lifecycle Status: draft | registration_open | submission_open | evaluation | presentation | completed | archived
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False, index=True)

    # Tracks, Rubrics & Prizes
    tracks: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    rubrics: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    prizes: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)

    # Evaluation Controls
    is_double_blind_screening: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_leaderboard_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    lead_faculty_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    assigned_faculty_ids: Mapped[List[str]] = mapped_column(
        JSONB, nullable=False, default=list
    )

    lead_faculty: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[lead_faculty_id]
    )

    # Relationships
    teams: Mapped[List["IdeathonTeam"]] = relationship(
        "IdeathonTeam", back_populates="ideathon", cascade="all, delete-orphan"
    )
    submissions: Mapped[List["IdeathonSubmission"]] = relationship(
        "IdeathonSubmission", back_populates="ideathon", cascade="all, delete-orphan"
    )
    incubated_projects: Mapped[List["HyperbuildIncubatedProject"]] = relationship(
        "HyperbuildIncubatedProject", back_populates="ideathon"
    )


class IdeathonTeam(Base, TimestampMixin):
    __tablename__ = "ideathon_teams"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    ideathon_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ideathons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Team Name is mandatory for all (individuals and multi-member teams)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)  # e.g. "IDEO-8X2F"
    
    leader_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    track_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="registered", nullable=False)  # registered | submitted | withdrawn

    # Relationships
    ideathon: Mapped["Ideathon"] = relationship("Ideathon", back_populates="teams")
    leader: Mapped["Student"] = relationship("Student", foreign_keys=[leader_id])
    members: Mapped[List["IdeathonTeamMember"]] = relationship(
        "IdeathonTeamMember", back_populates="team", cascade="all, delete-orphan"
    )
    submission: Mapped[Optional["IdeathonSubmission"]] = relationship(
        "IdeathonSubmission", back_populates="team", uselist=False, cascade="all, delete-orphan"
    )


class IdeathonTeamMember(Base, TimestampMixin):
    __tablename__ = "ideathon_team_members"
    __table_args__ = (
        # A student can only be in one team per ideathon
        UniqueConstraint("ideathon_id", "student_id", name="uq_ideathon_student"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    ideathon_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ideathons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ideathon_teams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(50), default="Member", nullable=False)  # Leader | Tech Architect | Product Lead | Researcher | Member
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    team: Mapped["IdeathonTeam"] = relationship("IdeathonTeam", back_populates="members")
    student: Mapped["Student"] = relationship("Student")


class IdeathonSubmission(Base, TimestampMixin):
    __tablename__ = "ideathon_submissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    ideathon_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ideathons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ideathon_teams.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    track_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Core Idea Identity
    title: Mapped[str] = mapped_column(String(255), nullable=False)  # Product / Solution Name
    tagline: Mapped[str] = mapped_column(String(255), nullable=False)  # One-line elevator pitch
    executive_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 5-Pillar Structured Analysis
    # Pillar 1: Market Dynamics & Research
    market_dynamics: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Pillar 2: Market Gap Identification
    market_gap: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Pillar 3: Proposed Solution & UVP
    proposed_solution: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    target_audience: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    competitive_moat: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Pillar 4: HyperBuild No-Code Tech Stack
    hyperbuild_stack: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True, default=dict)
    # Pillar 5: Pitch Media & Assets
    pitch_deck_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    demo_video_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    prototype_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Submission Status: draft | submitted | shortlisted | finalist | podium_winner | incubated
    status: Mapped[str] = mapped_column(String(30), default="draft", nullable=False, index=True)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    presentation_slot: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Scoring & Ranks
    phase1_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    phase2_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    final_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    final_rank: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    award_title: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)  # e.g. "1st Place - Gold Podium"

    # Relationships
    ideathon: Mapped["Ideathon"] = relationship("Ideathon", back_populates="submissions")
    team: Mapped["IdeathonTeam"] = relationship("IdeathonTeam", back_populates="submission")
    evaluations: Mapped[List["IdeathonEvaluation"]] = relationship(
        "IdeathonEvaluation", back_populates="submission", cascade="all, delete-orphan"
    )
    incubated_project: Mapped[Optional["HyperbuildIncubatedProject"]] = relationship(
        "HyperbuildIncubatedProject", back_populates="submission", uselist=False
    )


class IdeathonEvaluation(Base, TimestampMixin):
    __tablename__ = "ideathon_evaluations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    submission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ideathon_submissions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    judge_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    round: Mapped[str] = mapped_column(String(30), default="phase1_prelim", nullable=False)  # phase1_prelim | phase2_presentation
    
    # Rubric scores map: { "market_research": 9.0, "market_gap": 8.5, ... }
    scores: Mapped[Dict[str, float]] = mapped_column(JSONB, nullable=False, default=dict)
    total_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # Weighted out of 100
    
    # Qualitative Feedback
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    strengths: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    improvements: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recommendation: Mapped[str] = mapped_column(String(50), default="consider", nullable=False)  # shortlist_for_pitch | award_winner | incubate_in_hyperbuild | needs_revision | reject

    # Relationships
    submission: Mapped["IdeathonSubmission"] = relationship("IdeathonSubmission", back_populates="evaluations")
    judge: Mapped["User"] = relationship("User")


class HyperbuildIncubatedProject(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "hyperbuild_incubated_projects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    submission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ideathon_submissions.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    ideathon_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ideathons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ideathon_teams.id", ondelete="CASCADE"), nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    tagline: Mapped[str] = mapped_column(String(255), nullable=False)
    problem_statement: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    solution_scope: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    lead_student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    mentor_faculty_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Project Lifecycle: onboarding | wireframing | in_development | testing | launched | graduated | on_hold
    status: Mapped[str] = mapped_column(String(30), default="onboarding", nullable=False, index=True)

    # Configured No-Code Stack & Live Workspace Links
    no_code_stack: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    tool_links: Mapped[Dict[str, str]] = mapped_column(JSONB, nullable=False, default=dict)  # flutterflow_url, supabase_url, figma_url, deployed_app_url

    target_launch_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    submission: Mapped["IdeathonSubmission"] = relationship("IdeathonSubmission", back_populates="incubated_project")
    ideathon: Mapped["Ideathon"] = relationship("Ideathon", back_populates="incubated_projects")
    team: Mapped["IdeathonTeam"] = relationship("IdeathonTeam")
    lead_student: Mapped["Student"] = relationship("Student", foreign_keys=[lead_student_id])
    mentor_faculty: Mapped[Optional["User"]] = relationship("User", foreign_keys=[mentor_faculty_id])
    milestones: Mapped[List["HyperbuildProjectMilestone"]] = relationship(
        "HyperbuildProjectMilestone", back_populates="project", cascade="all, delete-orphan", order_by="HyperbuildProjectMilestone.order_index"
    )


class HyperbuildProjectMilestone(Base, TimestampMixin):
    __tablename__ = "hyperbuild_project_milestones"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hyperbuild_incubated_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    target_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Milestone Status: pending | in_progress | submitted | approved | revision_requested
    status: Mapped[str] = mapped_column(String(30), default="pending", nullable=False)

    # Deliverables & Notes
    submission_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    deliverable_urls: Mapped[List[str]] = mapped_column(JSONB, nullable=False, default=list)

    # Reviewer & Feedback
    reviewed_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    review_feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationship
    project: Mapped["HyperbuildIncubatedProject"] = relationship("HyperbuildIncubatedProject", back_populates="milestones")
    reviewed_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[reviewed_by_id])


class IdeathonCertificate(Base, TimestampMixin):
    __tablename__ = "ideathon_certificates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    ideathon_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ideathons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ideathon_teams.id", ondelete="CASCADE"), nullable=False
    )

    # Certificate Type: winner_1st | winner_2nd | winner_3rd | category_award | participation
    certificate_type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    recipient_name: Mapped[str] = mapped_column(String(255), nullable=False)
    team_name: Mapped[str] = mapped_column(String(150), nullable=False)
    project_title: Mapped[str] = mapped_column(String(255), nullable=False)
    certificate_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    verification_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    # Relationships
    ideathon: Mapped["Ideathon"] = relationship("Ideathon")
    student: Mapped["Student"] = relationship("Student")
    team: Mapped["IdeathonTeam"] = relationship("IdeathonTeam")
