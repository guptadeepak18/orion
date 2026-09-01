import asyncio
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.core.database import engine

async def migrate():
    print("Running attendance tables migration...")
    async with engine.begin() as conn:
        # 1. Add is_locked, locked_at, locked_by columns to student_attendances if they don't exist
        print("Checking student_attendances columns...")
        await conn.execute(text("""
            ALTER TABLE student_attendances 
            ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE NOT NULL;
        """))
        await conn.execute(text("""
            ALTER TABLE student_attendances 
            ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
        """))
        await conn.execute(text("""
            ALTER TABLE student_attendances 
            ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES users(id) ON DELETE SET NULL;
        """))

        # 2. Create attendance_correction_requests table
        print("Creating attendance_correction_requests table...")
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS attendance_correction_requests (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                attendance_id UUID NOT NULL REFERENCES student_attendances(id) ON DELETE CASCADE,
                session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                requested_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                current_status VARCHAR(30) NOT NULL,
                requested_status VARCHAR(30) NOT NULL,
                reason TEXT NOT NULL,
                document_url VARCHAR(500),
                status VARCHAR(50) DEFAULT 'pending_faculty_approval' NOT NULL,
                faculty_approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
                faculty_action VARCHAR(30),
                faculty_acted_at TIMESTAMPTZ,
                faculty_remarks TEXT,
                admin_approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
                admin_action VARCHAR(30),
                admin_acted_at TIMESTAMPTZ,
                admin_remarks TEXT,
                resolved_at TIMESTAMPTZ,
                audit_trail JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
            );
        """))
        
        # Create indexes
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_att_corr_status ON attendance_correction_requests(status);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_att_corr_session ON attendance_correction_requests(session_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_att_corr_student ON attendance_correction_requests(student_id);
        """))

    print("Attendance tables migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(migrate())
