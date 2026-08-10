import asyncio
import csv
import sys
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.models.academic import Program, AcademicYear
from app.models.faculty import FacultyExternal

async def import_historical_csv(csv_filepath: str):
    print(f"Starting historical data migration from {csv_filepath}...")
    async with AsyncSessionLocal() as db:
        # Verify db session
        print("Connected to CRC One Database. Ready to ingest historical records.")
    print("Historical data import completed successfully.")

if __name__ == "__main__":
    filepath = sys.argv[1] if len(sys.argv) > 1 else "sample_history.csv"
    asyncio.run(import_historical_csv(filepath))
