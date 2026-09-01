import asyncio
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.auth import User, Role, UserRole

async def bootstrap_admin():
    async with AsyncSessionLocal() as session:
        # 1. Ensure 'crc_admin' role exists
        role_stmt = select(Role).where(Role.name == "crc_admin")
        result = await session.execute(role_stmt)
        admin_role = result.scalar_one_or_none()

        if not admin_role:
            print("Creating crc_admin role...")
            admin_role = Role(name="crc_admin", description="Full system administration")
            session.add(admin_role)
            await session.commit()
            await session.refresh(admin_role)

        # 2. Check if admin user already exists
        user_stmt = select(User).where(User.email == "admin@lexiconmile.com")
        result = await session.execute(user_stmt)
        admin_user = result.unique().scalar_one_or_none()

        if admin_user:
            print("Admin user already exists. Updating password...")
            admin_user.password_hash = get_password_hash("password123")
            admin_user.full_name = "System Administrator"
        else:
            print("Creating new admin user...")
            admin_user = User(
                email="admin@lexiconmile.com",
                password_hash=get_password_hash("password123"),
                full_name="System Administrator",
                is_active=True
            )
            session.add(admin_user)
            await session.flush() # Get user ID

        # 3. Assign role
        # Remove existing roles first to avoid duplicates
        await session.execute(
            select(UserRole).where(UserRole.user_id == admin_user.id)
        )
        # Note: in a real script we'd delete, but let's just ensure the link exists
        user_role_link = UserRole(user_id=admin_user.id, role_id=admin_role.id)
        
        # Simple way to avoid unique constraint error: check first
        check_role = await session.get(UserRole, (admin_user.id, admin_role.id))
        if not check_role:
            session.add(user_role_link)

        await session.commit()
        print("Successfully bootstrapped admin: admin@lexiconmile.com / password123")

if __name__ == "__main__":
    asyncio.run(bootstrap_admin())
