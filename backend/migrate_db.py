import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def migrate():
    async with AsyncSessionLocal() as session:
        try:
            await session.execute(text('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS hyperbuild_activity_no INTEGER'))
            await session.commit()
            print("Migration successful: Column 'hyperbuild_activity_no' added to sessions table.")
        except Exception as e:
            print(f"Migration failed: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
