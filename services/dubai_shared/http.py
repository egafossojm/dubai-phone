from datetime import UTC, datetime

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text

from dubai_shared.db import configure_engine, get_engine
from dubai_shared.errors import AppError
from dubai_shared.origin import assert_mutating_origin
from dubai_shared.settings import Settings, load_settings


def ok(data, status: int = 200) -> JSONResponse:
    return JSONResponse({"success": True, "data": data}, status_code=status)


def fail(error: AppError) -> JSONResponse:
    body: dict = {
        "success": False,
        "error": {"code": error.code, "message": error.message},
    }
    if error.details is not None:
        body["error"]["details"] = error.details
    return JSONResponse(body, status_code=error.status_code)


def create_app(service_name: str, routers: list) -> FastAPI:
    settings = load_settings()
    settings.service_name = service_name
    configure_engine(settings)

    app = FastAPI(title=f"dubai-phone-{service_name}", docs_url=None, redoc_url=None)
    app.state.settings = settings

    @app.middleware("http")
    async def origin_guard(request: Request, call_next):
        try:
            assert_mutating_origin(request, settings)
        except AppError as error:
            return fail(error)
        return await call_next(request)

    @app.exception_handler(AppError)
    async def app_error_handler(_request: Request, error: AppError):
        return fail(error)

    @app.get("/health")
    @app.get("/api/health")
    def health():
        return {
            "success": True,
            "data": {
                "status": "ok",
                "service": service_name,
                "probe": "live",
                "timestamp": datetime.now(UTC).isoformat(),
            },
        }

    @app.get("/ready")
    @app.get("/api/ready")
    def ready():
        timestamp = datetime.now(UTC).isoformat()
        try:
            with get_engine().connect() as conn:
                conn.execute(text("SELECT 1"))
                migrated = conn.execute(
                    text(
                        'SELECT 1 FROM "_prisma_migrations" '
                        "WHERE finished_at IS NOT NULL LIMIT 1"
                    )
                ).first()
            if not migrated:
                raise AppError(
                    "INFRASTRUCTURE_ERROR",
                    "Schéma base de données non migré.",
                )
            return {
                "success": True,
                "data": {
                    "status": "ready",
                    "service": service_name,
                    "probe": "ready",
                    "database": "up",
                    "schema": "migrated",
                    "timestamp": timestamp,
                },
            }
        except AppError:
            raise
        except Exception:
            raise AppError("INFRASTRUCTURE_ERROR", "Base de données indisponible.")

    for router in routers:
        app.include_router(router)
    return app
