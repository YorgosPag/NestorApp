"""
Health Check API Endpoint

Provides service health status, version information, and readiness checks.
Used by Docker health checks, Kubernetes probes, and monitoring systems.

Endpoints:
  GET /health       - Full health check with details
  GET /health/live  - Liveness probe (simple)
  GET /health/ready - Readiness probe (with dependency checks)
"""

import platform
import sys
from datetime import datetime

import ezdxf
from fastapi import APIRouter, Response, status

from src.config.settings import get_settings
from src.models.export_models import DxfVersion, HealthResponse

router = APIRouter(prefix="/health", tags=["Health"])

# Track service start time for uptime calculation
_service_start_time = datetime.utcnow()


@router.get(
    "",
    response_model=HealthResponse,
    summary="Full Health Check",
    description="Returns complete health status with version information and capabilities.",
)
async def health_check() -> HealthResponse:
    """
    Full health check with detailed status.

    Returns:
        HealthResponse: Complete health information including:
            - Service version
            - ezdxf library version
            - Python version
            - Supported DXF versions
            - Uptime
            - Feature flag status
    """
    settings = get_settings()
    uptime = (datetime.utcnow() - _service_start_time).total_seconds()

    return HealthResponse(
        healthy=True,
        version="1.0.0",
        ezdxf_version=ezdxf.__version__,
        python_version=f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        supported_versions=list(DxfVersion),
        uptime_seconds=uptime,
        timestamp=datetime.utcnow(),
        feature_flag_enabled=settings.feature_flag_enabled,
    )


@router.get(
    "/live",
    summary="Liveness Probe",
    description="Simple liveness check for container orchestration.",
    status_code=status.HTTP_200_OK,
)
async def liveness_probe() -> dict[str, str]:
    """
    Kubernetes/Docker liveness probe.

    This endpoint should always return 200 if the service is running.
    Used to detect if the container needs to be restarted.

    Returns:
        dict: Simple status message
    """
    return {"status": "alive"}


@router.get(
    "/ready",
    summary="Readiness Probe",
    description="Readiness check verifying service can handle requests.",
)
async def readiness_probe(response: Response) -> dict[str, str | bool]:
    """
    Kubernetes/Docker readiness probe.

    Verifies that the service is ready to accept requests.
    Checks:
        - ezdxf library is importable
        - Configuration is valid
        - Feature flag status (informational)

    Returns:
        dict: Readiness status with details
    """
    settings = get_settings()
    checks_passed = True
    checks: dict[str, bool] = {}

    # Check 1: ezdxf is available
    try:
        # Try to create a minimal document to verify ezdxf works
        doc = ezdxf.new(dxfversion="R2000")
        doc.modelspace()
        checks["ezdxf"] = True
    except Exception:
        checks["ezdxf"] = False
        checks_passed = False

    # Check 2: Configuration is valid
    try:
        _ = settings.max_file_size_bytes
        _ = settings.cors_origins_list
        checks["config"] = True
    except Exception:
        checks["config"] = False
        checks_passed = False

    # Set response status based on checks
    if not checks_passed:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "ready" if checks_passed else "not_ready",
        "checks": checks,
        "feature_flag_enabled": settings.feature_flag_enabled,
    }


@router.get(
    "/info",
    summary="Service Information",
    description="Detailed service information for debugging.",
)
async def service_info() -> dict[str, str | dict[str, str]]:
    """
    Detailed service information.

    Returns comprehensive information about the service for debugging
    and monitoring purposes.

    Returns:
        dict: Service details including versions, platform, and capabilities
    """
    settings = get_settings()

    return {
        "service": {
            "name": settings.app_name,
            "version": "1.0.0",
            "environment": settings.app_env,
        },
        "runtime": {
            "python_version": platform.python_version(),
            "platform": platform.platform(),
            "architecture": platform.machine(),
        },
        "libraries": {
            "ezdxf": ezdxf.__version__,
            "fastapi": "0.109.2",
        },
        "capabilities": {
            "supported_dxf_versions": ", ".join([v.value for v in DxfVersion]),
            "max_file_size_mb": str(settings.max_file_size_mb),
            "max_entities": str(settings.max_entities_per_request),
        },
    }
