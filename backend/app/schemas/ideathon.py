from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


# -------------------------------------------------------------
# Ideathon Schemas
# -------------------------------------------------------------

class TrackSchema(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None


class RubricItemSchema(BaseModel):
    id: str
    name: str
    weightage: float = 20.0  # percentage (e.g. 25.0)
    max_score: float = 10.0
    description: Optional[str] = None


class PrizeSchema(BaseModel):
    rank: int
    title: str
    reward: str
    icon: Optional[str] = None


class StageSchema(BaseModel):
    id: str
    title: str
    date_label: Optional[str] = None
    description: Optional[str] = None


class FAQSchema(BaseModel):
    question: str
    answer: str


class IdeathonBase(BaseModel):
    title: str = Field(..., max_length=255)
    theme: str = Field(..., max_length=255)
    brief: Optional[str] = None
    description: Optional[str] = None
    problem_statement: Optional[str] = None
    banner_url: Optional[str] = None
    process_and_stages: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    rules_and_guidelines: Optional[List[str]] = Field(default_factory=list)
    faqs: Optional[List[Dict[str, str]]] = Field(default_factory=list)
    target_programs: List[str] = Field(default_factory=lambda: ["ALL"])
    target_batches: List[str] = Field(default_factory=lambda: ["ALL"])
    min_team_size: int = Field(1, ge=1, le=10)
    max_team_size: int = Field(4, ge=1, le=10)
    registration_start_at: Optional[datetime] = None
    registration_end_at: Optional[datetime] = None
    submission_start_at: Optional[datetime] = None
    submission_end_at: Optional[datetime] = None
    presentation_date: Optional[datetime] = None
    results_announced_at: Optional[datetime] = None
    lead_faculty_id: Optional[UUID] = None
    assigned_faculty_ids: List[str] = Field(default_factory=list)
    tracks: List[Dict[str, Any]] = Field(default_factory=list)
    rubrics: List[Dict[str, Any]] = Field(default_factory=list)
    prizes: List[Dict[str, Any]] = Field(default_factory=list)
    is_double_blind_screening: bool = True
    is_leaderboard_published: bool = False
    status: Optional[str] = "draft"


class IdeathonCreate(IdeathonBase):
    slug: Optional[str] = None


class IdeathonUpdate(BaseModel):
    title: Optional[str] = None
    theme: Optional[str] = None
    brief: Optional[str] = None
    description: Optional[str] = None
    problem_statement: Optional[str] = None
    banner_url: Optional[str] = None
    process_and_stages: Optional[List[Dict[str, Any]]] = None
    rules_and_guidelines: Optional[List[str]] = None
    faqs: Optional[List[Dict[str, str]]] = None
    target_programs: Optional[List[str]] = None
    target_batches: Optional[List[str]] = None
    min_team_size: Optional[int] = None
    max_team_size: Optional[int] = None
    registration_start_at: Optional[datetime] = None
    registration_end_at: Optional[datetime] = None
    submission_start_at: Optional[datetime] = None
    submission_end_at: Optional[datetime] = None
    presentation_date: Optional[datetime] = None
    results_announced_at: Optional[datetime] = None
    status: Optional[str] = None
    tracks: Optional[List[Dict[str, Any]]] = None
    rubrics: Optional[List[Dict[str, Any]]] = None
    prizes: Optional[List[Dict[str, Any]]] = None
    is_double_blind_screening: Optional[bool] = None
    is_leaderboard_published: Optional[bool] = None
    lead_faculty_id: Optional[UUID] = None
    assigned_faculty_ids: Optional[List[str]] = None


class IdeathonResponse(IdeathonBase):
    id: UUID
    slug: str
    status: str
    created_by_id: Optional[UUID] = None
    lead_faculty: Optional[Dict[str, Any]] = None
    assigned_faculties: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    total_teams: Optional[int] = 0
    total_submissions: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)


class IdeathonListResponse(BaseModel):
    items: List[IdeathonResponse]
    total: int


class IdeathonBroadcastRequest(BaseModel):
    program_ids: Optional[List[str]] = Field(default_factory=lambda: ["ALL"])
    batch_ids: Optional[List[str]] = Field(default_factory=lambda: ["ALL"])
    title: Optional[str] = None
    message: Optional[str] = None


class IdeathonBroadcastResponse(BaseModel):
    notified_count: int
    programs_targeted: List[str]
    batches_targeted: List[str]
    message: str


# -------------------------------------------------------------
# Team & Member Schemas
# -------------------------------------------------------------

class IdeathonTeamMemberResponse(BaseModel):
    id: UUID
    student_id: UUID
    student_name: str
    student_email: str
    student_prn: str
    program_name: Optional[str] = None
    batch_name: Optional[str] = None
    role: str
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IdeathonTeamCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, description="Mandatory Team or Venture Name")
    track_id: Optional[str] = None


class IdeathonTeamJoinRequest(BaseModel):
    code: str = Field(..., min_length=4, max_length=20, description="6-character unique join code")


class IdeathonTeamResponse(BaseModel):
    id: UUID
    ideathon_id: UUID
    name: str
    code: str
    leader_id: UUID
    leader_name: Optional[str] = None
    track_id: Optional[str] = None
    status: str
    members: List[IdeathonTeamMemberResponse] = Field(default_factory=list)
    has_submission: bool = False
    submission_id: Optional[UUID] = None
    created_at: datetime

class IdeathonAdminAddMemberRequest(BaseModel):
    student_id: UUID
    role: Optional[str] = "Member"


class IdeathonAdminUpdateTeamRequest(BaseModel):
    name: Optional[str] = None
    track_id: Optional[str] = None
    leader_id: Optional[UUID] = None


class IdeathonAvailableStudentResponse(BaseModel):
    id: UUID
    full_name: str
    email_official: str
    prn_number: str
    program_name: Optional[str] = None
    batch_name: Optional[str] = None
    specialization_major: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# Submission Schemas (5-Pillar Analysis)
# -------------------------------------------------------------

class IdeathonSubmissionCreate(BaseModel):
    track_id: Optional[str] = None
    title: str = Field(..., min_length=2, max_length=255, description="Product / Startup Name")
    tagline: str = Field(..., min_length=5, max_length=255, description="One-line elevator pitch")
    executive_summary: Optional[str] = None
    
    # 5 Pillars
    market_dynamics: Optional[str] = Field(None, description="Pillar 1: Market dynamics & research")
    market_gap: Optional[str] = Field(None, description="Pillar 2: Specific market gap identified")
    proposed_solution: Optional[str] = Field(None, description="Pillar 3: Solution mechanics & UVP")
    target_audience: Optional[str] = Field(None, description="Target customer personas")
    competitive_moat: Optional[str] = Field(None, description="Competitive advantages & moat")
    hyperbuild_stack: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Pillar 4: No-code tech stack plan")
    pitch_deck_url: Optional[str] = Field(None, description="Pillar 5: Pitch Deck URL")
    demo_video_url: Optional[str] = None
    prototype_url: Optional[str] = None

    is_final_submission: bool = False


class IdeathonSubmissionUpdate(BaseModel):
    track_id: Optional[str] = None
    title: Optional[str] = None
    tagline: Optional[str] = None
    executive_summary: Optional[str] = None
    market_dynamics: Optional[str] = None
    market_gap: Optional[str] = None
    proposed_solution: Optional[str] = None
    target_audience: Optional[str] = None
    competitive_moat: Optional[str] = None
    hyperbuild_stack: Optional[Dict[str, Any]] = None
    pitch_deck_url: Optional[str] = None
    demo_video_url: Optional[str] = None
    prototype_url: Optional[str] = None
    presentation_slot: Optional[str] = None
    is_final_submission: Optional[bool] = None


class IdeathonSubmissionResponse(BaseModel):
    id: UUID
    ideathon_id: UUID
    team_id: UUID
    team_name: Optional[str] = None
    team_code: Optional[str] = None
    track_id: Optional[str] = None
    title: str
    tagline: str
    executive_summary: Optional[str] = None
    market_dynamics: Optional[str] = None
    market_gap: Optional[str] = None
    proposed_solution: Optional[str] = None
    target_audience: Optional[str] = None
    competitive_moat: Optional[str] = None
    hyperbuild_stack: Optional[Dict[str, Any]] = None
    pitch_deck_url: Optional[str] = None
    demo_video_url: Optional[str] = None
    prototype_url: Optional[str] = None
    status: str
    submitted_at: Optional[datetime] = None
    presentation_slot: Optional[str] = None
    phase1_score: float = 0.0
    phase2_score: float = 0.0
    final_score: float = 0.0
    final_rank: Optional[int] = None
    award_title: Optional[str] = None
    members: Optional[List[IdeathonTeamMemberResponse]] = None
    incubated_project_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# Evaluation Schemas
# -------------------------------------------------------------

class IdeathonEvaluationCreate(BaseModel):
    round: str = Field("phase1_prelim", description="'phase1_prelim' or 'phase2_presentation'")
    scores: Dict[str, float] = Field(..., description="Rubric criterion ID -> score (e.g. 0-10)")
    feedback: Optional[str] = None
    strengths: Optional[str] = None
    improvements: Optional[str] = None
    recommendation: str = Field("consider", description="shortlist_for_pitch | award_winner | incubate_in_hyperbuild | needs_revision | reject")


class IdeathonEvaluationResponse(BaseModel):
    id: UUID
    submission_id: UUID
    judge_id: UUID
    judge_name: Optional[str] = None
    round: str
    scores: Dict[str, float]
    total_score: float
    feedback: Optional[str] = None
    strengths: Optional[str] = None
    improvements: Optional[str] = None
    recommendation: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# Leaderboard Schemas
# -------------------------------------------------------------

class IdeathonLeaderboardItem(BaseModel):
    rank: int
    submission_id: UUID
    team_id: UUID
    team_name: str
    project_title: str
    project_tagline: str
    track_id: Optional[str] = None
    lead_name: str
    members: List[str]
    phase1_score: float
    phase2_score: float
    final_score: float
    rubric_averages: Dict[str, float] = Field(default_factory=dict)
    award_title: Optional[str] = None
    podium_tier: Optional[str] = None  # "gold" | "silver" | "bronze" | None
    is_incubated: bool = False
    incubated_project_id: Optional[UUID] = None


class IdeathonLeaderboardResponse(BaseModel):
    ideathon_id: UUID
    ideathon_title: str
    is_published: bool
    total_participants: int
    podium: List[IdeathonLeaderboardItem] = Field(default_factory=list)  # Top 3
    rankings: List[IdeathonLeaderboardItem] = Field(default_factory=list)  # All ranks


# -------------------------------------------------------------
# HyperBuild Incubated Project Schemas
# -------------------------------------------------------------

class HyperbuildMilestoneCreate(BaseModel):
    title: str
    description: Optional[str] = None
    order_index: int = 1
    target_date: Optional[datetime] = None


class HyperbuildMilestoneUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    order_index: Optional[int] = None
    target_date: Optional[datetime] = None
    status: Optional[str] = None
    submission_notes: Optional[str] = None
    deliverable_urls: Optional[List[str]] = None
    review_feedback: Optional[str] = None


class HyperbuildMilestoneResponse(BaseModel):
    id: UUID
    project_id: UUID
    title: str
    description: Optional[str] = None
    order_index: int
    target_date: Optional[datetime] = None
    status: str
    submission_notes: Optional[str] = None
    deliverable_urls: List[str] = Field(default_factory=list)
    reviewed_by_id: Optional[UUID] = None
    reviewed_by_name: Optional[str] = None
    review_feedback: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HyperbuildProjectUpdate(BaseModel):
    title: Optional[str] = None
    tagline: Optional[str] = None
    problem_statement: Optional[str] = None
    solution_scope: Optional[str] = None
    mentor_faculty_id: Optional[UUID] = None
    status: Optional[str] = None
    no_code_stack: Optional[Dict[str, Any]] = None
    tool_links: Optional[Dict[str, str]] = None
    target_launch_date: Optional[datetime] = None


class HyperbuildProjectResponse(BaseModel):
    id: UUID
    submission_id: UUID
    ideathon_id: UUID
    ideathon_title: Optional[str] = None
    team_id: UUID
    team_name: str
    title: str
    tagline: str
    problem_statement: Optional[str] = None
    solution_scope: Optional[str] = None
    lead_student_id: UUID
    lead_student_name: Optional[str] = None
    mentor_faculty_id: Optional[UUID] = None
    mentor_faculty_name: Optional[str] = None
    status: str
    no_code_stack: Dict[str, Any] = Field(default_factory=dict)
    tool_links: Dict[str, str] = Field(default_factory=dict)
    target_launch_date: Optional[datetime] = None
    members: List[IdeathonTeamMemberResponse] = Field(default_factory=list)
    milestones: List[HyperbuildMilestoneResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# Certificate Schemas
# -------------------------------------------------------------

class IdeathonCertificateResponse(BaseModel):
    id: UUID
    ideathon_id: UUID
    ideathon_title: str
    student_id: UUID
    recipient_name: str
    team_name: str
    project_title: str
    certificate_type: str  # winner_1st | winner_2nd | winner_3rd | category_award | participation
    title: str
    certificate_number: str
    verification_hash: str
    issued_at: datetime

    model_config = ConfigDict(from_attributes=True)
