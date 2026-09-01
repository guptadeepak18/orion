from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import app.models  # Register all models on Base.metadata
from app.core.config import settings
from app.core.database import engine, AsyncSessionLocal, Base
from app.api.v1.router import api_router
from app.services.user_service import seed_initial_data
from app.schemas.common import ErrorEnvelope, ErrorDetails


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        # Initialize DB tables for dev/testing if not created by Alembic
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        # Seed initial roles and admin
        async with AsyncSessionLocal() as db:
            await seed_initial_data(db)
    except Exception as e:
        print(f"Startup DB initialization notice: {e}")

    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# Set CORS
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
