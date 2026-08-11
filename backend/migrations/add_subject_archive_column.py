"""
Migration script: Add is_archived column to subjects table.
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

DATABASE_URL = os.getenv("DATABASE_URL", "")
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)

SQL_STATEMENTS = [
    "ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;",
    "CREATE INDEX IF NOT EXISTS ix_subjects_is_archived ON subjects(is_archived);"
]


async def run():
    url = DATABASE_URL
    if "sslmode=require" in url:
        url = url.replace("?sslmode=require", "").replace("&sslmode=require", "")
        engine = create_async_engine(url, echo=True, connect_args={"ssl": True})
    else:
        engine = create_async_engine(url, echo=True)

    async with engine.begin() as conn:
        for stmt in SQL_STATEMENTS:
            await conn.execute(text(stmt))
        print("\nOK: is_archived column added to subjects table.\n")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
