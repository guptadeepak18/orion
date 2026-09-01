import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def trace_sourav_timetable():
    async with AsyncSessionLocal() as session:
        print("--- STEP 1: Tracing Sourav Jha ---")
        user_res = await session.execute(text("SELECT id, email FROM users WHERE full_name = 'Sourav Jha'"))
        user = user_res.fetchone()
        if not user:
            print("ERROR: User Sourav Jha not found.")
            return
        print(f"User ID: {user.id} | Email: {user.email}")

        student_res = await session.execute(text("SELECT id, batch_id FROM students WHERE user_id = :uid"), {"uid": user.id})
        student = student_res.fetchone()
        if not student:
            print("ERROR: Student profile for Sourav not found.")
            return
        print(f"Student ID: {student.id} | Student Batch ID: {student.batch_id}")

        print("\n--- STEP 2: Tracing the Batch ---")
        batch_res = await session.execute(text("SELECT id, name FROM batches WHERE name = 'PGDM Batch 2026-2028'"))
        batch = batch_res.fetchone()
        if not batch:
            print("ERROR: Batch 'PGDM Batch 2026-2028' not found.")
            return
        print(f"Batch ID: {batch.id} | Batch Name: {batch.name}")

        print("\n--- STEP 3: Auditing the Link ---")
        if student.batch_id == batch.id:
            print("SUCCESS: Student is correctly linked to the batch.")
        else:
            print(f"MISMATCH: Student batch ({student.batch_id}) != Target batch ({batch.id})")
            print("FIXING: Updating student batch_id now...")
            await session.execute(
                text("UPDATE students SET batch_id = :bid WHERE id = :sid"),
                {"bid": batch.id, "sid": student.id}
            )
            await session.commit()
            print("FIXED: Student linked to correct batch.")

        print("\n--- STEP 4: Verifying Scheduled Sessions ---")
        session_res = await session.execute(
            text("SELECT s.id, sub.name, s.session_date FROM sessions s JOIN subjects sub ON s.subject_id = sub.id WHERE s.batch_id = :bid AND s.is_deleted = false"),
            {"bid": batch.id}
        )
        sessions = session_res.fetchall()
        if sessions:
            print(f"FOUND {len(sessions)} sessions for this batch:")
            for s in sessions:
                print(f" - {s.name} on {s.session_date}")
        else:
            print("ERROR: No sessions found for this batch. Check if sessions are actually scheduled for this batch ID.")

if __name__ == "__main__":
    asyncio.run(trace_sourav_timetable())
