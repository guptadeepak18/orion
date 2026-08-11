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

logger = logging.getLogger(__name__)

OTP_EXPIRY_MINUTES = 10


async def create_registration(
    db: AsyncSession, data: StudentRegisterRequest
) -> StudentRegistration:
    """
    Create a pending student registration.
    - Validates email domain (already done by schema)
    - Checks for duplicate email or PRN
    - Hashes password
    - Generates + sends OTP
    - Saves record with status=pending_verification
    """
    email = data.email.strip().lower()

    # Check duplicate email in registrations
    existing = await db.execute(
        select(StudentRegistration).where(StudentRegistration.email == email)
    )
    if existing.scalar_one_or_none():
        raise ValueError("An account with this email address already exists or is pending review.")

    # Check duplicate email in users
    existing_user = await db.execute(
        select(User).where(User.email == email)
    )
    if existing_user.scalar_one_or_none():
        raise ValueError("An account with this email address already exists.")

    # Check duplicate PRN in registrations
    if data.prn_number:
        existing_prn_reg = await db.execute(
            select(StudentRegistration).where(
                StudentRegistration.prn_number == data.prn_number,
                StudentRegistration.status != "rejected"
            )
        )
        if existing_prn_reg.scalar_one_or_none():
            raise ValueError("A registration with this PRN number already exists.")

        # Check PRN in students table
        from app.models.student import Student as StudentModel
        existing_prn_student = await db.execute(
            select(StudentModel).where(
                StudentModel.prn_number == data.prn_number,
                StudentModel.is_deleted == False
            )
        )
        if existing_prn_student.scalar_one_or_none():
            raise ValueError("A student with this PRN number already exists in the system.")

    # Generate OTP
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


async def approve_registration(
    db: AsyncSession, reg_id: UUID, reviewed_by_user_id: UUID
) -> StudentRegistration:
    """
    Admin approves a registration.
    Creates User record, creates Student record, assigns 'student' role, marks approved.
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
        # Academic fields left as defaults — admin sets these via Student Directory
        roll_no="",
        enrollment_no="",
        email=reg.email,
        specialization_major="",
        specialization_minor="",
    )
    db.add(student)

    # Mark registration approved
    reg.status = "approved"
    reg.reviewed_by = reviewed_by_user_id

    await db.commit()
    await db.refresh(reg)
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
    return reg
