import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.session import Session
from app.models.activity import SubjectActivity

async def check():
    async with AsyncSessionLocal() as session:
        # Check for HyperBuild sessions
        res = await session.execute(select(Session).where(Session.session_type == 'hyperbuild'))
        sessions = res.scalars().all()
        print(f"HyperBuild Sessions: {len(sessions)}")
        for s in sessions:
            print(f"Session {s.id}: Subject {s.subject_id}, Act No {s.hyperbuild_activity_no}")

        # Check for released activities
        res_act = await session.execute(select(SubjectActivity).where(SubjectActivity.is_released == True))
        acts = res_act.scalars().all()
        print(f"Released Activities: {len(acts)}")
        for a in acts:
            print(f"Activity {a.id}: {a.title} (Subject {a.subject_id})")

if __name__ == "__main__":
    asyncio.run(check())
