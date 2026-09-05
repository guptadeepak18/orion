"""
Command-Line Utility for HyperBuild Activity Document Ingestion
Reads course PDF or DOCX files and creates missing activities in the database.
Preserves existing activities and student submissions by default.

Usage:
    python scripts/import_activities.py path/to/document.pdf
    python scripts/import_activities.py path/to/document.pdf --subject "Statistics for Managers"
    python scripts/import_activities.py --folder path/to/folder_with_pdfs
    python scripts/import_activities.py path/to/document.pdf --overwrite
"""

import os
import sys
import argparse
import asyncio
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.stdout.reconfigure(encoding='utf-8')

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.academic import Subject
from app.services.activity_importer import import_activities_from_document


async def process_file(file_path: str, subject_name: str = None, overwrite: bool = False):
    p = Path(file_path)
    if not p.exists():
        print(f"[ERROR] File not found: {file_path}")
        return False

    print("=" * 80)
    print(f"PROCESSING DOCUMENT: {p.name}")
    print("=" * 80)

    with open(p, "rb") as f:
        file_bytes = f.read()

    async with AsyncSessionLocal() as db:
        subj_id = None
        if subject_name:
            stmt = select(Subject).where(Subject.name.ilike(f"%{subject_name}%"))
            res = await db.execute(stmt)
            subj = res.scalar_one_or_none()
            if subj:
                subj_id = subj.id
                print(f"Target Subject specified: {subj.name} ({subj.code})")
            else:
                print(f"[WARNING] Could not find subject matching '{subject_name}'. Will attempt auto-detection from document.")

        try:
            report = await import_activities_from_document(
                db=db,
                subject_id=subj_id,
                file_bytes=file_bytes,
                filename=p.name,
                overwrite_existing=overwrite
            )

            print(f"\nDOCUMENT INGESTION REPORT:")
            print(f"  Subject: {report['subject_name']} ({report['subject_code']})")
            print(f"  Total Activities Found in Document: {report['total_activities_found']}")
            print(f"  Newly Created Activities: {report['created_count']}")
            print(f"  Skipped (Already in LMS): {report['skipped_count']}")
            if report.get('updated_count'):
                print(f"  Updated Activities: {report['updated_count']}")

            if report['created_activities']:
                print("\n  [+] CREATED ACTIVITIES:")
                for ca in report['created_activities']:
                    print(f"      - Act #{ca['activity_no']}: {ca['title']}")

            if report['skipped_activities']:
                print("\n  [*] PRESERVED / SKIPPED ACTIVITIES (Existing Student Submissions Protected):")
                for sa in report['skipped_activities']:
                    print(f"      - Act #{sa['activity_no']}: {sa['title']} (Skipped)")

            print("\n[SUCCESS] Document processing finished successfully!")
            return True

        except Exception as e:
            print(f"\n[ERROR] Ingestion failed: {e}")
            import traceback
            traceback.print_exc()
            return False


async def main():
    parser = argparse.ArgumentParser(description="Ingest HyperBuild activities from PDF/DOCX documents into LMS")
    parser.add_argument("files", nargs="*", help="Path to PDF or DOCX file(s)")
    parser.add_argument("--folder", help="Path to folder containing PDF/DOCX documents to ingest")
    parser.add_argument("--subject", help="Optional name of target subject (e.g. 'Statistics for Managers')")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing activities (default: False - preserve existing)")

    args = parser.parse_args()

    files_to_process = list(args.files)
    if args.folder:
        folder_path = Path(args.folder)
        if folder_path.exists() and folder_path.is_dir():
            for ext in ["*.pdf", "*.docx"]:
                files_to_process.extend(str(f) for f in folder_path.glob(ext))
        else:
            print(f"[ERROR] Folder does not exist: {args.folder}")
            return

    if not files_to_process:
        parser.print_help()
        return

    success_count = 0
    for f in files_to_process:
        ok = await process_file(f, subject_name=args.subject, overwrite=args.overwrite)
        if ok:
            success_count += 1

    print("\n" + "=" * 80)
    print(f"ALL JOBS COMPLETE: {success_count}/{len(files_to_process)} document(s) successfully processed.")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
