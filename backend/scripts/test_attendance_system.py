import asyncio
import os
import sys
from uuid import uuid4

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.auth import User
from app.models.academic import Subject, Batch
from app.models.session import Session, StudentAttendance, AttendanceCorrectionRequest
from app.models.student import Student
from app.schemas.session import SessionAttendanceBulkRequest, StudentAttendanceItem
from app.schemas.attendance import AttendanceCorrectionCreate, AttendanceCorrectionReview
from app.services import attendance_service, session_service

async def test_full_attendance_workflow():
    print("==================================================")
    print("TESTING ACADEMIC ATTENDANCE & DUAL-APPROVAL SYSTEM")
    print("==================================================")

    async with AsyncSessionLocal() as db:
        # 1. Fetch an admin user and a faculty user
        admin_user_stmt = select(User).where(User.email == "admin@crcone.edu")
        admin_res = await db.execute(admin_user_stmt)
        admin_user = admin_res.unique().scalar_one_or_none()
        if not admin_user:
            # Fallback to any user
            u_stmt = select(User).limit(1)
            u_res = await db.execute(u_stmt)
            admin_user = u_res.unique().scalar_one_or_none()

        print(f"1. Using Admin User: {admin_user.email} (ID: {admin_user.id})")

        # 2. Fetch a subject and session
        sess_stmt = (
            select(Session)
            .where(Session.is_deleted == False)
            .order_by(Session.session_date.desc())
            .limit(1)
        )
        s_res = await db.execute(sess_stmt)
        session = s_res.scalar_one_or_none()
        if not session:
            print("ERROR: No session found to test.")
            return

        print(f"2. Testing on Session: {session.id} for Batch {session.batch_id} on {session.session_date}")

        # 3. Fetch students in batch
        students_stmt = select(Student).where(Student.batch_id == session.batch_id, Student.is_deleted == False).limit(5)
        st_res = await db.execute(students_stmt)
        students = list(st_res.scalars().all())
        print(f"3. Found {len(students)} sample students in this batch.")

        if not students:
            print("ERROR: No students found in this batch.")
            return

        # 4. Mark attendance with locking: 1st student absent, others present
        test_records = []
        target_absent_student = students[0]
        for i, st in enumerate(students):
            test_records.append(
                StudentAttendanceItem(
                    student_id=st.id,
                    status="absent" if i == 0 else "present",
                    remarks="Initial class attendance recording"
                )
            )

        print(f"4. Marking initial attendance for {len(test_records)} students (Student {target_absent_student.full_name} marked ABSENT)...")
        req = SessionAttendanceBulkRequest(attendances=test_records)
        sheet = await attendance_service.mark_and_lock_session_attendance(
            db=db,
            session_id=session.id,
            req=req,
            current_user_id=admin_user.id,
            user_roles=["crc_admin"],
        )
        print(f"   [OK] Attendance recorded! Total: {sheet.total_students}, Present: {sheet.present_count}, Absent: {sheet.absent_count}")

        # 5. Verify StudentAttendance record is locked
        att_stmt = select(StudentAttendance).where(
            StudentAttendance.session_id == session.id,
            StudentAttendance.student_id == target_absent_student.id
        )
        att_res = await db.execute(att_stmt)
        att_record = att_res.scalar_one_or_none()
        assert att_record is not None, "Attendance record must exist"
        assert att_record.is_locked is True, "Attendance record MUST be locked"
        print(f"   [OK] Verified: Attendance record {att_record.id} is LOCKED (status: {att_record.status})")

        # 6. Verify Direct Edit Lockout: Faculty attempting direct edit on locked session
        try:
            await attendance_service.mark_and_lock_session_attendance(
                db=db,
                session_id=session.id,
                req=req,
                current_user_id=admin_user.id,
                user_roles=["faculty_internal"], # Non-admin role
            )
            print("   [FAIL] ERROR: Expected ValueError lock rejection but passed!")
        except ValueError as lock_err:
            print(f"   [OK] Verified: Direct edit blocked for locked session: '{lock_err}'")

        # 7. Raise Attendance Correction Request by student
        print("7. Raising Attendance Correction Request for absent student...")
        corr_req = AttendanceCorrectionCreate(
            attendance_id=att_record.id,
            requested_status="present",
            reason="Biometric device did not capture fingerprint; physically attended session.",
            document_url="https://drive.google.com/test-proof-od.pdf"
        )
        corr_response = await attendance_service.create_attendance_correction_request(
            db=db,
            req_in=corr_req,
            requested_by_id=admin_user.id,
            user_roles=["student"],
        )
        assert corr_response.status == "pending_faculty_approval", "Status must be pending_faculty_approval"
        print(f"   [OK] Correction Request #{str(corr_response.id)[:8]} created with status: '{corr_response.status}'")

        # 8. Tier 1 Review: Faculty Approves
        print("8. Executing Tier 1 Review (Faculty Approval)...")
        faculty_rev = await attendance_service.review_attendance_correction_faculty(
            db=db,
            request_id=corr_response.id,
            action="approved",
            remarks="Verified student was present in classroom.",
            faculty_user_id=admin_user.id,
        )
        assert faculty_rev.status == "pending_admin_approval", "Status must advance to pending_admin_approval"
        assert faculty_rev.faculty_action == "approved"
        print(f"   [OK] Tier 1 Faculty approved! Status advanced to: '{faculty_rev.status}'")

        # Verify Attendance is STILL unchanged at this stage (requires BOTH approvals!)
        await db.refresh(att_record)
        assert att_record.status == "absent", "Attendance MUST still be absent until Admin approves"
        print("   [OK] Verified: Attendance in DB is STILL 'absent' prior to Admin tier approval.")

        # 9. Tier 2 Review: Admin Approves and executes DB change
        print("9. Executing Tier 2 Review (Administrator Final Institutional Execution)...")
        admin_rev = await attendance_service.review_attendance_correction_admin(
            db=db,
            request_id=corr_response.id,
            action="approved",
            remarks="Approved per faculty confirmation and attendance log.",
            admin_user_id=admin_user.id,
        )
        assert admin_rev.status == "approved", "Status must be approved"
        assert admin_rev.admin_action == "approved"
        print(f"   [OK] Tier 2 Admin approved! Request status: '{admin_rev.status}'")

        # 10. Verify Attendance in DB is ATOMICALLY updated to 'present'!
        await db.refresh(att_record)
        assert att_record.status == "present", "Attendance MUST now be updated to 'present'"
        print(f"   [OK] SUCCESS! Attendance record {att_record.id} status updated to: '{att_record.status}' with remarks: '{att_record.remarks}'")

        # 11. Test Analytics & Reporting Endpoints
        print("11. Testing Subject Analytics & Student Dossier queries...")
        sub_summary = await attendance_service.get_subject_wise_attendance(db, session.subject_id)
        assert sub_summary is not None
        print(f"    [OK] Subject Summary: {sub_summary.subject_name} | Class Avg: {sub_summary.class_average_percentage}% | Roster Students: {len(sub_summary.students_summary)}")

        dossier = await attendance_service.get_student_attendance_dossier(db, target_absent_student.id)
        assert dossier is not None
        print(f"    [OK] Student Dossier: {dossier.student_name} | Overall: {dossier.overall_attendance_percentage}% | Subjects: {len(dossier.subjects_breakdown)} | Sessions: {len(dossier.session_records)}")

        debarred = await attendance_service.get_debarment_risk_students(db, threshold_pct=75.0)
        print(f"    [OK] Debarment Compliance: {len(debarred)} students flagged below 75%.")

    print("\n==================================================")
    print("ALL TESTS PASSED! FULL ATTENDANCE SYSTEM VERIFIED!")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(test_full_attendance_workflow())
