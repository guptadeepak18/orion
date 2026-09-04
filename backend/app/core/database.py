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

# For asyncpg + PgBouncer / cloud poolers, disable prepared statement cache and add command timeout
if "asyncpg" in db_url:
    connect_args["statement_cache_size"] = 0
    connect_args["command_timeout"] = 60

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
    # Optimized connection pool for cloud PostgreSQL
    engine = create_async_engine(
        db_url,
        echo=False,
        future=True,
        pool_size=10,
        max_overflow=5,
        pool_timeout=30.0,
        pool_recycle=1800,
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
        finally:
            await session.close()
