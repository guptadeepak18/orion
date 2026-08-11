"""
Migration: Create student_registrations table
Run once: python migrations/add_student_registrations.py
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text

# Load settings
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

DATABASE_URL = os.getenv("DATABASE_URL", "")
# Ensure asyncpg dialect
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS student_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    full_name VARCHAR(255) NOT NULL,
    gender VARCHAR(50),
    prn_number VARCHAR(50),
    father_name VARCHAR(255),
    mother_name VARCHAR(255),
    mobile_number VARCHAR(50) NOT NULL,
    email_personal VARCHAR(255),
    alternate_contact_number VARCHAR(50),
    emergency_contact_name VARCHAR(255),
    emergency_contact_number VARCHAR(50),
    emergency_contact_relation VARCHAR(100),
    blood_group VARCHAR(20),
    ug_degree VARCHAR(150),
    ug_score_type VARCHAR(20),
    ug_score FLOAT,
    verification_code VARCHAR(10),
    verification_code_expires_at TIMESTAMPTZ,
    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(30) NOT NULL DEFAULT 'pending_verification',
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_registrations_email ON student_registrations(email);
CREATE INDEX IF NOT EXISTS idx_student_registrations_prn ON student_registrations(prn_number);
CREATE INDEX IF NOT EXISTS idx_student_registrations_status ON student_registrations(status);
"""


async def run():
    url = DATABASE_URL
    if "sslmode=require" in url:
        url = url.replace("?sslmode=require", "").replace("&sslmode=require", "")
        engine = create_async_engine(url, echo=True, connect_args={"ssl": True})
    else:
        engine = create_async_engine(url, echo=True)

    statements = [s.strip() for s in CREATE_TABLE_SQL.split(";") if s.strip()]
    async with engine.begin() as conn:
        for stmt in statements:
            await conn.execute(text(stmt))
        print("\nOK: student_registrations table created successfully.\n")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
