import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, FileResponse
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


async def _background_startup_tasks():
    try:
        await asyncio.sleep(1)
        async with AsyncSessionLocal() as session:
            await seed_initial_data(session)
            from app.services.student_service import sync_all_unlinked_students_to_users
            synced = await sync_all_unlinked_students_to_users(session)
            if synced > 0:
                print(f"[STARTUP] Synchronized and provisioned {synced} student user accounts with default credentials.")
    except Exception as e:
        print(f"[STARTUP NOTICE] Background startup task notice: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    keepalive_task = None
    startup_task = None
    try:
        # Start keepalive heartbeat task to keep connection warm
        keepalive_task = asyncio.create_task(_neon_keepalive_loop())
        # Run DB seed & sync in background so HTTP server opens immediately
        startup_task = asyncio.create_task(_background_startup_tasks())
    except Exception as e:
        print(f"Startup notice: {e}")

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

from app.api.v1.websocket import router as ws_router

app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(ws_router, prefix="/ws", tags=["WebSocket"])


@app.get(f"{settings.API_V1_STR}", tags=["Health"])
@app.get(f"{settings.API_V1_STR}/health", tags=["Health"])
async def api_health():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "docs": "/docs",
    }


# Static Frontend Files Mount & React SPA Router
STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static"))
if not os.path.exists(STATIC_DIR):
    STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))

if os.path.exists(STATIC_DIR):
    assets_dir = os.path.join(STATIC_DIR, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/", include_in_schema=False)
    async def serve_root():
        index_file = os.path.join(STATIC_DIR, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return JSONResponse(status_code=404, content={"detail": "Frontend index.html not found"})

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend_spa(full_path: str):
        # Allow API, docs, openapi requests to fall through or return 404
        if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            return JSONResponse(status_code=404, content={"detail": "API endpoint not found"})

        # Check if direct static file requested (e.g. /logo-light.png, /favicon.ico)
        target_file = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.exists(target_file) and os.path.isfile(target_file):
            return FileResponse(target_file)

        # Serve index.html for all client-side routes (/dashboard, /login, /academic, etc.)
        index_file = os.path.join(STATIC_DIR, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return JSONResponse(status_code=404, content={"detail": "Frontend index.html not found"})
else:
    @app.get("/", tags=["Health"])
    async def root():
        return {
            "app": settings.PROJECT_NAME,
            "status": "online",
            "docs": "/docs",
            "api_v1": settings.API_V1_STR,
        }
