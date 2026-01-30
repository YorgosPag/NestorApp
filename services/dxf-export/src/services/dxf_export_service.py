"""
DXF Export Service

Business logic for converting Nestor scene models to DXF format.
Uses ezdxf library for DXF generation.

This service handles:
  - Entity type mapping (Nestor → DXF)
  - Coordinate transformation
  - Layer management
  - DXF document creation
  - Validation logic

Reference:
  - ADR-052: DXF Export API Contract
  - src/subapps/dxf-viewer/types/dxf-export.types.ts
"""

import base64
import io
import logging
from typing import Any

import ezdxf
from ezdxf import DXFValueError
from ezdxf.document import Drawing
from ezdxf.layouts import Modelspace

from src.models.export_models import (
    DxfEncoding,
    DxfEntityExportResult,
    DxfEntityValidationResult,
    DxfExportQuality,
    DxfExportResponse,
    DxfExportSettings,
    DxfExportStatus,
    DxfExportValidationResponse,
    DxfLayerConfig,
    DxfUnit,
    DxfVersion,
    ExportStats,
    IssueSeverity,
    IssueSummary,
    SceneEntity,
    SceneLayer,
    SceneModel,
    ValidationIssue,
)

logger = logging.getLogger(__name__)


# =============================================================================
# ENTITY TYPE MAPPING
# =============================================================================

# Maps Nestor entity types to ezdxf entity types
# None means the entity type is not exportable (internal only)
ENTITY_TYPE_MAPPING: dict[str, str | None] = {
    "line": "LINE",
    "polyline": "POLYLINE",
    "lwpolyline": "LWPOLYLINE",
    "circle": "CIRCLE",
    "arc": "ARC",
    "ellipse": "ELLIPSE",
    "text": "TEXT",
    "mtext": "MTEXT",
    "spline": "SPLINE",
    "rectangle": "LWPOLYLINE",  # Rectangles export as closed polylines
    "rect": "LWPOLYLINE",
    "point": "POINT",
    "dimension": "DIMENSION",
    "block": "INSERT",
    "angle-measurement": None,  # Internal only
    "leader": "LEADER",
    "hatch": "HATCH",
    "xline": "XLINE",
    "ray": "RAY",
}

# DXF version to ezdxf version string mapping
DXF_VERSION_MAP: dict[DxfVersion, str] = {
    DxfVersion.AC1009: "R12",
    DxfVersion.AC1015: "R2000",
    DxfVersion.AC1018: "R2004",
    DxfVersion.AC1021: "R2007",
    DxfVersion.AC1024: "R2010",
    DxfVersion.AC1027: "R2013",
    DxfVersion.AC1032: "R2018",
}

# INSUNITS values
UNIT_VALUES: dict[DxfUnit, int] = {
    DxfUnit.UNITLESS: 0,
    DxfUnit.INCHES: 1,
    DxfUnit.FEET: 2,
    DxfUnit.MILES: 3,
    DxfUnit.MILLIMETERS: 4,
    DxfUnit.CENTIMETERS: 5,
    DxfUnit.METERS: 6,
    DxfUnit.KILOMETERS: 7,
}

# R12 supported entity types (limited set)
R12_SUPPORTED_TYPES: set[str] = {"LINE", "POLYLINE", "CIRCLE", "ARC", "TEXT", "POINT"}


class DxfExportService:
    """
    Service for exporting Nestor scenes to DXF format.

    This service provides methods for:
      - Full scene export to DXF
      - Pre-export validation
      - Entity type mapping and conversion
    """

    def __init__(self) -> None:
        """Initialize export service."""
        self._logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")

    # -------------------------------------------------------------------------
    # Public Methods
    # -------------------------------------------------------------------------

    async def export_scene(
        self,
        scene: SceneModel,
        settings: DxfExportSettings,
        entity_ids: list[str] | None = None,
        layer_names: list[str] | None = None,
    ) -> DxfExportResponse:
        """
        Export scene to DXF format.

        Args:
            scene: Scene model to export
            settings: Export settings
            entity_ids: Optional list of specific entity IDs to export
            layer_names: Optional list of specific layers to export

        Returns:
            DxfExportResponse: Export result with DXF data
        """
        # Create DXF document
        dxf_version = DXF_VERSION_MAP[settings.version]
        doc = ezdxf.new(dxfversion=dxf_version)
        msp = doc.modelspace()

        # Set header variables
        self._set_header_variables(doc, settings)

        # Create layers
        self._create_layers(doc, scene.layers, settings.layers)

        # Filter entities
        entities_to_export = self._filter_entities(
            scene.entities, entity_ids, layer_names, settings.layers
        )

        # Export entities
        entity_results: list[DxfEntityExportResult] = []
        exported_count = 0
        skipped_count = 0
        failed_count = 0
        warnings: list[str] = []

        for entity in entities_to_export:
            result = self._export_entity(msp, entity, settings)
            entity_results.append(result)

            if result.success:
                exported_count += 1
            elif result.dxf_type is None:
                skipped_count += 1
            else:
                failed_count += 1

            warnings.extend(result.warnings)

        # Generate DXF content
        dxf_content, file_size = self._generate_dxf_content(doc, settings.encoding)

        # Determine status
        if failed_count > 0:
            status = DxfExportStatus.PARTIAL if exported_count > 0 else DxfExportStatus.ERROR
        else:
            status = DxfExportStatus.SUCCESS

        # Generate filename
        filename = self._generate_filename(scene, settings)

        return DxfExportResponse(
            status=status,
            data=dxf_content,
            file_size=file_size,
            mime_type="application/dxf",
            filename=filename,
            stats=ExportStats(
                total_entities=len(scene.entities),
                exported_entities=exported_count,
                skipped_entities=skipped_count,
                failed_entities=failed_count,
                layers_exported=len(doc.layers),
                export_time_ms=0,  # Set by caller
            ),
            entity_results=entity_results,
            warnings=warnings,
        )

    async def validate_scene(
        self,
        scene: SceneModel,
        target_version: DxfVersion,
    ) -> DxfExportValidationResponse:
        """
        Validate scene for export without generating DXF.

        Args:
            scene: Scene to validate
            target_version: Target DXF version

        Returns:
            DxfExportValidationResponse: Validation results
        """
        entity_results: list[DxfEntityValidationResult] = []
        exportable_count = 0
        error_count = 0
        warning_count = 0
        info_count = 0

        for entity in scene.entities:
            result = self._validate_entity(entity, target_version)
            entity_results.append(result)

            if result.exportable:
                exportable_count += 1

            for issue in result.issues:
                if issue.severity == IssueSeverity.ERROR:
                    error_count += 1
                elif issue.severity == IssueSeverity.WARNING:
                    warning_count += 1
                else:
                    info_count += 1

        # Overall validation passes if no errors
        valid = error_count == 0

        return DxfExportValidationResponse(
            valid=valid,
            target_version=target_version,
            total_entities=len(scene.entities),
            exportable_entities=exportable_count,
            non_exportable_entities=len(scene.entities) - exportable_count,
            entity_results=entity_results,
            issue_summary=IssueSummary(
                errors=error_count,
                warnings=warning_count,
                info=info_count,
            ),
        )

    # -------------------------------------------------------------------------
    # Private Methods - Document Setup
    # -------------------------------------------------------------------------

    def _set_header_variables(
        self, doc: Drawing, settings: DxfExportSettings
    ) -> None:
        """Set DXF header variables."""
        # Set units
        doc.header["$INSUNITS"] = UNIT_VALUES.get(settings.units, 4)

        # Set application name
        if settings.include_metadata:
            doc.header["$LASTSAVEDBY"] = settings.application_name

        # Set custom header variables
        for key, value in settings.header_variables.items():
            try:
                doc.header[key] = value
            except DXFValueError:
                self._logger.warning(f"Invalid header variable: {key}")

    def _create_layers(
        self,
        doc: Drawing,
        scene_layers: list[SceneLayer],
        config: DxfLayerConfig,
    ) -> None:
        """Create layers in DXF document."""
        for layer in scene_layers:
            # Skip invisible layers if configured
            if config.visible_only and not layer.visible:
                continue

            # Skip locked layers if configured
            if not config.include_locked and layer.locked:
                continue

            # Get mapped layer name
            layer_name = config.layer_mapping.get(layer.name, layer.name)

            # Flatten to single layer if configured
            if config.flatten_to_layer:
                continue  # All entities will go to flatten layer

            # Create layer
            try:
                dxf_layer = doc.layers.add(layer_name)

                # Set layer properties
                if layer.color:
                    dxf_layer.color = self._hex_to_aci(layer.color)

                if layer.locked:
                    dxf_layer.lock()

            except Exception as e:
                self._logger.warning(f"Failed to create layer {layer_name}: {e}")

        # Ensure default/flatten layer exists
        target_layer = config.flatten_to_layer or config.default_layer
        if target_layer not in doc.layers:
            doc.layers.add(target_layer)

    # -------------------------------------------------------------------------
    # Private Methods - Entity Export
    # -------------------------------------------------------------------------

    def _filter_entities(
        self,
        entities: list[SceneEntity],
        entity_ids: list[str] | None,
        layer_names: list[str] | None,
        config: DxfLayerConfig,
    ) -> list[SceneEntity]:
        """Filter entities based on export criteria."""
        filtered = entities

        # Filter by entity IDs
        if entity_ids:
            id_set = set(entity_ids)
            filtered = [e for e in filtered if e.id in id_set]

        # Filter by layer names
        if layer_names:
            layer_set = set(layer_names)
            filtered = [e for e in filtered if e.layer in layer_set]

        # Filter by visibility
        if config.visible_only:
            filtered = [e for e in filtered if e.visible]

        return filtered

    def _export_entity(
        self,
        msp: Modelspace,
        entity: SceneEntity,
        settings: DxfExportSettings,
    ) -> DxfEntityExportResult:
        """Export single entity to modelspace."""
        warnings: list[str] = []

        # Get DXF entity type
        dxf_type = ENTITY_TYPE_MAPPING.get(entity.type)

        if dxf_type is None:
            return DxfEntityExportResult(
                entity_id=entity.id,
                success=False,
                dxf_type=None,
                warnings=[f"Entity type '{entity.type}' is not exportable"],
            )

        # Check R12 compatibility
        if settings.version == DxfVersion.AC1009 and dxf_type not in R12_SUPPORTED_TYPES:
            return DxfEntityExportResult(
                entity_id=entity.id,
                success=False,
                dxf_type=dxf_type,
                warnings=[f"Entity type '{dxf_type}' not supported in R12"],
                error="R12 version does not support this entity type",
            )

        # Determine target layer
        layer = self._get_target_layer(entity.layer, settings.layers)

        # Get common attributes
        attribs: dict[str, Any] = {
            "layer": layer,
        }

        if entity.color:
            attribs["color"] = self._hex_to_aci(entity.color)

        try:
            # Export based on entity type
            if dxf_type == "LINE":
                self._export_line(msp, entity, attribs)
            elif dxf_type == "LWPOLYLINE":
                self._export_lwpolyline(msp, entity, attribs)
            elif dxf_type == "CIRCLE":
                self._export_circle(msp, entity, attribs)
            elif dxf_type == "ARC":
                self._export_arc(msp, entity, attribs)
            elif dxf_type == "TEXT":
                self._export_text(msp, entity, attribs)
            elif dxf_type == "POINT":
                self._export_point(msp, entity, attribs)
            else:
                warnings.append(f"Export for '{dxf_type}' not yet implemented")
                return DxfEntityExportResult(
                    entity_id=entity.id,
                    success=False,
                    dxf_type=dxf_type,
                    warnings=warnings,
                    error="Entity type export not implemented",
                )

            return DxfEntityExportResult(
                entity_id=entity.id,
                success=True,
                dxf_type=dxf_type,
                warnings=warnings,
            )

        except Exception as e:
            self._logger.warning(f"Failed to export entity {entity.id}: {e}")
            return DxfEntityExportResult(
                entity_id=entity.id,
                success=False,
                dxf_type=dxf_type,
                warnings=warnings,
                error=str(e),
            )

    def _get_target_layer(self, entity_layer: str, config: DxfLayerConfig) -> str:
        """Get target layer name for entity."""
        if config.flatten_to_layer:
            return config.flatten_to_layer
        return config.layer_mapping.get(entity_layer, entity_layer) or config.default_layer

    # -------------------------------------------------------------------------
    # Private Methods - Entity Type Handlers
    # -------------------------------------------------------------------------

    def _export_line(
        self, msp: Modelspace, entity: SceneEntity, attribs: dict[str, Any]
    ) -> None:
        """Export LINE entity."""
        # Extract coordinates from entity
        # Nestor format varies - handle common patterns
        start = self._get_point(entity, "start", "startPoint", "p1")
        end = self._get_point(entity, "end", "endPoint", "p2")

        if start and end:
            msp.add_line(start, end, dxfattribs=attribs)

    def _export_lwpolyline(
        self, msp: Modelspace, entity: SceneEntity, attribs: dict[str, Any]
    ) -> None:
        """Export LWPOLYLINE entity (including rectangles)."""
        points = self._get_points(entity, "points", "vertices", "polygon")

        if points and len(points) >= 2:
            # Check if closed (rectangle or closed polyline)
            is_closed = self._get_bool(entity, "closed", "isClosed")

            # For rectangles, ensure closed
            if entity.type in ("rectangle", "rect"):
                is_closed = True

            msp.add_lwpolyline(points, close=is_closed, dxfattribs=attribs)

    def _export_circle(
        self, msp: Modelspace, entity: SceneEntity, attribs: dict[str, Any]
    ) -> None:
        """Export CIRCLE entity."""
        center = self._get_point(entity, "center", "centerPoint")
        radius = self._get_float(entity, "radius", "r")

        if center and radius:
            msp.add_circle(center, radius, dxfattribs=attribs)

    def _export_arc(
        self, msp: Modelspace, entity: SceneEntity, attribs: dict[str, Any]
    ) -> None:
        """Export ARC entity."""
        center = self._get_point(entity, "center", "centerPoint")
        radius = self._get_float(entity, "radius", "r")
        start_angle = self._get_float(entity, "startAngle", "start_angle")
        end_angle = self._get_float(entity, "endAngle", "end_angle")

        if center and radius is not None and start_angle is not None and end_angle is not None:
            msp.add_arc(center, radius, start_angle, end_angle, dxfattribs=attribs)

    def _export_text(
        self, msp: Modelspace, entity: SceneEntity, attribs: dict[str, Any]
    ) -> None:
        """Export TEXT entity."""
        insert = self._get_point(entity, "insert", "position", "location")
        text = self._get_string(entity, "text", "content", "value")
        height = self._get_float(entity, "height", "fontSize") or 2.5

        if insert and text:
            attribs["height"] = height
            rotation = self._get_float(entity, "rotation", "angle") or 0
            attribs["rotation"] = rotation
            msp.add_text(text, dxfattribs=attribs).set_placement(insert)

    def _export_point(
        self, msp: Modelspace, entity: SceneEntity, attribs: dict[str, Any]
    ) -> None:
        """Export POINT entity."""
        location = self._get_point(entity, "location", "position", "point")

        if location:
            msp.add_point(location, dxfattribs=attribs)

    # -------------------------------------------------------------------------
    # Private Methods - Validation
    # -------------------------------------------------------------------------

    def _validate_entity(
        self, entity: SceneEntity, target_version: DxfVersion
    ) -> DxfEntityValidationResult:
        """Validate single entity for export."""
        issues: list[ValidationIssue] = []

        # Check entity type mapping
        dxf_type = ENTITY_TYPE_MAPPING.get(entity.type)

        if dxf_type is None:
            issues.append(
                ValidationIssue(
                    severity=IssueSeverity.WARNING,
                    code="NOT_EXPORTABLE",
                    message=f"Entity type '{entity.type}' cannot be exported to DXF",
                    suggestion="This entity will be skipped during export",
                )
            )
            return DxfEntityValidationResult(
                entity_id=entity.id,
                entity_type=entity.type,
                exportable=False,
                issues=issues,
            )

        # Check R12 compatibility
        if target_version == DxfVersion.AC1009 and dxf_type not in R12_SUPPORTED_TYPES:
            issues.append(
                ValidationIssue(
                    severity=IssueSeverity.ERROR,
                    code="VERSION_INCOMPATIBLE",
                    message=f"Entity type '{dxf_type}' not supported in R12",
                    suggestion="Use R2000 (AC1015) or later for full entity support",
                )
            )
            return DxfEntityValidationResult(
                entity_id=entity.id,
                entity_type=entity.type,
                exportable=False,
                issues=issues,
            )

        return DxfEntityValidationResult(
            entity_id=entity.id,
            entity_type=entity.type,
            exportable=True,
            issues=issues,
        )

    # -------------------------------------------------------------------------
    # Private Methods - Utilities
    # -------------------------------------------------------------------------

    def _generate_dxf_content(
        self, doc: Drawing, encoding: DxfEncoding
    ) -> tuple[str, int]:
        """Generate DXF content as base64 string."""
        buffer = io.StringIO()
        doc.write(buffer)
        content = buffer.getvalue()

        # Encode to bytes
        encoding_str = encoding.value
        content_bytes = content.encode(encoding_str)

        # Base64 encode
        base64_content = base64.b64encode(content_bytes).decode("ascii")

        return base64_content, len(content_bytes)

    def _generate_filename(
        self, scene: SceneModel, settings: DxfExportSettings
    ) -> str:
        """Generate suggested filename."""
        # Try to get name from scene metadata
        name = scene.metadata.get("name", "export")
        if isinstance(name, str):
            # Sanitize filename
            safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in name)
        else:
            safe_name = "export"

        # Add version suffix
        version_suffix = settings.version.value

        return f"{safe_name}_{version_suffix}.dxf"

    def _hex_to_aci(self, hex_color: str) -> int:
        """Convert hex color to AutoCAD Color Index (simplified)."""
        # Basic ACI mapping
        color_map = {
            "#FF0000": 1,  # Red
            "#FFFF00": 2,  # Yellow
            "#00FF00": 3,  # Green
            "#00FFFF": 4,  # Cyan
            "#0000FF": 5,  # Blue
            "#FF00FF": 6,  # Magenta
            "#FFFFFF": 7,  # White
            "#000000": 0,  # ByBlock
        }

        normalized = hex_color.upper()
        if normalized in color_map:
            return color_map[normalized]

        # Default to white
        return 7

    def _get_point(
        self, entity: SceneEntity, *keys: str
    ) -> tuple[float, float] | None:
        """Extract 2D point from entity using various key names."""
        data = entity.model_dump()

        for key in keys:
            if key in data:
                val = data[key]
                if isinstance(val, dict):
                    x = val.get("x", val.get("X"))
                    y = val.get("y", val.get("Y"))
                    if x is not None and y is not None:
                        return (float(x), float(y))
                elif isinstance(val, (list, tuple)) and len(val) >= 2:
                    return (float(val[0]), float(val[1]))

        return None

    def _get_points(
        self, entity: SceneEntity, *keys: str
    ) -> list[tuple[float, float]] | None:
        """Extract list of 2D points from entity."""
        data = entity.model_dump()

        for key in keys:
            if key in data:
                val = data[key]
                if isinstance(val, list):
                    points: list[tuple[float, float]] = []
                    for item in val:
                        if isinstance(item, dict):
                            x = item.get("x", item.get("X"))
                            y = item.get("y", item.get("Y"))
                            if x is not None and y is not None:
                                points.append((float(x), float(y)))
                        elif isinstance(item, (list, tuple)) and len(item) >= 2:
                            points.append((float(item[0]), float(item[1])))
                    if points:
                        return points

        return None

    def _get_float(self, entity: SceneEntity, *keys: str) -> float | None:
        """Extract float value from entity."""
        data = entity.model_dump()

        for key in keys:
            if key in data:
                val = data[key]
                if isinstance(val, (int, float)):
                    return float(val)

        return None

    def _get_string(self, entity: SceneEntity, *keys: str) -> str | None:
        """Extract string value from entity."""
        data = entity.model_dump()

        for key in keys:
            if key in data:
                val = data[key]
                if isinstance(val, str):
                    return val

        return None

    def _get_bool(self, entity: SceneEntity, *keys: str) -> bool:
        """Extract boolean value from entity."""
        data = entity.model_dump()

        for key in keys:
            if key in data:
                val = data[key]
                if isinstance(val, bool):
                    return val

        return False
