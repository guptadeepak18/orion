import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.models.auth import User, Role

async def check_admin():
    async with AsyncSessionLocal() as session:
        user_stmt = select(User).where(User.email == "admin@lexiconmile.com")
        result = await session.execute(user_stmt)
        user = result.unique().scalar_one_or_none()

        if not user:
            print("User admin@lexiconmile.com NOT FOUND in database.")
            return

        print(f"User found: {user.full_name} ({user.email})")
        print(f"Status: {'Active' if user.is_active else 'Inactive'}")
        
        roles = [role.name for role in user.roles]
        print(f"Roles: {roles}")
        
        if "crc_admin" not in roles:
            print("User is missing the 'crc_admin' role!")
        else:
            print("User has 'crc_admin' role.")

if __name__ == "__main__":
    asyncio.run(check_admin())
