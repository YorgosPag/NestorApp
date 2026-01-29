/**
 * ============================================================================
 * DXF EXPORT API CONTRACT - ezdxf Python Microservice
 * ============================================================================
 *
 * Enterprise-grade type definitions for DXF export functionality.
 * These types define the contract between the Next.js frontend and
 * the ezdxf Python microservice.
 *
 * Technology Decision: ezdxf (MIT License, Python)
 * Reference: docs/strategy/01-dxf-technology-decision.md
 *
 * @version 1.0.0
 * @date 2026-01-30
 * @author Claude AI + Γιώργος
 *
 * ============================================================================
 * SUPPORTED DXF VERSIONS (ezdxf compatibility)
 * ============================================================================
 * - AC1009 (R12) - Most compatible, basic entities only
 * - AC1015 (R2000) - Recommended for cross-platform
 * - AC1018 (R2004) - Extended entity support
 * - AC1021 (R2007) - Unicode text support
 * - AC1024 (R2010) - Spline improvements
 * - AC1027 (R2013) - Modern features
 * - AC1032 (R2018) - Latest supported
 * ============================================================================
 */

import type { Entity, SceneModel, SceneLayer, EntityType } from './entities';
import type { Point2D } from '../rendering/types/Types';

// ============================================================================
// DXF VERSION CONFIGURATION
// ============================================================================

/**
 * Supported DXF versions for export
 * Maps to ezdxf version constants
 */
export type DxfVersion =
  | 'AC1009'  // R12 - Maximum compatibility
  | 'AC1015'  // R2000 - Recommended default
  | 'AC1018'  // R2004
  | 'AC1021'  // R2007 - Unicode support
  | 'AC1024'  // R2010
  | 'AC1027'  // R2013
  | 'AC1032'; // R2018 - Latest

/**
 * Human-readable DXF version names
 */
export const DXF_VERSION_NAMES: Record<DxfVersion, string> = {
  'AC1009': 'AutoCAD R12',
  'AC1015': 'AutoCAD 2000',
  'AC1018': 'AutoCAD 2004',
  'AC1021': 'AutoCAD 2007',
  'AC1024': 'AutoCAD 2010',
  'AC1027': 'AutoCAD 2013',
  'AC1032': 'AutoCAD 2018',
} as const;

/**
 * Default DXF version for export
 * R2000 (AC1015) offers best balance of compatibility and features
 */
export const DEFAULT_DXF_VERSION: DxfVersion = 'AC1015';

// ============================================================================
// UNIT CONFIGURATION
// ============================================================================

/**
 * Supported drawing units
 * Maps to DXF INSUNITS header variable
 */
export type DxfUnit =
  | 'unitless'   // 0 - No units
  | 'inches'     // 1 - Inches
  | 'feet'       // 2 - Feet
  | 'miles'      // 3 - Miles
  | 'millimeters'// 4 - Millimeters (recommended for technical drawings)
  | 'centimeters'// 5 - Centimeters
  | 'meters'     // 6 - Meters
  | 'kilometers' // 7 - Kilometers
  | 'microinches'// 8 - Microinches
  | 'mils'       // 9 - Mils (1/1000 inch)
  | 'yards'      // 10 - Yards
  | 'angstroms'  // 11 - Angstroms
  | 'nanometers' // 12 - Nanometers
  | 'microns'    // 13 - Microns
  | 'decimeters' // 14 - Decimeters
  | 'decameters' // 15 - Decameters
  | 'hectometers'// 16 - Hectometers
  | 'gigameters' // 17 - Gigameters
  | 'astronomical'// 18 - Astronomical units
  | 'lightyears' // 19 - Light years
  | 'parsecs';   // 20 - Parsecs

/**
 * DXF INSUNITS values
 */
export const DXF_UNIT_VALUES: Record<DxfUnit, number> = {
  'unitless': 0,
  'inches': 1,
  'feet': 2,
  'miles': 3,
  'millimeters': 4,
  'centimeters': 5,
  'meters': 6,
  'kilometers': 7,
  'microinches': 8,
  'mils': 9,
  'yards': 10,
  'angstroms': 11,
  'nanometers': 12,
  'microns': 13,
  'decimeters': 14,
  'decameters': 15,
  'hectometers': 16,
  'gigameters': 17,
  'astronomical': 18,
  'lightyears': 19,
  'parsecs': 20,
} as const;

/**
 * Default unit for export
 */
export const DEFAULT_DXF_UNIT: DxfUnit = 'millimeters';

// ============================================================================
// EXPORT SETTINGS
// ============================================================================

/**
 * Text encoding options for DXF export
 */
export type DxfEncoding = 'utf-8' | 'cp1252' | 'cp1253' | 'ascii';

/**
 * Export quality/optimization settings
 */
export interface DxfExportQuality {
  /** Decimal precision for coordinates (default: 6) */
  coordinatePrecision: number;

  /** Simplify polylines with Douglas-Peucker algorithm */
  simplifyPolylines: boolean;

  /** Tolerance for polyline simplification (in drawing units) */
  simplifyTolerance: number;

  /** Convert splines to polylines for R12 compatibility */
  splinesAsPolylines: boolean;

  /** Number of segments for spline approximation */
  splineSegments: number;

  /** Merge colinear line segments */
  mergeColinearLines: boolean;

  /** Remove duplicate entities */
  removeDuplicates: boolean;

  /** Duplicate detection tolerance */
  duplicateTolerance: number;
}

/**
 * Default export quality settings
 */
export const DEFAULT_EXPORT_QUALITY: DxfExportQuality = {
  coordinatePrecision: 6,
  simplifyPolylines: false,
  simplifyTolerance: 0.001,
  splinesAsPolylines: false,
  splineSegments: 32,
  mergeColinearLines: false,
  removeDuplicates: false,
  duplicateTolerance: 0.0001,
} as const;

/**
 * Layer export configuration
 */
export interface DxfLayerConfig {
  /** Export only visible layers */
  visibleOnly: boolean;

  /** Include locked layers */
  includeLocked: boolean;

  /** Flatten all entities to single layer */
  flattenToLayer: string | null;

  /** Layer name mapping (original → exported) */
  layerMapping: Record<string, string>;

  /** Default layer for entities without layer */
  defaultLayer: string;
}

/**
 * Default layer configuration
 */
export const DEFAULT_LAYER_CONFIG: DxfLayerConfig = {
  visibleOnly: true,
  includeLocked: false,
  flattenToLayer: null,
  layerMapping: {},
  defaultLayer: '0',
} as const;

/**
 * Complete export settings
 */
export interface DxfExportSettings {
  /** Target DXF version */
  version: DxfVersion;

  /** Drawing units */
  units: DxfUnit;

  /** Text encoding */
  encoding: DxfEncoding;

  /** Quality/optimization settings */
  quality: DxfExportQuality;

  /** Layer configuration */
  layers: DxfLayerConfig;

  /** Include metadata as DXF XDATA */
  includeMetadata: boolean;

  /** Add timestamp to file header */
  includeTimestamp: boolean;

  /** Application name for DXF header */
  applicationName: string;

  /** Custom header variables */
  headerVariables: Record<string, string | number>;
}

/**
 * Default export settings factory
 */
export function createDefaultExportSettings(): DxfExportSettings {
  return {
    version: DEFAULT_DXF_VERSION,
    units: DEFAULT_DXF_UNIT,
    encoding: 'utf-8',
    quality: { ...DEFAULT_EXPORT_QUALITY },
    layers: { ...DEFAULT_LAYER_CONFIG },
    includeMetadata: true,
    includeTimestamp: true,
    applicationName: 'Nestor DXF Viewer',
    headerVariables: {},
  };
}

// ============================================================================
// ENTITY MAPPING TYPES (Nestor → ezdxf)
// ============================================================================

/**
 * ezdxf entity type names
 * Maps Nestor entity types to ezdxf entity classes
 */
export type EzdxfEntityType =
  | 'LINE'
  | 'POLYLINE'
  | 'LWPOLYLINE'
  | 'CIRCLE'
  | 'ARC'
  | 'ELLIPSE'
  | 'TEXT'
  | 'MTEXT'
  | 'SPLINE'
  | 'POINT'
  | 'DIMENSION'
  | 'INSERT'      // Block reference
  | 'LEADER'
  | 'HATCH'
  | 'XLINE'
  | 'RAY';

/**
 * Mapping from Nestor entity types to ezdxf types
 */
export const ENTITY_TYPE_MAPPING: Record<EntityType, EzdxfEntityType | null> = {
  'line': 'LINE',
  'polyline': 'POLYLINE',
  'lwpolyline': 'LWPOLYLINE',
  'circle': 'CIRCLE',
  'arc': 'ARC',
  'ellipse': 'ELLIPSE',
  'text': 'TEXT',
  'mtext': 'MTEXT',
  'spline': 'SPLINE',
  'rectangle': 'LWPOLYLINE',  // Rectangles export as closed polylines
  'rect': 'LWPOLYLINE',       // Rectangles export as closed polylines
  'point': 'POINT',
  'dimension': 'DIMENSION',
  'block': 'INSERT',
  'angle-measurement': null,  // Internal measurement, not exported
  'leader': 'LEADER',
  'hatch': 'HATCH',
  'xline': 'XLINE',
  'ray': 'RAY',
} as const;

/**
 * Base ezdxf entity representation
 */
interface EzdxfBaseEntity {
  /** ezdxf entity type */
  dxftype: EzdxfEntityType;

  /** Layer name */
  layer: string;

  /** AutoCAD Color Index (ACI) */
  color: number;

  /** Line type name */
  linetype: string;

  /** Line weight (1/100 mm) */
  lineweight: number;

  /** True color (RGB) if not using ACI */
  true_color?: [number, number, number];

  /** Transparency (0-100) */
  transparency?: number;
}

/**
 * ezdxf LINE entity
 */
export interface EzdxfLine extends EzdxfBaseEntity {
  dxftype: 'LINE';
  start: [number, number, number];  // [x, y, z]
  end: [number, number, number];
}

/**
 * ezdxf LWPOLYLINE entity
 */
export interface EzdxfLWPolyline extends EzdxfBaseEntity {
  dxftype: 'LWPOLYLINE';
  points: Array<[number, number]>;  // [x, y] pairs
  closed: boolean;
  const_width: number;
  elevation: number;
}

/**
 * ezdxf CIRCLE entity
 */
export interface EzdxfCircle extends EzdxfBaseEntity {
  dxftype: 'CIRCLE';
  center: [number, number, number];
  radius: number;
}

/**
 * ezdxf ARC entity
 */
export interface EzdxfArc extends EzdxfBaseEntity {
  dxftype: 'ARC';
  center: [number, number, number];
  radius: number;
  start_angle: number;  // Degrees, CCW from +X
  end_angle: number;
}

/**
 * ezdxf ELLIPSE entity
 */
export interface EzdxfEllipse extends EzdxfBaseEntity {
  dxftype: 'ELLIPSE';
  center: [number, number, number];
  major_axis: [number, number, number];  // Vector from center to major axis endpoint
  ratio: number;  // Minor/Major ratio (0-1)
  start_param: number;  // Start parameter (radians)
  end_param: number;    // End parameter (radians, 2*PI for full ellipse)
}

/**
 * ezdxf TEXT entity
 */
export interface EzdxfText extends EzdxfBaseEntity {
  dxftype: 'TEXT';
  insert: [number, number, number];
  text: string;
  height: number;
  rotation: number;  // Degrees
  style: string;     // Text style name
  halign: number;    // Horizontal alignment (0=left, 1=center, 2=right)
  valign: number;    // Vertical alignment (0=baseline, 1=bottom, 2=middle, 3=top)
}

/**
 * ezdxf MTEXT entity
 */
export interface EzdxfMText extends EzdxfBaseEntity {
  dxftype: 'MTEXT';
  insert: [number, number, number];
  text: string;
  char_height: number;
  width: number;
  rotation: number;
  attachment_point: number;  // 1-9 (top-left to bottom-right)
  line_spacing_factor: number;
  style: string;
}

/**
 * ezdxf SPLINE entity
 */
export interface EzdxfSpline extends EzdxfBaseEntity {
  dxftype: 'SPLINE';
  degree: number;
  control_points: Array<[number, number, number]>;
  knots: number[];
  weights?: number[];
  closed: boolean;
}

/**
 * ezdxf POINT entity
 */
export interface EzdxfPoint extends EzdxfBaseEntity {
  dxftype: 'POINT';
  location: [number, number, number];
}

/**
 * ezdxf HATCH entity
 */
export interface EzdxfHatch extends EzdxfBaseEntity {
  dxftype: 'HATCH';
  pattern_name: string;
  pattern_type: number;  // 0=user, 1=predefined, 2=custom
  pattern_scale: number;
  pattern_angle: number;
  solid_fill: boolean;
  paths: Array<{
    type: 'polyline' | 'edges';
    vertices?: Array<[number, number]>;
    edges?: Array<{
      type: 'line' | 'arc' | 'ellipse' | 'spline';
      data: Record<string, unknown>;
    }>;
  }>;
}

/**
 * Union of all ezdxf entity types
 */
export type EzdxfEntity =
  | EzdxfLine
  | EzdxfLWPolyline
  | EzdxfCircle
  | EzdxfArc
  | EzdxfEllipse
  | EzdxfText
  | EzdxfMText
  | EzdxfSpline
  | EzdxfPoint
  | EzdxfHatch;

// ============================================================================
// API REQUEST TYPES
// ============================================================================

/**
 * Single entity export request
 */
export interface DxfExportEntityRequest {
  /** Entity to export (Nestor format) */
  entity: Entity;

  /** Override layer for this entity */
  layerOverride?: string;

  /** Override color for this entity */
  colorOverride?: string;
}

/**
 * Scene export request
 */
export interface DxfExportSceneRequest {
  /** Scene model to export */
  scene: SceneModel;

  /** Export settings */
  settings: DxfExportSettings;

  /** Optional: specific entity IDs to export (null = all) */
  entityIds?: string[] | null;

  /** Optional: specific layers to export (null = all per settings) */
  layerNames?: string[] | null;
}

/**
 * Batch export request (multiple files)
 */
export interface DxfExportBatchRequest {
  /** Array of export requests */
  requests: Array<{
    /** Unique identifier for this export */
    id: string;

    /** Scene to export */
    scene: SceneModel;

    /** Export settings (can override default) */
    settings?: Partial<DxfExportSettings>;

    /** Output filename hint */
    filenameHint?: string;
  }>;

  /** Default settings for all exports */
  defaultSettings: DxfExportSettings;

  /** Output format */
  outputFormat: 'individual' | 'zip';
}

/**
 * Export validation request
 * Validates entities before export without generating DXF
 */
export interface DxfExportValidationRequest {
  /** Scene to validate */
  scene: SceneModel;

  /** Target DXF version for validation */
  targetVersion: DxfVersion;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Export result status
 */
export type DxfExportStatus = 'success' | 'partial' | 'error';

/**
 * Entity export result
 */
export interface DxfEntityExportResult {
  /** Original entity ID */
  entityId: string;

  /** Export success */
  success: boolean;

  /** ezdxf entity type used */
  dxfType: EzdxfEntityType | null;

  /** Warning messages */
  warnings: string[];

  /** Error message if failed */
  error?: string;
}

/**
 * Single export response
 */
export interface DxfExportResponse {
  /** Overall status */
  status: DxfExportStatus;

  /** DXF file content (base64 encoded) */
  data?: string;

  /** File size in bytes */
  fileSize?: number;

  /** MIME type */
  mimeType: 'application/dxf' | 'application/octet-stream';

  /** Suggested filename */
  filename: string;

  /** Export statistics */
  stats: {
    /** Total entities in scene */
    totalEntities: number;

    /** Successfully exported entities */
    exportedEntities: number;

    /** Skipped entities (not exportable) */
    skippedEntities: number;

    /** Failed entities */
    failedEntities: number;

    /** Total layers exported */
    layersExported: number;

    /** Export duration in milliseconds */
    exportTimeMs: number;
  };

  /** Per-entity results */
  entityResults: DxfEntityExportResult[];

  /** Global warnings */
  warnings: string[];

  /** Error message if status is 'error' */
  error?: string;
}

/**
 * Batch export response
 */
export interface DxfExportBatchResponse {
  /** Overall status */
  status: DxfExportStatus;

  /** Individual results */
  results: Array<{
    /** Request ID */
    id: string;

    /** Individual export response */
    response: DxfExportResponse;
  }>;

  /** ZIP file content if outputFormat was 'zip' (base64 encoded) */
  zipData?: string;

  /** Total export time */
  totalTimeMs: number;
}

/**
 * Validation result for a single entity
 */
export interface DxfEntityValidationResult {
  /** Entity ID */
  entityId: string;

  /** Entity type */
  entityType: EntityType;

  /** Is entity exportable to target version */
  exportable: boolean;

  /** Validation issues */
  issues: Array<{
    /** Issue severity */
    severity: 'error' | 'warning' | 'info';

    /** Issue code */
    code: string;

    /** Human-readable message */
    message: string;

    /** Suggestion for fixing */
    suggestion?: string;
  }>;
}

/**
 * Validation response
 */
export interface DxfExportValidationResponse {
  /** Overall validation passed */
  valid: boolean;

  /** Target version validated against */
  targetVersion: DxfVersion;

  /** Total entities checked */
  totalEntities: number;

  /** Exportable entities count */
  exportableEntities: number;

  /** Non-exportable entities count */
  nonExportableEntities: number;

  /** Per-entity validation results */
  entityResults: DxfEntityValidationResult[];

  /** Summary of issues by severity */
  issueSummary: {
    errors: number;
    warnings: number;
    info: number;
  };
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * DXF Export error codes
 */
export type DxfExportErrorCode =
  | 'INVALID_SCENE'
  | 'INVALID_SETTINGS'
  | 'INVALID_ENTITY'
  | 'UNSUPPORTED_ENTITY_TYPE'
  | 'VERSION_INCOMPATIBLE'
  | 'ENCODING_ERROR'
  | 'LAYER_NOT_FOUND'
  | 'COORDINATE_OUT_OF_RANGE'
  | 'SPLINE_CONVERSION_FAILED'
  | 'HATCH_BOUNDARY_INVALID'
  | 'BLOCK_REFERENCE_MISSING'
  | 'DIMENSION_STYLE_MISSING'
  | 'TEXT_STYLE_MISSING'
  | 'MICROSERVICE_UNAVAILABLE'
  | 'MICROSERVICE_TIMEOUT'
  | 'MICROSERVICE_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * DXF Export error
 */
export interface DxfExportError {
  /** Error code */
  code: DxfExportErrorCode;

  /** Human-readable message */
  message: string;

  /** Additional details */
  details?: Record<string, unknown>;

  /** Related entity ID if applicable */
  entityId?: string;

  /** Stack trace (development only) */
  stack?: string;
}

// ============================================================================
// MICROSERVICE HEALTH & STATUS
// ============================================================================

/**
 * Microservice health status
 */
export interface EzdxfMicroserviceHealth {
  /** Service is healthy */
  healthy: boolean;

  /** Service version */
  version: string;

  /** ezdxf library version */
  ezdxfVersion: string;

  /** Python version */
  pythonVersion: string;

  /** Supported DXF versions */
  supportedVersions: DxfVersion[];

  /** Service uptime in seconds */
  uptimeSeconds: number;

  /** Last health check timestamp */
  lastCheck: string;
}

// ============================================================================
// COLOR CONVERSION UTILITIES
// ============================================================================

/**
 * AutoCAD Color Index (ACI) standard colors
 */
export const ACI_COLORS: Record<number, string> = {
  0: '#000000',   // ByBlock
  1: '#FF0000',   // Red
  2: '#FFFF00',   // Yellow
  3: '#00FF00',   // Green
  4: '#00FFFF',   // Cyan
  5: '#0000FF',   // Blue
  6: '#FF00FF',   // Magenta
  7: '#FFFFFF',   // White/Black (depends on background)
  8: '#808080',   // Gray
  9: '#C0C0C0',   // Light Gray
  // ... more colors can be added (ACI has 256 colors)
} as const;

/**
 * Convert hex color to ACI (best match)
 */
export function hexToAci(hex: string): number {
  // Simple implementation - find closest ACI color
  // Full implementation would use color distance calculation
  const normalized = hex.toUpperCase().replace('#', '');

  for (const [aci, color] of Object.entries(ACI_COLORS)) {
    if (color.toUpperCase().replace('#', '') === normalized) {
      return parseInt(aci, 10);
    }
  }

  // Default to white/black (7) if no match
  return 7;
}

/**
 * Convert ACI to hex color
 */
export function aciToHex(aci: number): string {
  return ACI_COLORS[aci] || '#FFFFFF';
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if entity type is exportable to DXF
 */
export function isExportableEntityType(type: EntityType): boolean {
  return ENTITY_TYPE_MAPPING[type] !== null;
}

/**
 * Get ezdxf entity type for Nestor entity type
 */
export function getEzdxfEntityType(type: EntityType): EzdxfEntityType | null {
  return ENTITY_TYPE_MAPPING[type];
}

/**
 * Check if DXF version supports entity type
 */
export function versionSupportsEntity(version: DxfVersion, entityType: EntityType): boolean {
  const dxfType = ENTITY_TYPE_MAPPING[entityType];
  if (!dxfType) return false;

  // R12 (AC1009) has limited entity support
  if (version === 'AC1009') {
    const r12Supported: EzdxfEntityType[] = [
      'LINE', 'POLYLINE', 'CIRCLE', 'ARC', 'TEXT', 'POINT',
    ];
    return r12Supported.includes(dxfType);
  }

  // R2000+ supports all entity types
  return true;
}
