import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.ideathon import Ideathon
from app.models.auth import User
from app.services.ideathon_service import DEFAULT_RUBRICS, DEFAULT_STAGES, DEFAULT_PRIZES, DEFAULT_RULES, DEFAULT_FAQS


async def seed():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Ideathon).limit(1))
        existing = res.scalar_one_or_none()
        if existing:
            print("Ideathon already exists in database. Skipping seed.")
            return

        user_res = await db.execute(select(User).limit(1))
        admin = user_res.unique().scalar_one_or_none()
        admin_id = admin.id if admin else None

        now = datetime.now(timezone.utc)

        sample_tracks = [
            {
                "id": "fintech",
                "name": "FinTech & Intelligent WealthOps",
                "description": "Next-generation personal finance engines, fraud detection heuristics, micro-credit scoring, and treasury automation.",
                "icon": "wallet"
            },
            {
                "id": "edtech",
                "name": "EdTech & Institutional Automation",
                "description": "Student lifecycle assistants, predictive gradebook analytics, personalized learning tutors, and campus ops.",
                "icon": "graduation-cap"
            },
            {
                "id": "healthtech",
                "name": "HealthTech & Preventive Wellness",
                "description": "Patient intake routing, AI triage diagnostics, chronic care trackers, and hospital resource balancing.",
                "icon": "activity"
            },
            {
                "id": "enterprise",
                "name": "Enterprise Productivity & AI Agents",
                "description": "Multi-agent procurement bots, intelligent CRM enrichment, autonomous invoice verification, and supply chain triage.",
                "icon": "briefcase"
            }
        ]

        sample_ideathon = Ideathon(
            title="HyperBuild AI & Enterprise Innovation Ideathon 2026",
            slug="hyperbuild-innovation-2026",
            theme="HyperBuild AI & Automation: Building Scalable No-Code Enterprise Solutions",
            brief=(
                "A flagship innovation sprint bringing together brilliant analytical minds across PGDM, Global MBA, BBA, and HMCT. "
                "Teams conduct deep-dive market research, dissect real industry dynamics, uncover high-impact market gaps, "
                "and propose production-viable applications built entirely with HyperBuild's modern no-code stack."
            ),
            description=(
                "The HyperBuild Ideathon challenges students to bridge academic strategy and rapid no-code engineering. "
                "Rather than abstract concepts, participants formulate concrete product architecture, customer personas, "
                "and defensible moats. Winning ideas receive cash prizes and are incubated directly as production-grade software."
            ),
            problem_statement=(
                "Modern enterprises and consumer platforms suffer from severe workflow fragmentation, manual data entry, "
                "and lack of tailored AI intelligence. Identify a specific, underserved market niche or operational bottleneck. "
                "Formulate a defensible solution and specify its end-to-end execution utilizing FlutterFlow for UI, "
                "Supabase for relational data storage, Make/n8n for automation orchestration, and Google Gemini APIs for intelligence."
            ),
            banner_url="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1600&q=80",
            process_and_stages=DEFAULT_STAGES,
            rules_and_guidelines=DEFAULT_RULES,
            faqs=DEFAULT_FAQS,
            target_programs=["ALL"],
            target_batches=["ALL"],
            min_team_size=1,
            max_team_size=4,
            registration_start_at=now - timedelta(days=5),
            registration_end_at=now + timedelta(days=10),
            submission_start_at=now - timedelta(days=2),
            submission_end_at=now + timedelta(days=15),
            presentation_date=now + timedelta(days=20),
            results_announced_at=now + timedelta(days=22),
            status="registration_open",
            tracks=sample_tracks,
            rubrics=DEFAULT_RUBRICS,
            prizes=DEFAULT_PRIZES,
            is_double_blind_screening=True,
            is_leaderboard_published=True,
            created_by_id=admin_id,
        )

        db.add(sample_ideathon)
        await db.commit()
        print(f"Sample Ideathon '{sample_ideathon.title}' seeded successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
