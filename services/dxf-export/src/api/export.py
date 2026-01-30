"""
DXF Export API Endpoints

REST API for exporting Nestor scenes to DXF format.
Uses ezdxf library for DXF generation.

Endpoints:
  POST /api/v1/dxf/export     - Export scene to DXF
  POST /api/v1/dxf/validate   - Validate scene before export

Note: Export functionality is gated by feature flag (FEATURE_FLAG_ENABLED).
      Until PR-1C (rate limiting) is complete, feature flag should be OFF.

Reference:
  - ADR-052: DXF Export API Contract
  - docs/strategy/01-dxf-technology-decision.md
"""

import logging
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from src.config.settings import Settings, get_settings
from src.models.export_models import (
    DxfExportResponse,
    DxfExportSceneRequest,
    DxfExportStatus,
    DxfExportValidationRequest,
    DxfExportValidationResponse,
    DxfVersion,
    ExportStats,
    IssueSummary,
)
from src.services.dxf_export_service import DxfExportService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/dxf", tags=["DXF Export"])


# Dependency injection
def get_export_service() -> DxfExportService:
    """Get DXF export service instance."""
    return DxfExportService()


def check_feature_flag(settings: Annotated[Settings, Depends(get_settings)]) -> None:
    """
    Check if export feature is enabled.

    Raises HTTPException 503 if feature flag is disabled.
    This gate exists until PR-1C (rate limiting) is complete.
    """
    if not settings.feature_flag_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "FEATURE_DISABLED",
                "message": "DXF export is currently disabled",
                "reason": "Waiting for PR-1C rate limiting implementation",
                "expected": "Enable via FEATURE_FLAG_ENABLED=true after rate limiting is deployed",
            },
        )


@router.post(
    "/export",
    response_model=DxfExportResponse,
    summary="Export Scene to DXF",
    description="Convert Nestor scene model to DXF format using ezdxf.",
    dependencies=[Depends(check_feature_flag)],
)
async def export_scene(
    request: DxfExportSceneRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    service: Annotated[DxfExportService, Depends(get_export_service)],
) -> DxfExportResponse:
    """
    Export scene to DXF format.

    This endpoint converts a Nestor scene model to DXF format using the
    ezdxf library. The export process includes:

    1. Validation of input scene and settings
    2. Entity mapping (Nestor types → DXF types)
    3. Layer creation and configuration
    4. Entity conversion with coordinate transformation
    5. DXF file generation and encoding

    Args:
        request: Export request with scene and settings
        settings: Application settings (injected)
        service: DXF export service (injected)

    Returns:
        DxfExportResponse: Export result with DXF data (base64 encoded)

    Raises:
        HTTPException 400: Invalid request data
        HTTPException 413: Scene exceeds maximum entity count
        HTTPException 500: Export processing error
        HTTPException 503: Feature flag disabled
    """
    start_time = datetime.utcnow()

    # Validate entity count
    entity_count = len(request.scene.entities)
    if entity_count > settings.max_entities_per_request:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "code": "ENTITY_LIMIT_EXCEEDED",
                "message": f"Scene has {entity_count} entities, maximum is {settings.max_entities_per_request}",
                "limit": settings.max_entities_per_request,
                "actual": entity_count,
            },
        )

    try:
        # Perform export
        result = await service.export_scene(
            scene=request.scene,
            settings=request.settings,
            entity_ids=request.entity_ids,
            layer_names=request.layer_names,
        )

        # Calculate export time
        export_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        result.stats.export_time_ms = export_time_ms

        logger.info(
            "DXF export completed",
            extra={
                "status": result.status.value,
                "entities_exported": result.stats.exported_entities,
                "file_size": result.file_size,
                "export_time_ms": export_time_ms,
            },
        )

        return result

    except ValueError as e:
        logger.warning(f"Export validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": str(e)},
        )
    except Exception as e:
        logger.exception("Export processing error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "EXPORT_ERROR", "message": f"Export failed: {e!s}"},
        )


@router.post(
    "/validate",
    response_model=DxfExportValidationResponse,
    summary="Validate Scene for Export",
    description="Pre-export validation to check entity compatibility.",
)
async def validate_scene(
    request: DxfExportValidationRequest,
    service: Annotated[DxfExportService, Depends(get_export_service)],
) -> DxfExportValidationResponse:
    """
    Validate scene before export.

    Checks all entities in the scene for compatibility with the target
    DXF version without actually generating the DXF file. Useful for:

    - Pre-flight checks before large exports
    - Identifying unsupported entity types
    - Getting warnings about potential issues

    Args:
        request: Validation request with scene and target version
        service: DXF export service (injected)

    Returns:
        DxfExportValidationResponse: Validation results with per-entity details

    Note:
        This endpoint does NOT require the feature flag to be enabled,
        allowing validation even when export is disabled.
    """
    try:
        result = await service.validate_scene(
            scene=request.scene,
            target_version=request.target_version,
        )
        return result

    except Exception as e:
        logger.exception("Validation error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "VALIDATION_ERROR", "message": f"Validation failed: {e!s}"},
        )


@router.get(
    "/versions",
    summary="List Supported DXF Versions",
    description="Get list of supported DXF versions with descriptions.",
)
async def list_versions() -> dict[str, list[dict[str, str]]]:
    """
    List all supported DXF versions.

    Returns information about each supported DXF version including
    the version code, human-readable name, and feature notes.

    Returns:
        dict: List of supported versions with metadata
    """
    versions = [
        {
            "code": "AC1009",
            "name": "AutoCAD R12",
            "notes": "Maximum compatibility, basic entities only",
        },
        {
            "code": "AC1015",
            "name": "AutoCAD 2000",
            "notes": "Recommended default, good balance of features and compatibility",
        },
        {
            "code": "AC1018",
            "name": "AutoCAD 2004",
            "notes": "Extended entity support",
        },
        {
            "code": "AC1021",
            "name": "AutoCAD 2007",
            "notes": "Full Unicode text support",
        },
        {
            "code": "AC1024",
            "name": "AutoCAD 2010",
            "notes": "Improved spline handling",
        },
        {
            "code": "AC1027",
            "name": "AutoCAD 2013",
            "notes": "Modern features",
        },
        {
            "code": "AC1032",
            "name": "AutoCAD 2018",
            "notes": "Latest supported version",
        },
    ]

    return {"versions": versions, "default": "AC1015"}


@router.get(
    "/status",
    summary="Export Service Status",
    description="Get current status of the export service.",
)
async def service_status(
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, bool | str | int]:
    """
    Get export service status.

    Returns current service configuration and feature flag status.
    Useful for frontend to determine if export is available.

    Returns:
        dict: Service status information
    """
    return {
        "export_enabled": settings.feature_flag_enabled,
        "rate_limit_enabled": settings.rate_limit_enabled,
        "max_entities": settings.max_entities_per_request,
        "max_file_size_mb": settings.max_file_size_mb,
        "default_version": settings.default_dxf_version,
        "status": "enabled" if settings.feature_flag_enabled else "disabled",
        "message": (
            "DXF export is available"
            if settings.feature_flag_enabled
            else "DXF export is disabled (waiting for PR-1C rate limiting)"
        ),
    }
