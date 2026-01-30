"""
Pydantic Models for DXF Export API

These models mirror the TypeScript types defined in:
  src/subapps/dxf-viewer/types/dxf-export.types.ts

Ensuring type consistency between Next.js frontend and Python microservice.

Reference: ADR-052 DXF Export API Contract
"""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# =============================================================================
# ENUMS
# =============================================================================


class DxfVersion(str, Enum):
    """Supported DXF versions for export."""

    AC1009 = "AC1009"  # R12 - Maximum compatibility
    AC1015 = "AC1015"  # R2000 - Recommended default
    AC1018 = "AC1018"  # R2004
    AC1021 = "AC1021"  # R2007 - Unicode support
    AC1024 = "AC1024"  # R2010
    AC1027 = "AC1027"  # R2013
    AC1032 = "AC1032"  # R2018 - Latest


class DxfUnit(str, Enum):
    """Drawing units (maps to DXF INSUNITS header)."""

    UNITLESS = "unitless"
    INCHES = "inches"
    FEET = "feet"
    MILES = "miles"
    MILLIMETERS = "millimeters"
    CENTIMETERS = "centimeters"
    METERS = "meters"
    KILOMETERS = "kilometers"


class DxfEncoding(str, Enum):
    """Text encoding options."""

    UTF8 = "utf-8"
    CP1252 = "cp1252"
    CP1253 = "cp1253"
    ASCII = "ascii"


class DxfExportStatus(str, Enum):
    """Export result status."""

    SUCCESS = "success"
    PARTIAL = "partial"
    ERROR = "error"


class IssueSeverity(str, Enum):
    """Validation issue severity levels."""

    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


# =============================================================================
# SETTINGS MODELS
# =============================================================================


class DxfExportQuality(BaseModel):
    """Export quality/optimization settings."""

    model_config = ConfigDict(extra="forbid")

    coordinate_precision: int = Field(
        default=6, ge=1, le=15, description="Decimal precision for coordinates"
    )
    simplify_polylines: bool = Field(
        default=False, description="Simplify polylines with Douglas-Peucker"
    )
    simplify_tolerance: float = Field(
        default=0.001, ge=0, description="Tolerance for polyline simplification"
    )
    splines_as_polylines: bool = Field(
        default=False, description="Convert splines to polylines for R12"
    )
    spline_segments: int = Field(
        default=32, ge=4, le=256, description="Segments for spline approximation"
    )
    merge_colinear_lines: bool = Field(default=False, description="Merge colinear segments")
    remove_duplicates: bool = Field(default=False, description="Remove duplicate entities")
    duplicate_tolerance: float = Field(
        default=0.0001, ge=0, description="Tolerance for duplicate detection"
    )


class DxfLayerConfig(BaseModel):
    """Layer export configuration."""

    model_config = ConfigDict(extra="forbid")

    visible_only: bool = Field(default=True, description="Export only visible layers")
    include_locked: bool = Field(default=False, description="Include locked layers")
    flatten_to_layer: str | None = Field(
        default=None, description="Flatten all entities to single layer"
    )
    layer_mapping: dict[str, str] = Field(
        default_factory=dict, description="Layer name mapping"
    )
    default_layer: str = Field(default="0", description="Default layer for unmapped entities")


class DxfExportSettings(BaseModel):
    """Complete export settings."""

    model_config = ConfigDict(extra="forbid")

    version: DxfVersion = Field(default=DxfVersion.AC1015, description="Target DXF version")
    units: DxfUnit = Field(default=DxfUnit.MILLIMETERS, description="Drawing units")
    encoding: DxfEncoding = Field(default=DxfEncoding.UTF8, description="Text encoding")
    quality: DxfExportQuality = Field(
        default_factory=DxfExportQuality, description="Quality settings"
    )
    layers: DxfLayerConfig = Field(
        default_factory=DxfLayerConfig, description="Layer configuration"
    )
    include_metadata: bool = Field(default=True, description="Include metadata as XDATA")
    include_timestamp: bool = Field(default=True, description="Add timestamp to header")
    application_name: str = Field(
        default="Nestor DXF Viewer", description="Application name for header"
    )
    header_variables: dict[str, str | int | float] = Field(
        default_factory=dict, description="Custom header variables"
    )


# =============================================================================
# ENTITY MODELS
# =============================================================================


class Point2D(BaseModel):
    """2D coordinate point."""

    x: float
    y: float


class Point3D(BaseModel):
    """3D coordinate point."""

    x: float
    y: float
    z: float = 0.0


class SceneEntity(BaseModel):
    """Simplified entity representation from Nestor scene."""

    model_config = ConfigDict(extra="allow")

    id: str = Field(..., description="Unique entity identifier")
    type: str = Field(..., description="Entity type (line, circle, etc.)")
    layer: str = Field(default="0", description="Layer name")
    color: str | None = Field(default=None, description="Entity color (hex)")
    visible: bool = Field(default=True, description="Entity visibility")

    # Geometry data varies by entity type
    # Additional fields allowed via extra="allow"


class SceneLayer(BaseModel):
    """Layer definition from Nestor scene."""

    name: str = Field(..., description="Layer name")
    color: str | None = Field(default=None, description="Default layer color")
    visible: bool = Field(default=True, description="Layer visibility")
    locked: bool = Field(default=False, description="Layer locked state")
    line_type: str = Field(default="CONTINUOUS", description="Default line type")


class SceneModel(BaseModel):
    """Complete scene model for export."""

    model_config = ConfigDict(extra="allow")

    entities: list[SceneEntity] = Field(default_factory=list, description="Scene entities")
    layers: list[SceneLayer] = Field(default_factory=list, description="Layer definitions")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Scene metadata")


# =============================================================================
# REQUEST MODELS
# =============================================================================


class DxfExportRequest(BaseModel):
    """Basic export request."""

    model_config = ConfigDict(extra="forbid")

    scene: SceneModel = Field(..., description="Scene to export")
    settings: DxfExportSettings = Field(
        default_factory=DxfExportSettings, description="Export settings"
    )


class DxfExportSceneRequest(BaseModel):
    """Full scene export request with filtering options."""

    model_config = ConfigDict(extra="forbid")

    scene: SceneModel = Field(..., description="Scene model to export")
    settings: DxfExportSettings = Field(
        default_factory=DxfExportSettings, description="Export settings"
    )
    entity_ids: list[str] | None = Field(
        default=None, description="Specific entity IDs to export (null = all)"
    )
    layer_names: list[str] | None = Field(
        default=None, description="Specific layers to export (null = all per settings)"
    )


class DxfExportValidationRequest(BaseModel):
    """Validation request (pre-export check)."""

    model_config = ConfigDict(extra="forbid")

    scene: SceneModel = Field(..., description="Scene to validate")
    target_version: DxfVersion = Field(
        default=DxfVersion.AC1015, description="Target version for validation"
    )


# =============================================================================
# RESPONSE MODELS
# =============================================================================


class ExportStats(BaseModel):
    """Export statistics."""

    total_entities: int = Field(..., description="Total entities in scene")
    exported_entities: int = Field(..., description="Successfully exported")
    skipped_entities: int = Field(..., description="Skipped (not exportable)")
    failed_entities: int = Field(..., description="Failed to export")
    layers_exported: int = Field(..., description="Layers in output")
    export_time_ms: int = Field(..., description="Export duration in ms")


class DxfEntityExportResult(BaseModel):
    """Per-entity export result."""

    entity_id: str = Field(..., description="Original entity ID")
    success: bool = Field(..., description="Export success")
    dxf_type: str | None = Field(default=None, description="ezdxf entity type used")
    warnings: list[str] = Field(default_factory=list, description="Warning messages")
    error: str | None = Field(default=None, description="Error message if failed")


class DxfExportResponse(BaseModel):
    """Export operation response."""

    status: DxfExportStatus = Field(..., description="Overall status")
    data: str | None = Field(default=None, description="DXF content (base64)")
    file_size: int | None = Field(default=None, description="File size in bytes")
    mime_type: str = Field(default="application/dxf", description="MIME type")
    filename: str = Field(..., description="Suggested filename")
    stats: ExportStats = Field(..., description="Export statistics")
    entity_results: list[DxfEntityExportResult] = Field(
        default_factory=list, description="Per-entity results"
    )
    warnings: list[str] = Field(default_factory=list, description="Global warnings")
    error: str | None = Field(default=None, description="Error message if failed")


class ValidationIssue(BaseModel):
    """Single validation issue."""

    severity: IssueSeverity = Field(..., description="Issue severity")
    code: str = Field(..., description="Issue code")
    message: str = Field(..., description="Human-readable message")
    suggestion: str | None = Field(default=None, description="Fix suggestion")


class DxfEntityValidationResult(BaseModel):
    """Per-entity validation result."""

    entity_id: str = Field(..., description="Entity ID")
    entity_type: str = Field(..., description="Entity type")
    exportable: bool = Field(..., description="Can be exported to target version")
    issues: list[ValidationIssue] = Field(default_factory=list, description="Validation issues")


class IssueSummary(BaseModel):
    """Summary of issues by severity."""

    errors: int = 0
    warnings: int = 0
    info: int = 0


class DxfExportValidationResponse(BaseModel):
    """Validation operation response."""

    valid: bool = Field(..., description="Overall validation passed")
    target_version: DxfVersion = Field(..., description="Version validated against")
    total_entities: int = Field(..., description="Total entities checked")
    exportable_entities: int = Field(..., description="Entities that can be exported")
    non_exportable_entities: int = Field(..., description="Entities that cannot be exported")
    entity_results: list[DxfEntityValidationResult] = Field(
        default_factory=list, description="Per-entity validation"
    )
    issue_summary: IssueSummary = Field(
        default_factory=IssueSummary, description="Issues by severity"
    )


# =============================================================================
# HEALTH CHECK MODELS
# =============================================================================


class HealthResponse(BaseModel):
    """Health check response."""

    healthy: bool = Field(..., description="Service is healthy")
    version: str = Field(..., description="Service version")
    ezdxf_version: str = Field(..., description="ezdxf library version")
    python_version: str = Field(..., description="Python version")
    supported_versions: list[DxfVersion] = Field(
        default_factory=list, description="Supported DXF versions"
    )
    uptime_seconds: float = Field(..., description="Service uptime")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Check timestamp")
    feature_flag_enabled: bool = Field(
        default=False, description="Export feature flag status"
    )
