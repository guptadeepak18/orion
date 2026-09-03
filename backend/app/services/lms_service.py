import os
import uuid
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from sqlalchemy import select, and_, or_, func, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import UploadFile

from app.models.academic import Subject, Program, Batch, SubjectProgram, SubjectBatch, Topic
from app.models.student import Student
from app.models.auth import User
from app.models.activity import SubjectActivity
from app.models.session import Session, StudentAttendance
from app.models.lms import (
    SubjectResource, SubjectRecording, SubjectAssessment,
    AssessmentSubmission, ActivitySubmission
)
from app.schemas.lms import (
    ResourceCreate, RecordingCreate, RecordingUpdate,
    AssessmentCreate, AssessmentUpdate, SubmissionCreate, SubmissionGrade,
    ActivitySubmissionCreate, ActivitySubmissionGrade,
    SubjectAttendanceSessionItem, SubjectAttendanceResponse,
    EnrolledSubjectCard
)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "lms")
os.makedirs(UPLOAD_DIR, exist_ok=True)

class LMSService:
    async def get_student_by_user(self, db: AsyncSession, user: User) -> Optional[Student]:
        res = await db.execute(
            select(Student).where(
                (Student.user_id == user.id) |
                (Student.email_official == user.email) |
                (Student.email == user.email)
            )
        )
        return res.scalar_one_or_none()

    async def get_enrolled_subjects(
        self, db: AsyncSession, user: User, program_id: Optional[uuid.UUID] = None, batch_id: Optional[uuid.UUID] = None
    ) -> List[EnrolledSubjectCard]:
        is_student = any(r.name == "student" for r in user.roles) and not any(r.name in ["crc_admin", "crc_coordinator"] for r in user.roles)
        student = await self.get_student_by_user(db, user) if is_student else None

        # Build query for subjects (exclude deleted and archived)
        query = (
            select(Subject)
            .where(Subject.is_deleted == False, Subject.is_archived == False)
            .options(
                selectinload(Subject.programs),
                selectinload(Subject.batch_allocations).selectinload(SubjectBatch.batch),
                selectinload(Subject.batch_allocations).selectinload(SubjectBatch.faculty_internal),
                selectinload(Subject.batch_allocations).selectinload(SubjectBatch.faculty_external),
                selectinload(Subject.activities),
            )
        )

        if student:
            # Match by student's program or batch
            prog_id = student.program_id
            b_id = student.batch_id

            conditions = []
            if prog_id:
                conditions.append(Subject.programs.any(Program.id == prog_id))
            if b_id:
                conditions.append(Subject.batch_allocations.any(SubjectBatch.batch_id == b_id))
                conditions.append(Subject.batch_id == b_id)

            if conditions:
                query = query.where(or_(*conditions))
        elif program_id:
            query = query.where(Subject.programs.any(Program.id == program_id))
            if batch_id:
                query = query.where(Subject.batch_allocations.any(SubjectBatch.batch_id == batch_id))
        elif batch_id:
            query = query.where(
                or_(
                    Subject.batch_allocations.any(SubjectBatch.batch_id == batch_id),
                    Subject.batch_id == batch_id
                )
            )

        res = await db.execute(query.order_by(Subject.code.asc(), Subject.name.asc()))
        subjects = res.scalars().all()

        card_list: List[EnrolledSubjectCard] = []
        for s in subjects:
            # Get resource, recording, activity, assessment counts
            res_cnt = await db.scalar(
                select(func.count(SubjectResource.id)).where(SubjectResource.subject_id == s.id, SubjectResource.is_published == True)
            ) or 0
            rec_cnt = await db.scalar(
                select(func.count(SubjectRecording.id)).where(SubjectRecording.subject_id == s.id, SubjectRecording.is_published == True)
            ) or 0
            act_cnt = await db.scalar(
                select(func.count(SubjectActivity.id)).where(
                    SubjectActivity.subject_id == s.id,
                    SubjectActivity.is_released == True if is_student else True
                )
            ) or 0
            ass_cnt = await db.scalar(
                select(func.count(SubjectAssessment.id)).where(SubjectAssessment.subject_id == s.id, SubjectAssessment.is_published == True)
            ) or 0

            # Calculate attendance for student
            att_percentage = 100.0
            if student:
                att_stats = await self.get_student_subject_attendance(db, s.id, student.id)
                att_percentage = att_stats.attendance_percentage

            prog_names = ", ".join([p.name for p in s.programs]) if s.programs else None
            prog_id = s.programs[0].id if s.programs else None
            batch_names = ", ".join([a.batch.name for a in s.batch_allocations if a.batch]) if s.batch_allocations else None

            # Resolve assigned faculty from allocations
            fac_names = []
            for ba in (s.batch_allocations or []):
                if student and ba.batch_id != student.batch_id:
                    continue
                if ba.faculty_internal and ba.faculty_internal.full_name:
                    fac_names.append(ba.faculty_internal.full_name)
                elif ba.faculty_external and ba.faculty_external.name:
                    fac_names.append(ba.faculty_external.name)

            assigned_fac = ", ".join(list(dict.fromkeys(fac_names))) if fac_names else None

            import json
            parsed_syll = {}
            if s.syllabus:
                try:
                    parsed_syll = json.loads(s.syllabus) if isinstance(s.syllabus, str) else s.syllabus
                except Exception:
                    parsed_syll = {}

            units_cnt = len(parsed_syll.get("topics", [])) if isinstance(parsed_syll.get("topics"), list) else 0
            cases_cnt = len(parsed_syll.get("case_studies", [])) if isinstance(parsed_syll.get("case_studies"), list) else 0
            ov_text = parsed_syll.get("course_overview")
            tot_marks = parsed_syll.get("total_marks") or 100

            card_list.append(
                EnrolledSubjectCard(
                    id=s.id,
                    name=s.name,
                    code=s.code,
                    course_code=s.course_code,
                    trimester=s.trimester,
                    credits=s.credits,
                    is_non_credit=s.is_non_credit,
                    total_hours=s.total_hours or 30,
                    course_category=s.course_category or "core",
                    elective_domain=s.elective_domain,
                    program_id=prog_id,
                    program_name=prog_names,
                    batch_id=s.batch_id,
                    batch_name=batch_names,
                    faculty_name=assigned_fac,
                    attendance_percentage=att_percentage,
                    resources_count=res_cnt,
                    recordings_count=rec_cnt,
                    activities_count=act_cnt,
                    assessments_count=ass_cnt,
                    units_count=units_cnt,
                    case_studies_count=cases_cnt,
                    course_overview=ov_text,
                    total_marks=tot_marks,
                )
            )

        return card_list

    # --- Resources ---
    async def list_resources(self, db: AsyncSession, subject_id: uuid.UUID, is_student: bool = False) -> List[SubjectResource]:
        q = select(SubjectResource).where(SubjectResource.subject_id == subject_id).options(selectinload(SubjectResource.uploaded_by))
        if is_student:
            q = q.where(SubjectResource.is_published == True)
        res = await db.execute(q.order_by(desc(SubjectResource.created_at)))
        return list(res.scalars().all())

    async def create_resource(
        self, db: AsyncSession, subject_id: uuid.UUID, payload: ResourceCreate, user_id: uuid.UUID
    ) -> SubjectResource:
        r = SubjectResource(
            subject_id=subject_id,
            title=payload.title,
            description=payload.description,
            resource_type=payload.resource_type,
            file_url=payload.file_url,
            file_name=payload.file_name,
            file_size=payload.file_size,
            external_link=payload.external_link,
            unit_number=payload.unit_number,
            is_published=payload.is_published,
            uploaded_by_id=user_id,
        )
        db.add(r)
        await db.commit()
        await db.refresh(r)
        return r

    async def save_uploaded_file(self, file: UploadFile, max_size_bytes: int = 25 * 1024 * 1024) -> Dict[str, Any]:
        """
        Saves an uploaded file to Cloudflare R2 (or local fallback) using 64KB chunked streaming.
        Maintains minimal memory footprint (<64KB RAM) even under 70+ concurrent student uploads.
        """
        from app.services.storage_service import storage_service
        return await storage_service.upload_file(file, folder="lms", max_size_bytes=max_size_bytes)

    async def delete_resource(self, db: AsyncSession, resource_id: uuid.UUID) -> bool:
        r = await db.get(SubjectResource, resource_id)
        if not r:
            return False
        await db.delete(r)
        await db.commit()
        return True

    # --- Recordings ---
    async def list_recordings(self, db: AsyncSession, subject_id: uuid.UUID, is_student: bool = False) -> List[SubjectRecording]:
        q = select(SubjectRecording).where(SubjectRecording.subject_id == subject_id)
        if is_student:
            q = q.where(SubjectRecording.is_published == True)
        res = await db.execute(q.order_by(desc(SubjectRecording.recording_date), desc(SubjectRecording.created_at)))
        return list(res.scalars().all())

    async def create_recording(self, db: AsyncSession, subject_id: uuid.UUID, payload: RecordingCreate) -> SubjectRecording:
        rec = SubjectRecording(
            subject_id=subject_id,
            session_id=payload.session_id,
            title=payload.title,
            recording_url=payload.recording_url,
            recording_date=payload.recording_date or date.today(),
            duration_minutes=payload.duration_minutes,
            platform=payload.platform,
            topic_covered=payload.topic_covered,
            unit_number=payload.unit_number,
            passcode=payload.passcode,
            is_published=payload.is_published,
        )
        db.add(rec)
        await db.commit()
        await db.refresh(rec)
        return rec

    async def update_recording(self, db: AsyncSession, recording_id: uuid.UUID, payload: RecordingUpdate) -> Optional[SubjectRecording]:
        rec = await db.get(SubjectRecording, recording_id)
        if not rec:
            return None
        data = payload.model_dump(exclude_unset=True)
        for k, v in data.items():
            setattr(rec, k, v)
        await db.commit()
        await db.refresh(rec)
        return rec

    async def delete_recording(self, db: AsyncSession, recording_id: uuid.UUID) -> bool:
        rec = await db.get(SubjectRecording, recording_id)
        if not rec:
            return False
        await db.delete(rec)
        await db.commit()
        return True

    # --- Assessments ---
    async def list_assessments(
        self, db: AsyncSession, subject_id: uuid.UUID, user: User, is_student: bool = False
    ) -> List[Dict[str, Any]]:
        q = select(SubjectAssessment).where(SubjectAssessment.subject_id == subject_id).options(
            selectinload(SubjectAssessment.submissions)
        )
        if is_student:
            q = q.where(SubjectAssessment.is_published == True)
        
        res = await db.execute(q.order_by(desc(SubjectAssessment.due_date), desc(SubjectAssessment.created_at)))
        assessments = res.scalars().all()

        student = await self.get_student_by_user(db, user) if is_student else None

        output = []
        for ass in assessments:
            ass_dict = {
                "id": ass.id,
                "subject_id": ass.subject_id,
                "title": ass.title,
                "description": ass.description,
                "assessment_type": ass.assessment_type,
                "total_marks": ass.total_marks,
                "weightage_percentage": ass.weightage_percentage,
                "due_date": ass.due_date,
                "instructions": ass.instructions,
                "attachment_url": ass.attachment_url,
                "attachment_name": ass.attachment_name,
                "is_published": ass.is_published,
                "created_at": ass.created_at,
                "submissions_count": len(ass.submissions),
                "my_submission": None,
            }

            if student:
                # Find submission by this student
                sub = next((s for s in ass.submissions if s.student_id == student.id), None)
                if sub:
                    ass_dict["my_submission"] = {
                        "id": sub.id,
                        "assessment_id": sub.assessment_id,
                        "student_id": sub.student_id,
                        "student_name": student.full_name,
                        "student_prn": student.prn_number,
                        "submission_text": sub.submission_text,
                        "file_url": sub.file_url,
                        "file_name": sub.file_name,
                        "file_size": sub.file_size,
                        "submitted_at": sub.submitted_at,
                        "status": sub.status,
                        "marks_obtained": sub.marks_obtained,
                        "feedback": sub.feedback,
                        "graded_at": sub.graded_at,
                    }

            output.append(ass_dict)
        return output

    async def create_assessment(
        self, db: AsyncSession, subject_id: uuid.UUID, payload: AssessmentCreate, user_id: uuid.UUID
    ) -> SubjectAssessment:
        ass = SubjectAssessment(
            subject_id=subject_id,
            title=payload.title,
            description=payload.description,
            assessment_type=payload.assessment_type,
            total_marks=payload.total_marks,
            weightage_percentage=payload.weightage_percentage,
            due_date=payload.due_date,
            instructions=payload.instructions,
            attachment_url=payload.attachment_url,
            attachment_name=payload.attachment_name,
            is_published=payload.is_published,
            created_by_id=user_id,
        )
        db.add(ass)
        await db.commit()
        await db.refresh(ass)
        return ass

    async def update_assessment(
        self, db: AsyncSession, assessment_id: uuid.UUID, payload: AssessmentUpdate
    ) -> Optional[SubjectAssessment]:
        ass = await db.get(SubjectAssessment, assessment_id)
        if not ass:
            return None
        data = payload.model_dump(exclude_unset=True)
        for k, v in data.items():
            setattr(ass, k, v)
        await db.commit()
        await db.refresh(ass)
        return ass

    async def delete_assessment(self, db: AsyncSession, assessment_id: uuid.UUID) -> bool:
        ass = await db.get(SubjectAssessment, assessment_id)
        if not ass:
            return False
        await db.delete(ass)
        await db.commit()
        return True

    # --- Submissions & Grading ---
    async def submit_assessment(
        self, db: AsyncSession, assessment_id: uuid.UUID, user: User, payload: SubmissionCreate
    ) -> AssessmentSubmission:
        student = await self.get_student_by_user(db, user)
        if not student:
            raise ValueError("Student profile not found for this user account.")

        # Check existing submission
        res = await db.execute(
            select(AssessmentSubmission).where(
                AssessmentSubmission.assessment_id == assessment_id,
                AssessmentSubmission.student_id == student.id
            )
        )
        existing = res.scalar_one_or_none()

        if existing:
            existing.submission_text = payload.submission_text
            existing.file_url = payload.file_url
            existing.file_name = payload.file_name
            existing.file_size = payload.file_size
            existing.submitted_at = datetime.utcnow()
            existing.status = "submitted"
            await db.commit()
            await db.refresh(existing)
            return existing

        sub = AssessmentSubmission(
            assessment_id=assessment_id,
            student_id=student.id,
            submission_text=payload.submission_text,
            file_url=payload.file_url,
            file_name=payload.file_name,
            file_size=payload.file_size,
            submitted_at=datetime.utcnow(),
            status="submitted",
        )
        db.add(sub)
        await db.commit()
        await db.refresh(sub)
        return sub

    async def list_assessment_submissions(
        self, db: AsyncSession, assessment_id: uuid.UUID
    ) -> List[Dict[str, Any]]:
        res = await db.execute(
            select(AssessmentSubmission)
            .where(AssessmentSubmission.assessment_id == assessment_id)
            .options(
                selectinload(AssessmentSubmission.student),
                selectinload(AssessmentSubmission.graded_by)
            )
            .order_by(desc(AssessmentSubmission.submitted_at))
        )
        subs = res.scalars().all()
        return [
            {
                "id": s.id,
                "assessment_id": s.assessment_id,
                "student_id": s.student_id,
                "student_name": s.student.full_name if s.student else "Unknown",
                "student_prn": s.student.prn_number if s.student else "",
                "submission_text": s.submission_text,
                "file_url": s.file_url,
                "file_name": s.file_name,
                "file_size": s.file_size,
                "submitted_at": s.submitted_at,
                "status": s.status,
                "marks_obtained": s.marks_obtained,
                "graded_by_name": s.graded_by.full_name if s.graded_by else None,
                "graded_at": s.graded_at,
                "feedback": s.feedback,
            }
            for s in subs
        ]

    async def grade_assessment_submission(
        self, db: AsyncSession, submission_id: uuid.UUID, payload: SubmissionGrade, grader_id: uuid.UUID
    ) -> Optional[AssessmentSubmission]:
        sub = await db.get(AssessmentSubmission, submission_id)
        if not sub:
            return None
        sub.marks_obtained = payload.marks_obtained
        sub.feedback = payload.feedback
        sub.status = payload.status
        sub.graded_by_id = grader_id
        sub.graded_at = datetime.utcnow()
        await db.commit()
        await db.refresh(sub)
        return sub

    # --- HyperBuild Activity Submissions ---
    async def submit_activity(
        self, db: AsyncSession, activity_id: uuid.UUID, user: User, payload: ActivitySubmissionCreate
    ) -> ActivitySubmission:
        student = await self.get_student_by_user(db, user)
        if not student:
            raise ValueError("Student profile not found for this user account.")

        activity = await db.get(SubjectActivity, activity_id)
        if not activity:
            raise ValueError("Activity not found.")

        # 1. Check if activity is released
        if not activity.is_released:
            raise ValueError("This activity has not been released yet. Submissions are not accepted.")

        # 2. Check if activity is locked (either on SubjectActivity or on Timetable session)
        if activity.is_locked:
            raise ValueError(f"Submissions for this activity are locked: {activity.lock_reason or 'Closed by faculty'}.")

        try:
            from app.models.session import HyperbuildActivity, Session
            hb_stmt = (
                select(HyperbuildActivity)
                .join(Session, HyperbuildActivity.session_id == Session.id)
                .where(
                    HyperbuildActivity.subject_id == activity.subject_id,
                    HyperbuildActivity.activity_no == activity.activity_no,
                    HyperbuildActivity.is_deleted == False,
                    Session.is_deleted == False,
                )
            )
            if student.batch_id:
                hb_stmt = hb_stmt.where(Session.batch_id == student.batch_id)
            hb_res = await db.execute(hb_stmt)
            for ha in hb_res.scalars().all():
                if ha.is_submission_locked:
                    raise ValueError(f"Submissions for this activity are locked on the timetable: {ha.lock_reason or 'Closed by faculty'}.")
        except ValueError:
            raise
        except Exception as e:
            logger.warning(f"Error checking timetable lock: {e}")

        # Determine primary file vs list of files
        files_data = payload.files or []
        primary_file_url = payload.file_url or (files_data[0].get("file_url") if files_data else None)
        primary_file_name = payload.file_name or (files_data[0].get("file_name") if files_data else None)
        primary_file_size = payload.file_size or (files_data[0].get("file_size") if files_data else None)

        res = await db.execute(
            select(ActivitySubmission).where(
                ActivitySubmission.activity_id == activity_id,
                ActivitySubmission.student_id == student.id
            )
        )
        existing = res.scalar_one_or_none()
        if existing:
            # 3. Post-Grading Lock Policy: Graded submissions cannot be replaced without faculty exception
            is_graded = (existing.status == "graded" or existing.score is not None)
            if is_graded and not existing.allow_resubmission:
                raise ValueError(
                    f"This activity has already been evaluated and graded ({existing.score}/100 Marks). "
                    "Resubmission is locked unless an exception is granted by faculty or admin."
                )

            existing.submission_text = payload.submission_text
            existing.file_url = primary_file_url
            existing.file_name = primary_file_name
            existing.file_size = primary_file_size
            existing.files = files_data
            existing.ai_verification_notes = payload.ai_verification_notes
            existing.submitted_at = datetime.utcnow()
            existing.status = "submitted"
            # Consume the one-time exception
            if existing.allow_resubmission:
                existing.allow_resubmission = False

            await db.commit()
            await db.refresh(existing)
            return existing

        sub = ActivitySubmission(
            activity_id=activity_id,
            student_id=student.id,
            submission_text=payload.submission_text,
            file_url=primary_file_url,
            file_name=primary_file_name,
            file_size=primary_file_size,
            files=files_data,
            ai_verification_notes=payload.ai_verification_notes,
            submitted_at=datetime.utcnow(),
            status="submitted",
        )
        db.add(sub)
        await db.commit()
        await db.refresh(sub)
        return sub

    async def evaluate_activity_submission(
        self,
        db: AsyncSession,
        submission_id: uuid.UUID,
        peer_texts: Optional[Dict[str, str]] = None,
    ) -> Optional[ActivitySubmission]:
        from app.services.ai_evaluator import evaluate_submission_against_rubric
        from app.models.student import Student

        sub = await db.get(ActivitySubmission, submission_id)
        if not sub:
            return None
        activity = await db.get(SubjectActivity, sub.activity_id)
        if not activity:
            return None

        student = await db.get(Student, sub.student_id)
        student_name = f"{student.first_name} {student.last_name}" if student else "Student"

        ai_eval = await evaluate_submission_against_rubric(
            activity=activity,
            submission_text=sub.submission_text,
            files=sub.files or ([{"file_url": sub.file_url, "file_name": sub.file_name, "file_size": sub.file_size}] if sub.file_url else []),
            peer_texts=peer_texts,
            student_name=student_name,
        )
        sub.ai_evaluation = ai_eval
        sub.score = ai_eval.get("total_score")
        sub.grade = ai_eval.get("performance_tier")
        sub.feedback = ai_eval.get("executive_summary")
        await db.commit()
        await db.refresh(sub)
        return sub

    async def get_student_activity_submission(
        self, db: AsyncSession, activity_id: uuid.UUID, student_id: uuid.UUID
    ) -> Optional[ActivitySubmission]:
        res = await db.execute(
            select(ActivitySubmission).where(
                ActivitySubmission.activity_id == activity_id,
                ActivitySubmission.student_id == student_id
            )
        )
        return res.scalar_one_or_none()

    async def list_activity_submissions(
        self, db: AsyncSession, activity_id: uuid.UUID
    ) -> List[Dict[str, Any]]:
        res = await db.execute(
            select(ActivitySubmission)
            .where(ActivitySubmission.activity_id == activity_id)
            .options(
                selectinload(ActivitySubmission.student),
                selectinload(ActivitySubmission.graded_by)
            )
            .order_by(desc(ActivitySubmission.submitted_at))
        )
        subs = res.scalars().all()
        return [
            {
                "id": s.id,
                "activity_id": s.activity_id,
                "student_id": s.student_id,
                "student_name": s.student.full_name if s.student else "Unknown",
                "student_prn": s.student.prn_number if s.student else "",
                "submission_text": s.submission_text,
                "file_url": s.file_url,
                "file_name": s.file_name,
                "file_size": s.file_size,
                "files": s.files,
                "ai_verification_notes": s.ai_verification_notes,
                "ai_evaluation": s.ai_evaluation,
                "submitted_at": s.submitted_at,
                "status": s.status,
                "grade": s.grade,
                "score": s.score,
                "graded_by_name": s.graded_by.full_name if s.graded_by else None,
                "graded_at": s.graded_at,
                "feedback": s.feedback,
                "allow_resubmission": s.allow_resubmission,
                "resubmission_granted_at": s.resubmission_granted_at,
                "resubmission_reason": s.resubmission_reason,
            }
            for s in subs
        ]

    async def grant_resubmission_exception(
        self, db: AsyncSession, submission_id: uuid.UUID, faculty_user_id: uuid.UUID, reason: Optional[str] = None
    ) -> Optional[ActivitySubmission]:
        sub = await db.get(ActivitySubmission, submission_id)
        if not sub:
            return None
        sub.allow_resubmission = True
        sub.resubmission_granted_by_id = faculty_user_id
        sub.resubmission_granted_at = datetime.utcnow()
        sub.resubmission_reason = reason or "Faculty approved resubmission exception"
        await db.commit()
        await db.refresh(sub)
        return sub

    async def revoke_resubmission_exception(
        self, db: AsyncSession, submission_id: uuid.UUID
    ) -> Optional[ActivitySubmission]:
        sub = await db.get(ActivitySubmission, submission_id)
        if not sub:
            return None
        sub.allow_resubmission = False
        sub.resubmission_reason = None
        await db.commit()
        await db.refresh(sub)
        return sub

    async def grade_activity_submission(
        self, db: AsyncSession, submission_id: uuid.UUID, payload: ActivitySubmissionGrade, grader_id: uuid.UUID
    ) -> Optional[ActivitySubmission]:
        sub = await db.get(ActivitySubmission, submission_id)
        if not sub:
            return None
        sub.grade = payload.grade
        sub.score = payload.score
        sub.feedback = payload.feedback
        sub.status = payload.status
        sub.graded_by_id = grader_id
        sub.graded_at = datetime.utcnow()
        await db.commit()
        await db.refresh(sub)

        # Automated grade notification to student upon faculty evaluation
        try:
            import asyncio
            from app.services.gradebook_service import send_automated_activity_grade_email
            asyncio.create_task(send_automated_activity_grade_email(sub.id))
        except Exception as e:
            logger.warning(f"Could not queue automated student grade notification email: {e}")

        return sub

    # --- Subject Attendance Calculation ---
    async def get_student_subject_attendance(
        self, db: AsyncSession, subject_id: uuid.UUID, student_id: uuid.UUID
    ) -> SubjectAttendanceResponse:
        # Fetch sessions for this subject
        res = await db.execute(
            select(Session)
            .where(Session.subject_id == subject_id, Session.status == "completed")
            .options(selectinload(Session.topic))
            .order_by(Session.session_date.asc(), Session.start_time.asc())
        )
        sessions = res.scalars().all()
        total_conducted = len(sessions)

        if total_conducted == 0:
            return SubjectAttendanceResponse(
                total_sessions_conducted=0,
                sessions_attended=0,
                attendance_percentage=100.0,
                sessions_log=[]
            )

        session_ids = [s.id for s in sessions]
        att_res = await db.execute(
            select(StudentAttendance).where(
                StudentAttendance.student_id == student_id,
                StudentAttendance.session_id.in_(session_ids)
            )
        )
        attendances = {a.session_id: a for a in att_res.scalars().all()}

        attended_count = 0
        logs: List[SubjectAttendanceSessionItem] = []

        for s in sessions:
            att = attendances.get(s.id)
            status = att.status if att else "absent"
            if status in ["present", "late", "excused", "leave_approved", "od_duty", "on_duty", "on duty"]:
                attended_count += 1

            logs.append(
                SubjectAttendanceSessionItem(
                    session_id=s.id,
                    session_date=s.session_date,
                    start_time=s.start_time.strftime("%H:%M") if s.start_time else "",
                    end_time=s.end_time.strftime("%H:%M") if s.end_time else "",
                    session_type=s.session_type,
                    topic_name=s.topic.name if s.topic else None,
                    venue=s.venue,
                    status=status,
                    remarks=att.remarks if att else None
                )
            )

        pct = round((attended_count / total_conducted) * 100, 1) if total_conducted > 0 else 100.0

        return SubjectAttendanceResponse(
            total_sessions_conducted=total_conducted,
            sessions_attended=attended_count,
            attendance_percentage=pct,
            sessions_log=logs
        )

lms_service = LMSService()
