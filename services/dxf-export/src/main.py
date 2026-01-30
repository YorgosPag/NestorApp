"""
DXF Export Microservice - FastAPI Application

Enterprise-grade microservice for DXF export using ezdxf.
This is the main entry point for the application.

Running the service:
  Development: uvicorn src.main:app --reload --port 8080
  Production:  uvicorn src.main:app --host 0.0.0.0 --port 8080 --workers 1
  Docker:      docker-compose up --build

Reference:
  - ADR-052: DXF Export API Contract
  - docs/strategy/01-dxf-technology-decision.md

@version 1.0.0
@date 2026-01-30
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.api.export import router as export_router
from src.api.health import router as health_router
from src.config.settings import get_settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# =============================================================================
# LIFESPAN MANAGEMENT
# =============================================================================


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan management.

    Handles startup and shutdown events.
    """
    # Startup
    settings = get_settings()
    logger.info(f"Starting {settings.app_name} v1.0.0")
    logger.info(f"Environment: {settings.app_env}")
    logger.info(f"Feature flag enabled: {settings.feature_flag_enabled}")
    logger.info(f"CORS origins: {settings.cors_origins_list}")

    yield

    # Shutdown
    logger.info("Shutting down DXF Export Service")


# =============================================================================
# APPLICATION FACTORY
# =============================================================================


def create_app() -> FastAPI:
    """
    Application factory.

    Creates and configures the FastAPI application instance.
    """
    settings = get_settings()

    app = FastAPI(
        title="DXF Export Microservice",
        description=(
            "Enterprise-grade DXF export service using ezdxf library.\n\n"
            "Converts Nestor scene models to DXF format for CAD software compatibility.\n\n"
            "**Technology**: Python 3.11 + FastAPI + ezdxf (MIT License)\n\n"
            "**Reference**: ADR-052 DXF Export API Contract"
        ),
        version="1.0.0",
        docs_url="/docs" if settings.is_development else None,
        redoc_url="/redoc" if settings.is_development else None,
        openapi_url="/openapi.json" if settings.is_development else None,
        lifespan=lifespan,
        license_info={
            "name": "MIT",
            "url": "https://opensource.org/licenses/MIT",
        },
        contact={
            "name": "Nestor Development Team",
            "email": "dev@nestor.app",
        },
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    # Register routers
    app.include_router(health_router)
    app.include_router(export_router)

    # Register exception handlers
    register_exception_handlers(app)

    return app


# =============================================================================
# EXCEPTION HANDLERS
# =============================================================================


def register_exception_handlers(app: FastAPI) -> None:
    """Register global exception handlers."""

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
        """Handle validation errors."""
        logger.warning(f"Validation error: {exc}")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "status": "error",
                "code": "VALIDATION_ERROR",
                "message": str(exc),
            },
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """Handle unexpected errors."""
        logger.exception(f"Unexpected error: {exc}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": "error",
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
            },
        )


# =============================================================================
# APPLICATION INSTANCE
# =============================================================================

# Create application instance
app = create_app()


# Root endpoint
@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    """Root endpoint redirect info."""
    return {
        "service": "DXF Export Microservice",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "status": "/api/v1/dxf/status",
    }


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "src.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.is_development,
        log_level=settings.log_level.lower(),
    )
