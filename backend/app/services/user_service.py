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
    ("admin@lexiconmile.com", "Deepak Gupta", "Admin@123456", ["crc_admin"]),
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

    # Seed default system admin if not existing
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
