import logging
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, delete
from sqlalchemy.orm import selectinload, joinedload

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
        logger.info("Seeded initial student directory records")


async def list_roles(db: AsyncSession) -> List[Role]:
    stmt = select(Role).order_by(Role.name)
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def create_user(db: AsyncSession, user_in: UserCreate) -> User:
    email = user_in.email.strip().lower()
    stmt = select(User).where(User.email == email)
    res = await db.execute(stmt)
    if res.unique().scalar_one_or_none():
        raise ValueError("A user with this email address already exists.")

    new_user = User(
        email=email,
        password_hash=get_password_hash(user_in.password),
        full_name=user_in.full_name.strip(),
        phone=user_in.phone.strip() if user_in.phone else None,
        avatar_url=user_in.avatar_url.strip() if user_in.avatar_url else None,
        is_active=user_in.is_active,
    )
    db.add(new_user)
    await db.flush()

    if user_in.role_names:
        for role_name in user_in.role_names:
            stmt_r = select(Role).where(Role.name == role_name)
            res_r = await db.execute(stmt_r)
            r = res_r.scalar_one_or_none()
            if r:
                user_role = UserRole(user_id=new_user.id, role_id=r.id)
                db.add(user_role)

    await db.commit()
    return await get_user_by_id(db, new_user.id)


async def list_users(
    db: AsyncSession,
    search: Optional[str] = None,
    role_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
    exclude_students_faculty: bool = True,
) -> List[User]:
    stmt = select(User).options(selectinload(User.roles))

    if status_filter == "active":
        stmt = stmt.where(User.is_active == True)
    elif status_filter == "inactive":
        stmt = stmt.where(User.is_active == False)

    if search:
        s = f"%{search.strip()}%"
        stmt = stmt.where(or_(User.full_name.ilike(s), User.email.ilike(s), User.phone.ilike(s)))

    res = await db.execute(stmt)
    users = list(res.unique().scalars().all())

    filtered_users = []
    for u in users:
        role_names = [r.name for r in u.roles]

        # Filter by specific role if provided
        if role_filter and role_filter != "all":
            if role_filter not in role_names:
                continue

        # If exclude_students_faculty is True (User Directory default), exclude users whose ONLY role is student or faculty
        if exclude_students_faculty and not role_filter:
            # If user only has student or faculty roles, exclude them from User Directory
            is_student_or_faculty_only = all(
                r in ["student", "faculty_internal", "faculty_external"] for r in role_names
            ) if role_names else False

            if is_student_or_faculty_only:
                continue

        filtered_users.append(u)

    return filtered_users


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    stmt = select(User).options(joinedload(User.roles)).where(User.email == email.strip().lower())
    res = await db.execute(stmt)
    return res.unique().scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: UUID | str) -> Optional[User]:
    if isinstance(user_id, str):
        user_id = UUID(user_id)
    stmt = select(User).options(joinedload(User.roles)).where(User.id == user_id)
    res = await db.execute(stmt)
    return res.unique().scalar_one_or_none()


async def update_user(db: AsyncSession, user_id: UUID, data: UserUpdate) -> User:
    user = await get_user_by_id(db, user_id)
    if not user:
        raise ValueError("User not found")

    if data.email and data.email.strip().lower() != user.email:
        new_email = data.email.strip().lower()
        stmt = select(User).where(User.email == new_email, User.id != user_id)
        res = await db.execute(stmt)
        if res.unique().scalar_one_or_none():
            raise ValueError("Another user with this email address already exists.")
        user.email = new_email

    if data.full_name is not None:
        user.full_name = data.full_name.strip()

    if data.phone is not None:
        user.phone = data.phone.strip() if data.phone else None

    if data.avatar_url is not None:
        user.avatar_url = data.avatar_url.strip() if data.avatar_url else None

    if data.is_active is not None:
        user.is_active = data.is_active

    # Update Roles if provided
    if data.role_names is not None:
        # Delete existing role mappings
        await db.execute(delete(UserRole).where(UserRole.user_id == user_id))
        await db.flush()

        for role_name in data.role_names:
            stmt_r = select(Role).where(Role.name == role_name)
            res_r = await db.execute(stmt_r)
            r = res_r.scalar_one_or_none()
            if r:
                user_role = UserRole(user_id=user.id, role_id=r.id)
                db.add(user_role)

    await db.commit()
    return await get_user_by_id(db, user_id)


async def reset_user_password(db: AsyncSession, user_id: UUID, new_password: str) -> User:
    user = await get_user_by_id(db, user_id)
    if not user:
        raise ValueError("User not found")

    if not new_password or len(new_password) < 6:
        raise ValueError("Password must be at least 6 characters long.")

    user.password_hash = get_password_hash(new_password)
    await db.commit()
    return user


async def set_user_active_status(db: AsyncSession, user_id: UUID, is_active: bool) -> User:
    user = await get_user_by_id(db, user_id)
    if not user:
        raise ValueError("User not found")

    user.is_active = is_active
    await db.commit()
    return user


async def delete_user(db: AsyncSession, user_id: UUID) -> bool:
    user = await get_user_by_id(db, user_id)
    if not user:
        raise ValueError("User not found")

    await db.delete(user)
    await db.commit()
    return True
