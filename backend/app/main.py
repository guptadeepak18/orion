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


async def _event_auto_complete_loop():
    """Background task running every 60 seconds to auto-complete expired academic events."""
    from app.services.academic_event_service import auto_complete_expired_events
    while True:
        try:
            await asyncio.sleep(60)
            async with AsyncSessionLocal() as session:
                await auto_complete_expired_events(session)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"[AUTO-COMPLETE ERROR] Error in event auto complete loop: {e}")


async def _background_startup_tasks():
    try:
        await asyncio.sleep(1)
        async with AsyncSessionLocal() as session:
            await seed_initial_data(session)
            from app.services.email_template_service import seed_default_templates
            await seed_default_templates(session)
            from app.services.student_service import sync_all_unlinked_students_to_users
            synced = await sync_all_unlinked_students_to_users(session)
            if synced > 0:
                print(f"[STARTUP] Synchronized and provisioned {synced} student user accounts with default credentials.")
    except Exception as e:
        print(f"[STARTUP NOTICE] Background startup task notice: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    event_loop_task = None
    startup_task = None
    try:
        # Start background event auto-completion task
        event_loop_task = asyncio.create_task(_event_auto_complete_loop())
        # Run DB seed & sync in background so HTTP server opens immediately
        startup_task = asyncio.create_task(_background_startup_tasks())
    except Exception as e:
        print(f"Startup notice: {e}")

    yield

    if event_loop_task:
        event_loop_task.cancel()


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


from fastapi.encoders import jsonable_encoder

def _get_cors_headers(request: Request) -> dict:
    """Explicitly mirrors request origin for CORS headers to prevent browser masking 500s as Network Error."""
    origin = request.headers.get("origin") or "*"
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
    }


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    try:
        body = await request.body()
        print(f"[VALIDATION ERROR] {request.method} {request.url.path} body={body.decode('utf-8', errors='replace')}", flush=True)
    except Exception:
        pass
    print(f"[VALIDATION ERROR] details: {exc.errors()}", flush=True)
    return JSONResponse(
        status_code=422,
        content={"detail": jsonable_encoder(exc.errors())},
        headers=_get_cors_headers(request),
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"[GLOBAL EXCEPTION] {request.method} {request.url.path}: {exc}", flush=True)
    return JSONResponse(
        status_code=500,
        content=ErrorEnvelope(
            error=ErrorDetails(
                code="INTERNAL_SERVER_ERROR",
                message=str(exc) if settings.ENVIRONMENT == "local" else "An unexpected error occurred",
            )
        ).model_dump(),
        headers=_get_cors_headers(request),
    )

from app.api.v1.websocket import router as ws_router

app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(ws_router, prefix="/ws", tags=["WebSocket"])


@app.get(f"{settings.API_V1_STR}", tags=["Health"])
@app.head(f"{settings.API_V1_STR}", tags=["Health"])
@app.get(f"{settings.API_V1_STR}/health", tags=["Health"])
@app.head(f"{settings.API_V1_STR}/health", tags=["Health"])
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

INDEX_NO_CACHE_HEADERS = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
}

if os.path.exists(STATIC_DIR):
    assets_dir = os.path.join(STATIC_DIR, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/", include_in_schema=False)
    @app.head("/", include_in_schema=False)
    async def serve_root():
        index_file = os.path.join(STATIC_DIR, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file, headers=INDEX_NO_CACHE_HEADERS)
        return JSONResponse(status_code=200, content={"status": "online", "app": settings.PROJECT_NAME})

    @app.get("/{full_path:path}", include_in_schema=False)
    @app.head("/{full_path:path}", include_in_schema=False)
    async def serve_frontend_spa(full_path: str):
        # Allow API, docs, openapi requests to fall through or return 404
        if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            return JSONResponse(status_code=404, content={"detail": "API endpoint not found"})

        # CRITICAL: Missing assets MUST return 404 and NEVER fall back to index.html!
        # If an old chunk like assets/Foo-xxxx.js is requested after a new build, serving index.html
        # causes a fatal SyntaxError: Unexpected token '<' and crashes the React app to a blank screen!
        if full_path.startswith("assets/") or full_path.endswith(".js") or full_path.endswith(".css"):
            return JSONResponse(
                status_code=404,
                content={"detail": "Static asset not found"},
                headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
            )

        # Check if direct static file requested (e.g. /manifest.json, /logo-light.png, /favicon.ico)
        target_file = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.exists(target_file) and os.path.isfile(target_file):
            media_type = "application/manifest+json" if full_path in ["manifest.json", "manifest.webmanifest"] else None
            return FileResponse(target_file, media_type=media_type)

        # Serve index.html for all client-side routes (/dashboard, /login, /academic, etc.)
        index_file = os.path.join(STATIC_DIR, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file, headers=INDEX_NO_CACHE_HEADERS)
        return JSONResponse(status_code=200, content={"status": "online", "app": settings.PROJECT_NAME})
else:
    @app.get("/", tags=["Health"])
    @app.head("/", tags=["Health"])
    async def root():
        return {
            "app": settings.PROJECT_NAME,
            "status": "online",
            "docs": "/docs",
            "api_v1": settings.API_V1_STR,
        }
