import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def inspect_users():
    async with AsyncSessionLocal() as session:
        # Get column names from information_schema
        result = await session.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"
        ))
        columns = [row[0] for row in result.fetchall()]
        print(f"COLUMNS:{','.join(columns)}")

if __name__ == "__main__":
    asyncio.run(inspect_users())
