"""
Migration: Add lead_faculty_id and assigned_faculty_ids to ideathons table
Run: python migrations/add_faculty_to_ideathons.py
"""
import asyncio
import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool
from sqlalchemy import text

DATABASE_URL = os.getenv("DATABASE_URL", "")
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)

for ssl_param in ["?sslmode=require", "&sslmode=require", "?sslmode=prefer", "&sslmode=prefer", "?ssl=require", "&ssl=require", "?ssl=prefer", "&ssl=prefer"]:
    if ssl_param in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace(ssl_param, "")

MIGRATION_SQL = """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ideathons' AND column_name = 'lead_faculty_id'
    ) THEN
        ALTER TABLE ideathons ADD COLUMN lead_faculty_id UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ideathons' AND column_name = 'assigned_faculty_ids'
    ) THEN
        ALTER TABLE ideathons ADD COLUMN assigned_faculty_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
    END IF;
END $$;
"""

async def run_migration():
    print("Connecting to database...")
    engine = create_async_engine(
        DATABASE_URL,
        echo=True,
        poolclass=NullPool,
        connect_args={"ssl": "require", "statement_cache_size": 0, "command_timeout": 60}
    )
    async with engine.begin() as conn:
        print("Executing migration...")
        await conn.execute(text(MIGRATION_SQL))
        print("Migration applied successfully!")

        # Verify
        res = await conn.execute(text(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ideathons' AND column_name IN ('lead_faculty_id', 'assigned_faculty_ids')"
        ))
        for row in res.fetchall():
            print(f"Verified column: {row[0]} ({row[1]})")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run_migration())
