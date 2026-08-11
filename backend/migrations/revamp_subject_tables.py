"""
Migration script: Revamp Subject tables and add multi-program/multi-batch associations with dates.
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
    # 1. Add new columns to subjects table if they don't exist
    "ALTER TABLE subjects ADD COLUMN IF NOT EXISTS trimester INTEGER NOT NULL DEFAULT 1;",
    "ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_non_credit BOOLEAN NOT NULL DEFAULT FALSE;",
    "ALTER TABLE subjects ADD COLUMN IF NOT EXISTS syllabus TEXT;",
    "ALTER TABLE subjects ADD COLUMN IF NOT EXISTS session_plan TEXT;",
    "ALTER TABLE subjects ADD COLUMN IF NOT EXISTS hyperbuild_activities TEXT;",
    "ALTER TABLE subjects ALTER COLUMN batch_id DROP NOT NULL;",

    # 2. Create subject_programs table
    """
    CREATE TABLE IF NOT EXISTS subject_programs (
        subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
        program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
        PRIMARY KEY (subject_id, program_id)
    );
    """,

    # 3. Create subject_batches table
    """
    CREATE TABLE IF NOT EXISTS subject_batches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
        start_date DATE,
        end_date DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_subject_batches_subject ON subject_batches(subject_id);",
    "CREATE INDEX IF NOT EXISTS idx_subject_batches_batch ON subject_batches(batch_id);",

    # 4. Populate subject_batches from existing batch_id in subjects where not null
    """
    INSERT INTO subject_batches (subject_id, batch_id)
    SELECT id, batch_id FROM subjects
    WHERE batch_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM subject_batches sb WHERE sb.subject_id = subjects.id AND sb.batch_id = subjects.batch_id
      );
    """,

    # 5. Populate subject_programs from batches table program_id for existing subjects
    """
    INSERT INTO subject_programs (subject_id, program_id)
    SELECT s.id, b.program_id
    FROM subjects s
    JOIN batches b ON s.batch_id = b.id
    WHERE b.program_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM subject_programs sp WHERE sp.subject_id = s.id AND sp.program_id = b.program_id
      );
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
        print("\nOK: Subject tables revamped successfully.\n")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
