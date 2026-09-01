import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def find_sourav():
    async with AsyncSessionLocal() as session:
        # Using the correct column 'full_name'
        result = await session.execute(text("SELECT email FROM users WHERE full_name = 'Sourav Jha' AND role = 'student'"))
        email = result.scalar()
        if email:
            print(f"FOUND:{email}")
        else:
            print("NOT_FOUND")

if __name__ == "__main__":
    asyncio.run(find_sourav())
