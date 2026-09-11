from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

from app.core.config import settings

db_url = settings.DATABASE_URL
connect_args = {}

if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

for ssl_param in ["?sslmode=require", "&sslmode=require", "?sslmode=prefer", "&sslmode=prefer", "?ssl=require", "&ssl=require", "?ssl=prefer", "&ssl=prefer"]:
    if ssl_param in db_url:
        db_url = db_url.replace(ssl_param, "")
        connect_args["ssl"] = "require"

# For asyncpg + cloud PostgreSQL, disable prepared statement cache, set command timeout, and prevent lingering transactions
if "asyncpg" in db_url:
    connect_args["statement_cache_size"] = 0
    connect_args["command_timeout"] = 30
    connect_args["server_settings"] = {
        "idle_in_transaction_session_timeout": "10000",  # 10s timeout to release hung connections
        "statement_timeout": "30000",                     # 30s statement timeout
    }

# Handle SQLite for testing if needed
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine = create_async_engine(
        db_url,
        echo=False,
        future=True,
        connect_args=connect_args,
    )
else:
    # Optimized connection pool for cloud PostgreSQL (Aiven Developer-1 cap: 20 max connections total across all services)
    # Aiven background workers use 10-12 connections. 2 Cloud Run instances with max 4 connections each stay well within the cap.
    engine = create_async_engine(
        db_url,
        echo=False,
        future=True,
        pool_size=3,
        max_overflow=1,
        pool_timeout=10.0,
        pool_recycle=60,
        pool_pre_ping=True,
        connect_args=connect_args,
    )

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

from app.models.base import Base


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            if session.is_active:
                await session.rollback()
            await session.close()
