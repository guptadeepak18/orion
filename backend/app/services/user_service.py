import logging
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.auth import User, Role, UserRole
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash

logger = logging.getLogger("crc_one.user_service")

DEFAULT_ROLES = [
    ("crc_admin", "Full System Administrator"),
    ("crc_coordinator", "Academic & Schedule Coordinator"),
    ("faculty_internal", "Internal Lexicon Faculty"),
    ("faculty_external", "Visiting / External Industry Expert"),
    ("finance", "Finance & Remuneration Officer"),
    ("approver", "Approval Officer / Director"),
    ("reporting_readonly", "Read-only Auditor"),
    ("student", "Enrolled Student"),
]

DEFAULT_USERS = [
    ("admin@lexiconmile.com", "Rajesh Gupta", "Admin@123456", ["crc_admin"]),
    ("coordinator@lexiconmile.com", "Sunil Sharma", "Admin@123456", ["crc_coordinator"]),
    ("faculty.internal@lexiconmile.com", "Prof. Amit Saxena", "Admin@123456", ["faculty_internal"]),
    ("faculty.external@lexiconmile.com", "Dr. Rohini Sen", "Admin@123456", ["faculty_external"]),
    ("finance@lexiconmile.com", "Meera Kulkarni", "Admin@123456", ["finance"]),
    ("approver@lexiconmile.com", "Dr. Priya Deshmukh", "Admin@123456", ["approver"]),
    ("auditor@lexiconmile.com", "Kavita Nair", "Admin@123456", ["reporting_readonly"]),
    ("student1@lexiconmile.com", "Aarav Sharma", "Admin@123456", ["student"]),
    ("student2@lexiconmile.com", "Ananya Verma", "Admin@123456", ["student"]),
]


async def seed_initial_data(db: AsyncSession):
    # Seed roles if they don't exist
    for role_name, desc in DEFAULT_ROLES:
        stmt = select(Role).where(Role.name == role_name)
        result = await db.execute(stmt)
        existing_role = result.scalar_one_or_none()
        if not existing_role:
            new_role = Role(name=role_name, description=desc)
            db.add(new_role)
    await db.commit()

    # Seed default users
    for email, full_name, raw_password, roles in DEFAULT_USERS:
        stmt = select(User).where(User.email == email)
        result = await db.execute(stmt)
        existing_user = result.unique().scalar_one_or_none()

        if not existing_user:
            user = User(
                email=email,
                password_hash=get_password_hash(raw_password),
                full_name=full_name,
                is_active=True,
            )
            db.add(user)
            await db.flush()

            for role_name in roles:
                stmt_role = select(Role).where(Role.name == role_name)
                res_role = await db.execute(stmt_role)
                r_obj = res_role.scalar_one_or_none()
                if r_obj:
                    user_role = UserRole(user_id=user.id, role_id=r_obj.id)
                    db.add(user_role)
            await db.commit()
            logger.info(f"Seeded default user: {email}")
        else:
            if existing_user.full_name in ["CRC System Administrator", "Academic Coordinator", "Finance Officer", "Director Approver"]:
                existing_user.full_name = full_name
                await db.commit()

    # Seed sample students if student table is empty
    from app.models.student import Student
    from app.models.academic import Program, Batch
    stmt_st = select(Student)
    res_st = await db.execute(stmt_st)
    if not res_st.scalars().all():
        # Retrieve seeded student users
        u1_res = await db.execute(select(User).where(User.email == "student1@lexiconmile.com"))
        u1 = u1_res.unique().scalar_one_or_none()
        u2_res = await db.execute(select(User).where(User.email == "student2@lexiconmile.com"))
        u2 = u2_res.unique().scalar_one_or_none()

        prog_res = await db.execute(select(Program).limit(1))
        prog = prog_res.scalar_one_or_none()

        batch_res = await db.execute(select(Batch).limit(1))
        batch = batch_res.scalar_one_or_none()

        s1 = Student(
            user_id=u1.id if u1 else None,
            first_name="Aarav",
            last_name="Sharma",
            full_name="Aarav Sharma",
            father_name="Ramesh Sharma",
            mother_name="Sunita Sharma",
            mobile_number="+91 9876543210",
            email_official="student1@lexiconmile.com",
            email_personal="aarav.sharma2026@gmail.com",
            alternate_contact_number="+91 9876500001",
            emergency_contact_number="+91 9876500002",
            emergency_contact_name="Ramesh Sharma",
            emergency_contact_relation="Father",
            blood_group="B+",
            prn_number="PRN2026001",
            program_id=prog.id if prog else None,
            batch_id=batch.id if batch else None,
            trimester=3,
            ug_degree="B.Tech (Computer Science)",
            ug_score_type="cgpa",
            ug_score=8.75,
            specialization_major="Research & Business Analytics",
            specialization_minor="Finance",
            roll_no="PRN2026001",
            enrollment_no="LEX-2026-8801",
            email="student1@lexiconmile.com",
            phone="+91 9876543210",
            cgpa=3.85,
            attendance_percentage=94.5,
            status="active",
        )
        s2 = Student(
            user_id=u2.id if u2 else None,
            first_name="Ananya",
            last_name="Verma",
            full_name="Ananya Verma",
            father_name="Deepak Verma",
            mother_name="Geeta Verma",
            mobile_number="+91 9876543211",
            email_official="student2@lexiconmile.com",
            email_personal="ananya.verma99@gmail.com",
            alternate_contact_number=None,
            emergency_contact_number="+91 9876500004",
            emergency_contact_name="Deepak Verma",
            emergency_contact_relation="Father",
            blood_group="O+",
            prn_number="PRN2026002",
            program_id=prog.id if prog else None,
            batch_id=batch.id if batch else None,
            trimester=3,
            ug_degree="BBA (Marketing & Finance)",
            ug_score_type="percentage",
            ug_score=84.2,
            specialization_major="Marketing",
            specialization_minor="Human Resources",
            roll_no="PRN2026002",
            enrollment_no="LEX-2026-8802",
            email="student2@lexiconmile.com",
            phone="+91 9876543211",
            cgpa=3.92,
            attendance_percentage=98.0,
            status="active",
        )
        db.add_all([s1, s2])
        await db.commit()
        logger.info("Seeded initial student directory records with full 20-field attributes")



async def create_user(db: AsyncSession, user_in: UserCreate) -> User:
    stmt = select(User).where(User.email == user_in.email)
    res = await db.execute(stmt)
    if res.unique().scalar_one_or_none():
        raise ValueError("User with this email already exists")

    new_user = User(
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        phone=user_in.phone,
        is_active=True,
    )
    db.add(new_user)
    await db.flush()

    for role_name in user_in.role_names:
        stmt_r = select(Role).where(Role.name == role_name)
        res_r = await db.execute(stmt_r)
        r = res_r.scalar_one_or_none()
        if r:
            user_role = UserRole(user_id=new_user.id, role_id=r.id)
            db.add(user_role)

    await db.commit()
    await db.refresh(new_user)
    return new_user


async def list_users(db: AsyncSession, page: int = 1, page_size: int = 20) -> List[User]:
    offset = (page - 1) * page_size
    stmt = select(User).where(User.is_deleted == False).offset(offset).limit(page_size)
    res = await db.execute(stmt)
    return list(res.unique().scalars().all())


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    stmt = select(User).where(User.email == email)
    res = await db.execute(stmt)
    return res.unique().scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: UUID | str) -> Optional[User]:
    if isinstance(user_id, str):
        user_id = UUID(user_id)
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    return res.unique().scalar_one_or_none()
