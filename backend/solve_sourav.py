import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def solve_sourav():
    async with AsyncSessionLocal() as session:
        # 1. Find all tables to locate where roles are stored
        tables_res = await session.execute(text(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
        ))
        tables = [row[0] for row in tables_res.fetchall()]
        print(f"TABLES:{','.join(tables)}")

        # 2. Check for a common roles table or user_roles table
        # If 'user_roles' or 'roles' exists, we'll try to join.
        # Otherwise, we'll search for 'Sourav Jha' in the users table and see what else we find.
        
        # Attempt to find Sourav by full_name first
        user_res = await session.execute(text(
            "SELECT id, email FROM users WHERE full_name = 'Sourav Jha'"
        ))
        user = user_res.fetchone()
        
        if user:
            print(f"FOUND_USER:{user.id}|{user.email}")
            # Now try to find the role for this user ID across common patterns
            for table in tables:
                if 'role' in table.lower():
                    try:
                        role_res = await session.execute(text(
                            f"SELECT * FROM {table} WHERE user_id = :uid"
                        ), {"uid": user.id})
                        role_data = role_res.fetchone()
                        if role_data:
                            print(f"ROLE_DATA_FROM_{table}:{role_data}")
                    except Exception:
                        continue
        else:
            print("USER_NOT_FOUND")

if __name__ == "__main__":
    asyncio.run(solve_sourav())
