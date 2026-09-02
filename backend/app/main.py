import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy import text
import logging

import app.models  # Register all models on Base.metadata
from app.core.config import settings
from app.core.database import engine, AsyncSessionLocal, Base
from app.api.v1.router import api_router
from app.services.user_service import seed_initial_data
from app.schemas.common import ErrorEnvelope, ErrorDetails

logger = logging.getLogger("app.validation_debug")


async def _neon_keepalive_loop():
    """Lightweight background heartbeat ping every 3 minutes to prevent Neon serverless auto-suspension during daytime operations."""
    while True:
        try:
            await asyncio.sleep(180)  # 3 minutes
            async with AsyncSessionLocal() as session:
                await session.execute(text("SELECT 1"))
        except asyncio.CancelledError:
            break
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    keepalive_task = None
    try:
        # Initialize DB tables for dev/testing if not created by Alembic
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        # Seed initial roles and admin
        async with AsyncSessionLocal() as db:
            await seed_initial_data(db)

        # Start keepalive heartbeat task
        keepalive_task = asyncio.create_task(_neon_keepalive_loop())
    except Exception as e:
        print(f"Startup DB initialization notice: {e}")

    yield

    if keepalive_task:
        keepalive_task.cancel()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# GZip compression for responses > 1KB (reduces payload size by up to 80%)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Set CORS
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def sanitize_empty_query_params(request: Request, call_next):
    # Strip empty query parameters (e.g. ?subject_id=&batch_id=) so Pydantic UUID fields default cleanly to None
    if request.scope.get("query_string"):
        try:
            qs = request.scope["query_string"].decode("latin-1")
            if qs:
                pairs = [p for p in qs.split("&") if p and not p.endswith("=") and not p.endswith("=null") and not p.endswith("=undefined")]
                request.scope["query_string"] = "&".join(pairs).encode("latin-1")
        except Exception:
            pass
    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Log the raw body so we can see exactly what was sent
    try:
        body = await request.body()
        print(f"[VALIDATION ERROR] {request.method} {request.url.path} body={body.decode('utf-8', errors='replace')}", flush=True)
    except Exception:
        pass
    print(f"[VALIDATION ERROR] details: {exc.errors()}", flush=True)
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content=ErrorEnvelope(
            error=ErrorDetails(
                code="INTERNAL_SERVER_ERROR",
                message=str(exc) if settings.ENVIRONMENT == "local" else "An unexpected error occurred",
            )
        ).model_dump(),
    )

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Health"])
async def root():
    return {
        "app": settings.PROJECT_NAME,
        "status": "online",
        "docs": "/docs",
        "api_v1": settings.API_V1_STR,
    }


@app.get(f"{settings.API_V1_STR}", tags=["Health"])
@app.get(f"{settings.API_V1_STR}/health", tags=["Health"])
async def api_health():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "docs": "/docs",
    }
