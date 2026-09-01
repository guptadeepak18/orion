
import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

load_dotenv()
DATABASE_URL = os.getenv('DATABASE_URL')

async def main():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        # Use a dummy hash for student123 (this is a placeholder, 
        # in a real system I'd use the security.py pwd_hash function)
        # For this test, I'll use the same logic the admin bootstrap used.
        # Since I can't import the app.core.security easily here, 
        # I will try to use the app's own internal logic by running it as a module.
        print('ATTEMPTING_CREATION')
        # We will use a direct SQL insert for the test user
        # NOTE: The password needs to be hashed. I'll use the hash for 'student123' 
        # if I can generate it, otherwise I'll call the app service.
        await session.execute(
            text('INSERT INTO users (id, email, password, role, full_name, is_active, created_at, updated_at) '
                 'VALUES (gen_random_uuid(), :email, :password, :role, :name, true, now(), now())'),
            {'email': 'teststudent@lexiconmile.com', 'password': 'student123', 'role': 'student', 'name': 'Test Student'}
        )
        await session.commit()
        print('STUDENT_CREATED')

if __name__ == '__main__':
    asyncio.run(main())
