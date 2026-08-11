"""
Migration script: Add term_type, term_number, term_label to subject_batches table.
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
    "ALTER TABLE subject_batches ADD COLUMN IF NOT EXISTS term_type VARCHAR(50) NOT NULL DEFAULT 'trimester';",
    "ALTER TABLE subject_batches ADD COLUMN IF NOT EXISTS term_number INTEGER NOT NULL DEFAULT 1;",
    "ALTER TABLE subject_batches ADD COLUMN IF NOT EXISTS term_label VARCHAR(100);",
    # Set default term_label from existing subjects trimester where null
    """
    UPDATE subject_batches sb
    SET term_label = 'Trimester ' || COALESCE(s.trimester, 1),
        term_number = COALESCE(s.trimester, 1)
    FROM subjects s
    WHERE sb.subject_id = s.id AND sb.term_label IS NULL;
    """
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
        print("\nOK: subject_batches term fields added successfully.\n")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
