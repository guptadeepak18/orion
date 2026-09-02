"""
Service layer for student self-registration and admin approval workflow.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.security import get_password_hash
from app.models.student_registration import StudentRegistration
from app.models.auth import User, Role, UserRole
from app.models.student import Student, StudentDivision
from app.models.academic import Division
from app.schemas.student_registration import StudentRegisterRequest
from app.services.email_service import generate_and_send_otp
from app.services.email_template_service import trigger_activity_email

logger = logging.getLogger(__name__)

OTP_EXPIRY_MINUTES = 10


async def create_registration(
    db: AsyncSession, data: StudentRegisterRequest
) -> StudentRegistration:
    """
    Create or seamlessly refresh a pending student registration.
    - Checks for active accounts in User or Student tables.
    - If an unverified registration already exists for this email, it refreshes the details
      and re-issues a fresh OTP without throwing duplicate constraint errors.
    - If an unverified registration exists for the same PRN under a stale/abandoned attempt,
      it frees the PRN so the current attempt can proceed cleanly.
    - Hashes password, generates + sends fresh OTP, sets status=pending_verification.
    """
    email = data.email.strip().lower()

    # 1. Check duplicate email in enrolled users
    existing_user = await db.execute(
        select(User).where(User.email == email)
    )
    if existing_user.scalar_one_or_none():
        raise ValueError("An active account with this email address already exists. Please sign in or reset your password.")

    # 2. Check duplicate PRN in enrolled students
    if data.prn_number:
        from app.models.student import Student as StudentModel
        existing_prn_student = await db.execute(
            select(StudentModel).where(
                StudentModel.prn_number == data.prn_number,
                StudentModel.is_deleted == False
            )
        )
        if existing_prn_student.scalar_one_or_none():
            raise ValueError(f"A student with PRN '{data.prn_number}' is already enrolled in the institution.")

    # 3. Check if PRN is tied to an unverified registration under another email address
    if data.prn_number:
        other_prn_regs = await db.execute(
            select(StudentRegistration).where(
                StudentRegistration.prn_number == data.prn_number,
                StudentRegistration.email != email,
            )
        )
        for other_r in other_prn_regs.scalars().all():
            if other_r.status == "pending_verification":
                # Stale abandoned registration with old email, purge it
                await db.delete(other_r)
            elif other_r.status in ("pending_review", "approved"):
                raise ValueError(f"A registration with PRN '{data.prn_number}' is already under review or approved.")

    # 4. Check existing registration for this email
    existing_res = await db.execute(
        select(StudentRegistration).where(StudentRegistration.email == email)
    )
    existing_reg = existing_res.scalar_one_or_none()

    if existing_reg:
        if existing_reg.status == "pending_review":
            raise ValueError("Your registration application has already been submitted and is currently pending administrator review.")
        elif existing_reg.status == "approved":
            raise ValueError("Your registration has already been approved. Please sign in to the portal.")
        
        # If pending_verification or rejected: UPGRADE / REFRESH the existing registration
        otp = generate_and_send_otp(email, f"{data.first_name} {data.last_name or ''}".strip())
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)

        existing_reg.password_hash = get_password_hash(data.password)
        existing_reg.first_name = data.first_name
        existing_reg.last_name = data.last_name
        existing_reg.full_name = f"{data.first_name} {data.last_name or ''}".strip()
        existing_reg.gender = data.gender
        existing_reg.prn_number = data.prn_number
        existing_reg.program_code = data.program_code
        existing_reg.program_name = data.program_name
        existing_reg.father_name = data.father_name
        existing_reg.mother_name = data.mother_name
        existing_reg.mobile_number = data.mobile_number
        existing_reg.email_personal = data.email_personal
        existing_reg.alternate_contact_number = data.alternate_contact_number
        existing_reg.emergency_contact_name = data.emergency_contact_name
        existing_reg.emergency_contact_number = data.emergency_contact_number
        existing_reg.emergency_contact_relation = data.emergency_contact_relation
        existing_reg.blood_group = data.blood_group
        existing_reg.ug_degree = data.ug_degree
        existing_reg.ug_score_type = data.ug_score_type
        existing_reg.ug_score = data.ug_score
        existing_reg.specialization_major = data.specialization_major
        existing_reg.specialization_minor = data.specialization_minor
        existing_reg.verification_code = otp
        existing_reg.verification_code_expires_at = expires_at
        existing_reg.is_email_verified = False
        existing_reg.status = "pending_verification"
        existing_reg.rejection_reason = None

        await db.commit()
        await db.refresh(existing_reg)
        return existing_reg

    # 5. Create Brand New Registration
    otp = generate_and_send_otp(email, f"{data.first_name} {data.last_name or ''}".strip())
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)

    reg = StudentRegistration(
        email=email,
        password_hash=get_password_hash(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        full_name=f"{data.first_name} {data.last_name or ''}".strip(),
        gender=data.gender,
        prn_number=data.prn_number,
        program_code=data.program_code,
        program_name=data.program_name,
        father_name=data.father_name,
        mother_name=data.mother_name,
        mobile_number=data.mobile_number,
        email_personal=data.email_personal,
        alternate_contact_number=data.alternate_contact_number,
        emergency_contact_name=data.emergency_contact_name,
        emergency_contact_number=data.emergency_contact_number,
        emergency_contact_relation=data.emergency_contact_relation,
        blood_group=data.blood_group,
        ug_degree=data.ug_degree,
        ug_score_type=data.ug_score_type,
        ug_score=data.ug_score,
        specialization_major=data.specialization_major,
        specialization_minor=data.specialization_minor,
        verification_code=otp,
        verification_code_expires_at=expires_at,
        is_email_verified=False,
        status="pending_verification",
    )
    db.add(reg)
    await db.commit()
    await db.refresh(reg)
    return reg


async def verify_email(db: AsyncSession, email: str, code: str) -> StudentRegistration:
    """Verify OTP. On success, set is_email_verified=True and status=pending_review."""
    email = email.strip().lower()
    reg = await db.execute(
        select(StudentRegistration).where(StudentRegistration.email == email)
    )
    reg = reg.scalar_one_or_none()
    if not reg:
        raise ValueError("No registration found for this email address.")

    if reg.is_email_verified:
        raise ValueError("Email is already verified.")

    if reg.verification_code != code:
        raise ValueError("Invalid verification code.")

    now = datetime.now(timezone.utc)
    if reg.verification_code_expires_at and reg.verification_code_expires_at < now:
        raise ValueError("Verification code has expired. Please request a new one.")

    reg.is_email_verified = True
    reg.status = "pending_review"
    reg.verification_code = None
    reg.verification_code_expires_at = None
    await db.commit()
    await db.refresh(reg)
    return reg


async def resend_verification(db: AsyncSession, email: str) -> StudentRegistration:
    """Generate a new OTP and resend verification email."""
    email = email.strip().lower()
    reg = await db.execute(
        select(StudentRegistration).where(StudentRegistration.email == email)
    )
    reg = reg.scalar_one_or_none()
    if not reg:
        raise ValueError("No registration found for this email address.")
    if reg.is_email_verified:
        raise ValueError("Email is already verified.")

    otp = generate_and_send_otp(email, reg.full_name)
    reg.verification_code = otp
    reg.verification_code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)
    await db.commit()
    await db.refresh(reg)
    return reg


async def get_registration_by_email(
    db: AsyncSession, email: str
) -> Optional[StudentRegistration]:
    email = email.strip().lower()
    res = await db.execute(
        select(StudentRegistration).where(StudentRegistration.email == email)
    )
    return res.scalar_one_or_none()


async def list_registrations(
    db: AsyncSession, status: Optional[str] = None
) -> List[StudentRegistration]:
    stmt = select(StudentRegistration).order_by(StudentRegistration.created_at.desc())
    if status:
        stmt = stmt.where(StudentRegistration.status == status)
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def get_registration(
    db: AsyncSession, reg_id: UUID
) -> Optional[StudentRegistration]:
    res = await db.execute(
        select(StudentRegistration).where(StudentRegistration.id == reg_id)
    )
    return res.scalar_one_or_none()


from app.schemas.student_registration import (
    StudentRegisterRequest,
    ApproveStudentRegistrationRequest,
)
from app.models.academic import Program, Batch


async def approve_registration(
    db: AsyncSession,
    reg_id: UUID,
    reviewed_by_user_id: UUID,
    profile_data: Optional[ApproveStudentRegistrationRequest] = None,
) -> StudentRegistration:
    """
    Admin approves a registration.
    Creates User record, creates Student record with full academic profile, assigns 'student' role, marks approved.
    """
    reg = await get_registration(db, reg_id)
    if not reg:
        raise ValueError("Registration not found.")
    if reg.status != "pending_review":
        raise ValueError(f"Cannot approve a registration with status '{reg.status}'.")

    # Fetch the 'student' role
    role_res = await db.execute(select(Role).where(Role.name == "student"))
    student_role = role_res.scalar_one_or_none()
    if not student_role:
        raise ValueError("'student' role not found in the system. Please create it first.")

    # Resolve Program (default to PGDM if not provided)
    selected_program_id = profile_data.program_id if (profile_data and profile_data.program_id) else None
    if not selected_program_id:
        prog_res = await db.execute(select(Program).where(Program.code == "PGDM"))
        prog = prog_res.scalar_one_or_none()
        if not prog:
            prog_res = await db.execute(select(Program).where(Program.name.ilike("%PGDM%")))
            prog = prog_res.scalar_one_or_none()
        selected_program_id = prog.id if prog else None

    # Resolve Batch (default to Batch 26-28 if not provided)
    selected_batch_id = profile_data.batch_id if (profile_data and profile_data.batch_id) else None
    if not selected_batch_id:
        batch_res = await db.execute(select(Batch).where(Batch.name.ilike("%26-28%")))
        batch = batch_res.scalar_one_or_none()
        if not batch:
            batch_res = await db.execute(select(Batch).where(Batch.name.ilike("%2026-2028%")))
            batch = batch_res.scalar_one_or_none()
        selected_batch_id = batch.id if batch else None

    # Create User
    user = User(
        email=reg.email,
        password_hash=reg.password_hash,
        full_name=reg.full_name,
        phone=reg.mobile_number,
        is_active=True,
    )
    db.add(user)
    await db.flush()  # get user.id

    # Assign student role
    db.add(UserRole(user_id=user.id, role_id=student_role.id))

    # Create Student record
    student = Student(
        user_id=user.id,
        first_name=reg.first_name,
        last_name=reg.last_name or "",
        full_name=reg.full_name,
        gender=reg.gender or "Not Specified",
        father_name=reg.father_name or "",
        mother_name=reg.mother_name or "",
        mobile_number=reg.mobile_number,
        email_official=reg.email,
        email_personal=reg.email_personal or "",
        alternate_contact_number=reg.alternate_contact_number,
        emergency_contact_name=reg.emergency_contact_name or "",
        emergency_contact_number=reg.emergency_contact_number or "",
        emergency_contact_relation=reg.emergency_contact_relation or "",
        blood_group=reg.blood_group or "",
        prn_number=reg.prn_number or "",
        ug_degree=reg.ug_degree or "",
        ug_score_type=reg.ug_score_type or "cgpa",
        ug_score=reg.ug_score or 0.0,
        program_id=selected_program_id,
        batch_id=selected_batch_id,
        trimester=profile_data.trimester if (profile_data and profile_data.trimester) else 1,
        roll_no=(profile_data.roll_no or "") if profile_data else "",
        enrollment_no=(profile_data.enrollment_no or "") if profile_data else "",
        specialization_major=(profile_data.specialization_major if (profile_data and profile_data.specialization_major) else (reg.specialization_major or "")),
        specialization_minor=(profile_data.specialization_minor if (profile_data and profile_data.specialization_minor) else (reg.specialization_minor or "")),
        email=reg.email,
    )
    db.add(student)
    await db.flush()

    # Assign division if specified
    if profile_data and profile_data.division_id:
        db.add(StudentDivision(student_id=student.id, division_id=profile_data.division_id))

    # Mark registration approved
    reg.status = "approved"
    reg.reviewed_by = reviewed_by_user_id

    await db.commit()
    await db.refresh(reg)

    # Fetch program and batch names for email context
    prog_name = "PGDM"
    if selected_program_id:
        p_obj = (await db.execute(select(Program).where(Program.id == selected_program_id))).scalar_one_or_none()
        if p_obj:
            prog_name = p_obj.name

    batch_name = "Batch 2026-2028"
    if selected_batch_id:
        b_obj = (await db.execute(select(Batch).where(Batch.id == selected_batch_id))).scalar_one_or_none()
        if b_obj:
            batch_name = b_obj.name

    div_name = "Division A"
    if profile_data and profile_data.division_id:
        d_obj = (await db.execute(select(Division).where(Division.id == profile_data.division_id))).scalar_one_or_none()
        if d_obj:
            div_name = d_obj.name

    # Trigger student_registration_approved email
    await trigger_activity_email(
        db=db,
        event_key="student_registration_approved",
        recipient_email=reg.email,
        context={
            "full_name": reg.full_name,
            "prn_number": reg.prn_number or "—",
            "program_name": prog_name,
            "batch_name": batch_name,
            "division_name": div_name,
            "login_url": "https://orion.dataxplore.club/login",
            "app_name": "Orion Portal",
            "support_email": "deepak.gupta@mile.education",
        },
        fallback_subject=f"Welcome to Orion — Your Registration has been Approved! (PRN: {reg.prn_number})",
        fallback_html=f"<p>Dear {reg.full_name}, your student registration has been approved. You may now log in to the Orion portal.</p>",
    )

    return reg


async def reject_registration(
    db: AsyncSession, reg_id: UUID, reason: str, reviewed_by_user_id: UUID
) -> StudentRegistration:
    reg = await get_registration(db, reg_id)
    if not reg:
        raise ValueError("Registration not found.")
    if reg.status not in ("pending_review", "pending_verification"):
        raise ValueError(f"Cannot reject a registration with status '{reg.status}'.")

    reg.status = "rejected"
    reg.rejection_reason = reason
    reg.reviewed_by = reviewed_by_user_id
    await db.commit()
    await db.refresh(reg)

    # Trigger student_registration_rejected email
    await trigger_activity_email(
        db=db,
        event_key="student_registration_rejected",
        recipient_email=reg.email,
        context={
            "full_name": reg.full_name,
            "prn_number": reg.prn_number or "—",
            "rejection_reason": reason,
            "support_email": "deepak.gupta@mile.education",
            "app_name": "Orion Portal",
        },
        fallback_subject=f"Update on your Orion Registration Application (PRN: {reg.prn_number})",
        fallback_html=f"<p>Dear {reg.full_name}, your application has been reviewed with remarks: {reason}</p>",
    )

    return reg


async def admin_resend_verification_otp(
    db: AsyncSession, reg_id: UUID
) -> StudentRegistration:
    """Admin triggers a fresh OTP dispatch to an unverified student."""
    reg = await get_registration(db, reg_id)
    if not reg:
        raise ValueError("Registration not found.")
    if reg.is_email_verified or reg.status != "pending_verification":
        raise ValueError("Email for this registration is already verified or not in pending verification state.")

    otp = generate_and_send_otp(reg.email, reg.full_name)
    reg.verification_code = otp
    reg.verification_code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)
    await db.commit()
    await db.refresh(reg)
    return reg


async def admin_manual_verify_registration(
    db: AsyncSession, reg_id: UUID, admin_user_id: Optional[UUID] = None
) -> StudentRegistration:
    """
    Admin manually marks student's email as verified (bypasses OTP).
    Moves registration to 'pending_review' state so it can be reviewed and approved.
    """
    reg = await get_registration(db, reg_id)
    if not reg:
        raise ValueError("Registration not found.")
    if reg.status not in ("pending_verification", "rejected"):
        raise ValueError(f"Cannot manually verify a registration with status '{reg.status}'.")

    reg.is_email_verified = True
    reg.status = "pending_review"
    reg.verification_code = None
    reg.verification_code_expires_at = None
    if admin_user_id:
        existing_admin = await db.execute(select(User).where(User.id == admin_user_id))
        if existing_admin.scalar_one_or_none():
            reg.reviewed_by = admin_user_id

    await db.commit()
    await db.refresh(reg)
    return reg


async def delete_registration(
    db: AsyncSession, reg_id: UUID
) -> None:
    """Admin deletes an unverified or rejected registration to free up PRN / email."""
    reg = await get_registration(db, reg_id)
    if not reg:
        raise ValueError("Registration not found.")
    if reg.status == "approved":
        raise ValueError("Approved registrations cannot be deleted directly from here. Deactivate the student record instead.")

    await db.delete(reg)
    await db.commit()


async def purge_stale_unverified_registrations(
    db: AsyncSession, older_than_hours: int = 24
) -> int:
    """Bulk purge of unverified registrations abandoned older than X hours."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=older_than_hours)
    stmt = select(StudentRegistration).where(
        StudentRegistration.status == "pending_verification",
        StudentRegistration.created_at < cutoff,
    )
    res = await db.execute(stmt)
    stale_regs = res.scalars().all()
    count = len(stale_regs)
    for r in stale_regs:
        await db.delete(r)
    await db.commit()
    return count

