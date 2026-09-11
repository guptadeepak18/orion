"""
Migration: Create Ideathon & HyperBuild Incubation tables
Run: python migrations/add_ideathon_tables.py
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

DATABASE_URL = os.getenv("DATABASE_URL", "")
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)

CREATE_TABLES_SQL = """
-- 1. Ideathons table
CREATE TABLE IF NOT EXISTS ideathons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    theme VARCHAR(255) NOT NULL,
    brief TEXT,
    description TEXT,
    problem_statement TEXT,
    banner_url VARCHAR(500),
    process_and_stages JSONB DEFAULT '[]'::jsonb,
    rules_and_guidelines JSONB DEFAULT '[]'::jsonb,
    faqs JSONB DEFAULT '[]'::jsonb,
    target_programs JSONB NOT NULL DEFAULT '["ALL"]'::jsonb,
    target_batches JSONB NOT NULL DEFAULT '["ALL"]'::jsonb,
    min_team_size INTEGER NOT NULL DEFAULT 1,
    max_team_size INTEGER NOT NULL DEFAULT 4,
    registration_start_at TIMESTAMPTZ,
    registration_end_at TIMESTAMPTZ,
    submission_start_at TIMESTAMPTZ,
    submission_end_at TIMESTAMPTZ,
    presentation_date TIMESTAMPTZ,
    results_announced_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    tracks JSONB NOT NULL DEFAULT '[]'::jsonb,
    rubrics JSONB NOT NULL DEFAULT '[]'::jsonb,
    prizes JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_double_blind_screening BOOLEAN NOT NULL DEFAULT TRUE,
    is_leaderboard_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ideathons_slug ON ideathons(slug);
CREATE INDEX IF NOT EXISTS idx_ideathons_status ON ideathons(status);
CREATE INDEX IF NOT EXISTS idx_ideathons_is_deleted ON ideathons(is_deleted);

-- 2. Ideathon Teams table
CREATE TABLE IF NOT EXISTS ideathon_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ideathon_id UUID NOT NULL REFERENCES ideathons(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    leader_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    track_id VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'registered',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ideathon_teams_ideathon_id ON ideathon_teams(ideathon_id);
CREATE INDEX IF NOT EXISTS idx_ideathon_teams_code ON ideathon_teams(code);
CREATE INDEX IF NOT EXISTS idx_ideathon_teams_leader_id ON ideathon_teams(leader_id);

-- 3. Ideathon Team Members table
CREATE TABLE IF NOT EXISTS ideathon_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ideathon_id UUID NOT NULL REFERENCES ideathons(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES ideathon_teams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'Member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ideathon_student UNIQUE (ideathon_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_ideathon_team_members_team_id ON ideathon_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_ideathon_team_members_student_id ON ideathon_team_members(student_id);

-- 4. Ideathon Submissions table
CREATE TABLE IF NOT EXISTS ideathon_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ideathon_id UUID NOT NULL REFERENCES ideathons(id) ON DELETE CASCADE,
    team_id UUID NOT NULL UNIQUE REFERENCES ideathon_teams(id) ON DELETE CASCADE,
    track_id VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    tagline VARCHAR(255) NOT NULL,
    executive_summary TEXT,
    market_dynamics TEXT,
    market_gap TEXT,
    proposed_solution TEXT,
    target_audience TEXT,
    competitive_moat TEXT,
    hyperbuild_stack JSONB DEFAULT '{}'::jsonb,
    pitch_deck_url VARCHAR(500),
    demo_video_url VARCHAR(500),
    prototype_url VARCHAR(500),
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    submitted_at TIMESTAMPTZ,
    presentation_slot VARCHAR(100),
    phase1_score FLOAT NOT NULL DEFAULT 0.0,
    phase2_score FLOAT NOT NULL DEFAULT 0.0,
    final_score FLOAT NOT NULL DEFAULT 0.0,
    final_rank INTEGER,
    award_title VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ideathon_subs_ideathon_id ON ideathon_submissions(ideathon_id);
CREATE INDEX IF NOT EXISTS idx_ideathon_subs_status ON ideathon_submissions(status);
CREATE INDEX IF NOT EXISTS idx_ideathon_subs_final_rank ON ideathon_submissions(final_rank);

-- 5. Ideathon Evaluations table
CREATE TABLE IF NOT EXISTS ideathon_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES ideathon_submissions(id) ON DELETE CASCADE,
    judge_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    round VARCHAR(30) NOT NULL DEFAULT 'phase1_prelim',
    scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    total_score FLOAT NOT NULL DEFAULT 0.0,
    feedback TEXT,
    strengths TEXT,
    improvements TEXT,
    recommendation VARCHAR(50) NOT NULL DEFAULT 'consider',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ideathon_evals_sub_id ON ideathon_evaluations(submission_id);
CREATE INDEX IF NOT EXISTS idx_ideathon_evals_judge_id ON ideathon_evaluations(judge_id);

-- 6. HyperBuild Incubated Projects table
CREATE TABLE IF NOT EXISTS hyperbuild_incubated_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL UNIQUE REFERENCES ideathon_submissions(id) ON DELETE CASCADE,
    ideathon_id UUID NOT NULL REFERENCES ideathons(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES ideathon_teams(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    tagline VARCHAR(255) NOT NULL,
    problem_statement TEXT,
    solution_scope TEXT,
    lead_student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    mentor_faculty_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'onboarding',
    no_code_stack JSONB NOT NULL DEFAULT '{}'::jsonb,
    tool_links JSONB NOT NULL DEFAULT '{}'::jsonb,
    target_launch_date TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hb_incubated_ideathon_id ON hyperbuild_incubated_projects(ideathon_id);
CREATE INDEX IF NOT EXISTS idx_hb_incubated_status ON hyperbuild_incubated_projects(status);
CREATE INDEX IF NOT EXISTS idx_hb_incubated_lead_student ON hyperbuild_incubated_projects(lead_student_id);

-- 7. HyperBuild Project Milestones table
CREATE TABLE IF NOT EXISTS hyperbuild_project_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES hyperbuild_incubated_projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 1,
    target_date TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    submission_notes TEXT,
    deliverable_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    reviewed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    review_feedback TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hb_milestones_project_id ON hyperbuild_project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_hb_milestones_status ON hyperbuild_project_milestones(status);

-- 8. Ideathon Certificates table
CREATE TABLE IF NOT EXISTS ideathon_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ideathon_id UUID NOT NULL REFERENCES ideathons(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES ideathon_teams(id) ON DELETE CASCADE,
    certificate_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255) NOT NULL,
    team_name VARCHAR(150) NOT NULL,
    project_title VARCHAR(255) NOT NULL,
    certificate_number VARCHAR(100) NOT NULL UNIQUE,
    verification_hash VARCHAR(64) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ideathon_certs_ideathon ON ideathon_certificates(ideathon_id);
CREATE INDEX IF NOT EXISTS idx_ideathon_certs_student ON ideathon_certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_ideathon_certs_number ON ideathon_certificates(certificate_number);
"""


async def run():
    url = DATABASE_URL
    connect_args = {}
    for ssl_param in ["?sslmode=require", "&sslmode=require", "?sslmode=prefer", "&sslmode=prefer"]:
        if ssl_param in url:
            url = url.replace(ssl_param, "")
            connect_args["ssl"] = "require"

    print(f"Connecting to database to run Ideathon tables migration...")
    engine = create_async_engine(url, echo=False, connect_args=connect_args)

    statements = [s.strip() for s in CREATE_TABLES_SQL.split(";") if s.strip()]
    async with engine.begin() as conn:
        for stmt in statements:
            await conn.execute(text(stmt))
    
    print("\nSUCCESS: All 8 Ideathon & HyperBuild Incubation tables created successfully on database.\n")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
