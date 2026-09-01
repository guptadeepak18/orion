import asyncio
import httpx
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def debug_timetable_api():
    # The Batch ID we found earlier for Sourav/PGDM 2026-2028
    BATCH_ID = "f964ecd4-e10a-421d-ae6b-bf216f47d1b2"
    
    print(f"--- DEBUGGING API FOR BATCH: {BATCH_ID} ---")
    
    # 1. Test the database query directly ( bypass API )
    async with AsyncSessionLocal() as session:
        print("\n[1/3] Testing Direct Database Query...")
        res = await session.execute(
            text("SELECT id, subject_id, session_date FROM sessions WHERE batch_id = :bid AND is_deleted = false"),
            {"bid": BATCH_ID}
        )
        rows = res.fetchall()
        print(f"Database found {len(rows)} sessions for this batch.")
        for row in rows:
            print(f" - Session {row.id} on {row.session_date}")

    # 2. Test the actual HTTP endpoint
    print("\n[2/3] Testing HTTP Endpoint (/api/v1/sessions?batch_id=...)")
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000") as client:
        try:
            response = await client.get(f"/api/v1/sessions?batch_id={BATCH_ID}")
            print(f"HTTP Status: {response.status_code}")
            data = response.json()
            sessions = data.get("data", [])
            print(f"API returned {len(sessions)} sessions.")
            if len(sessions) > 0:
                print(f"First session date: {sessions[0].get('session_date')}")
            else:
                print("API returned an EMPTY list despite DB having data!")
        except Exception as e:
            print(f"HTTP Request Failed: {e}")

    # 3. Check for any "Hidden" filters (e.g. only showing future dates)
    async with AsyncSessionLocal() as session:
        print("\n[3/3] Checking for Date-Based Filtering...")
        # Check if any sessions are in the past
        res = await session.execute(
            text("SELECT count(*) FROM sessions WHERE batch_id = :bid AND session_date < '2026-08-30'"),
            {"bid": BATCH_ID}
        )
        past_count = res.scalar()
        print(f"Sessions in the past: {past_count}")

if __name__ == "__main__":
    asyncio.run(debug_timetable_api())
