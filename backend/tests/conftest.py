import asyncio
import pytest
import pytest_asyncio
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.main import app
from app.core.database import get_db
from app.models import Base
from app.core.security import get_password_hash, create_access_token
from app.models.auth import User, Role, UserRole

# Use in-memory SQLite for testing
import os
from sqlalchemy.pool import NullPool

TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

engine_test = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
    poolclass=NullPool,
)
TestingSessionLocal = async_sessionmaker(
    bind=engine_test, class_=AsyncSession, expire_on_commit=False
)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with engine_test.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        # Seed default roles
        roles = [
            Role(name="crc_admin", description="Admin"),
            Role(name="crc_coordinator", description="Coordinator"),
            Role(name="faculty_internal", description="Internal Faculty"),
            Role(name="faculty_external", description="External Faculty"),
            Role(name="finance", description="Finance"),
            Role(name="approver", description="Approver"),
            Role(name="reporting_readonly", description="Readonly"),
        ]
        session.add_all(roles)
        await session.commit()

        yield session

    async with engine_test.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def _get_test_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_test_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver/api/v1") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    from sqlalchemy import select
    res = await db_session.execute(select(Role).where(Role.name == "crc_admin"))
    admin_role = res.scalar_one()

    user = User(
        email="admin_test@lexiconmile.com",
        password_hash=get_password_hash("Password123!"),
        full_name="Admin Test User",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    db_session.add(UserRole(user_id=user.id, role_id=admin_role.id))
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def admin_token(admin_user: User) -> str:
    return create_access_token(subject=admin_user.id, roles=["crc_admin"])
