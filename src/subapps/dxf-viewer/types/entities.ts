/**
 * Core Entity Types for DXF Viewer
 * Provides type safety for all entity operations
 */

import type { Point2D } from '../rendering/types/Types';
import type { DxfTextNode } from '../text-engine/types';
// 🏢 ADR-107: Centralized Text Metrics Ratios
// 🏢 ADR-142: Centralized Default Font Size
import { TEXT_METRICS_RATIOS, TEXT_SIZE_LIMITS } from '../config/text-rendering-config';
// 🏢 ADR-034: Centralized Empty Spatial Bounds
import { EMPTY_SPATIAL_BOUNDS } from '../config/geometry-constants';
// 🏢 ADR-358 Phase 9C: enterprise-id SSoT for SceneLayer.id (prefix `lyr_<UUID-v4>`)
import { generateLayerId } from '@/services/enterprise-id-convenience';

// ✅ ENTERPRISE FIX: Enhanced grip point interface for preview system
// 🎯 ADR-047: Added 'close' type and optional color for close-on-first-point indicator
export interface PreviewGripPoint {
  position: Point2D;
  type: 'start' | 'end' | 'cursor' | 'vertex' | 'close'; // 🎯 ADR-047: 'close' for polygon closing
  color?: string; // 🎯 ADR-047: Optional custom color (e.g., '#00ff00' for close indicator)
}

// Base entity interface
export interface BaseEntity {
  id: string;
  name?: string;             // Optional user-friendly name for the entity
  type: EntityType;
  /** ADR-358 Phase 9E-6e: stable layer identifier `lyr_<UUID-v4>`. Required on all entities. */
  layerId: string;
  color?: string;
  selected?: boolean;
  preview?: boolean;
  measurement?: boolean;
  isOverlayPreview?: boolean;
  showPreviewGrips?: boolean;
  previewGripPoints?: Point2D[] | PreviewGripPoint[];
  visible?: boolean;
  locked?: boolean;
  metadata?: Record<string, unknown>;

  // Line styling properties (CAD Standard)
  lineweight?: number;        // Line thickness (ISO 128 standard)
  opacity?: number;           // 0.0 to 1.0
  lineType?: 'solid' | 'dashed' | 'dotted' | 'dashdot';  // Line pattern
  dashScale?: number;         // Dash pattern scale factor
  lineCap?: 'butt' | 'round' | 'square';  // Line cap style
  lineJoin?: 'miter' | 'round' | 'bevel'; // Line join style
  dashOffset?: number;        // Dash pattern offset

  // Preview/Completion flags
  breakAtCenter?: boolean;    // Split line at center for distance label
  showEdgeDistances?: boolean; // Show distance labels on preview

  // ─── ADR-358 §G7 — ByLayer / ByBlock pipeline (Phase 4) ───────────────
  // Additive optional fields. Missing = ByLayer (current behaviour preserved).
  // Active resolution at render via `systems/properties/resolve-entity-style.ts`.
  /** Explicit color resolution mode. Missing or 'ByLayer' → inherit from layer. */
  colorMode?: 'ByLayer' | 'ByBlock' | 'Concrete';
  /** ACI 1-255 — DXF group 62. Takes priority over legacy `color` hex when set. */
  colorAci?: number;
  /** TrueColor 0xRRGGBB — DXF group 420. Takes priority over ACI + hex. */
  colorTrueColor?: number | null;
  /** Linetype DXF name — case-sensitive. Literal 'ByLayer'/'ByBlock' opts into inheritance. */
  linetypeName?: string;
  /** Lineweight mm — DXF group 370. Accepts -3/-2/-1 sentinels. */
  lineweightMm?: LineweightMm;
  /** Transparency 0-90 — DXF group 1071. 0 = opaque. */
  transparency?: number;
}

// Supported entity types
export type EntityType =
  | 'line'
  | 'polyline'
  | 'lwpolyline'           // ✅ ENTERPRISE: AutoCAD lightweight polyline support
  | 'circle'
  | 'arc'
  | 'ellipse'              // ✅ ENTERPRISE: AutoCAD ellipse entity support
  | 'text'
  | 'mtext'                // ✅ ENTERPRISE: AutoCAD multiline text entity support
  | 'spline'               // ✅ ENTERPRISE: AutoCAD spline curve entity support
  | 'rectangle'
  | 'rect'                 // ✅ ENTERPRISE: Alternative rectangle entity naming convention
  | 'point'
  | 'dimension'
  | 'block'
  | 'angle-measurement'
  | 'leader'               // ✅ ENTERPRISE: AutoCAD leader/annotation entity support
  | 'hatch'                // ✅ ENTERPRISE: AutoCAD hatch pattern entity support
  | 'xline'                // ✅ ENTERPRISE: AutoCAD construction line (infinite) support
  | 'ray'                  // ✅ ENTERPRISE: AutoCAD ray (semi-infinite line) support
  | 'array'                // ADR-353: Associative array entity (rect/polar/path)
  | 'stair'                // ADR-358: Parametric stair entity (11 kinds, Phase 1+)
  | 'center-mark'          // ADR-362 Phase A1: standalone center mark (D13)
  | 'centerline'           // ADR-362 Phase A1: standalone centerline (D13)
  // ADR-363 BIM Drawing Mode (Phase 0 Bootstrap — renderers/tools in Phase 1+):
  | 'wall'                 // Parametric wall (straight/curved/polyline)
  | 'opening'              // Door/window/sliding-door/french-door/fixed — hosted in wall
  | 'slab'                 // Floor/ceiling/roof/ground/foundation slab
  | 'slab-opening'         // Elevator shaft, stair well, duct, chimney cutout
  | 'column'               // Rectangular/circular/L-shape/T-shape column
  | 'beam';                // Straight/curved/cantilever beam

// Geometric entities
export interface LineEntity extends BaseEntity {
  type: 'line';
  start: Point2D;
  end: Point2D;
  lineWidth?: number;
  lineStyle?: string;
}

export interface PolylineEntity extends BaseEntity {
  type: 'polyline';
  vertices: Point2D[];
  closed?: boolean;
  lineWidth?: number;
  lineStyle?: string;
}

export interface LWPolylineEntity extends BaseEntity {
  type: 'lwpolyline';
  vertices: Point2D[];
  closed?: boolean;
  lineWidth?: number;
  lineStyle?: string;
  constantWidth?: number;     // ✅ ENTERPRISE: AutoCAD lightweight polyline constant width
  elevation?: number;         // ✅ ENTERPRISE: AutoCAD Z-elevation for 2.5D entities
}

export interface CircleEntity extends BaseEntity {
  type: 'circle';
  center: Point2D;
  radius: number;
  fillColor?: string;
  strokeWidth?: number;
}

export interface ArcEntity extends BaseEntity {
  type: 'arc';
  center: Point2D;
  radius: number;
  startAngle: number;
  endAngle: number;
  strokeWidth?: number;
  // 🏢 ENTERPRISE: Arc direction flag for Canvas 2D rendering
  // true = draw counterclockwise, false = draw clockwise (default)
  // Determined by mouse direction during drawing (AutoCAD pattern)
  counterclockwise?: boolean;
}

export interface EllipseEntity extends BaseEntity {
  type: 'ellipse';
  center: Point2D;
  majorAxis: number;          // ✅ ENTERPRISE: AutoCAD ellipse major axis length
  minorAxis: number;          // ✅ ENTERPRISE: AutoCAD ellipse minor axis length
  rotation?: number;          // ✅ ENTERPRISE: Rotation angle in degrees
  startParam?: number;        // ✅ ENTERPRISE: Start parameter for elliptical arcs
  endParam?: number;          // ✅ ENTERPRISE: End parameter for elliptical arcs
  strokeWidth?: number;
}

export interface RectangleEntity extends BaseEntity {
  type: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  fillColor?: string;
  strokeWidth?: number;

  // ✅ ENTERPRISE COMPATIBILITY: Computed properties for grip interaction
  corner1?: Point2D;   // Top-left corner (computed from x, y)
  corner2?: Point2D;   // Bottom-right corner (computed from x+width, y+height)
}

export interface RectEntity extends BaseEntity {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  fillColor?: string;
  strokeWidth?: number;

  // ✅ ENTERPRISE COMPATIBILITY: Computed properties for grip interaction
  corner1?: Point2D;   // Top-left corner (computed from x, y)
  corner2?: Point2D;   // Bottom-right corner (computed from x+width, y+height)
}

export interface PointEntity extends BaseEntity {
  type: 'point';
  position: Point2D;
  size?: number;
  style?: 'dot' | 'cross' | 'plus' | 'circle';
}

/**
 * ADR-344 Phase 11 — One entry in the per-entity annotation-scale list.
 * Persisted via DXF XDATA group codes 1000/1070/1071 on ANNOTATIVE entities.
 */
export interface EntityAnnotationScale {
  readonly name: string;        // e.g. "1:100"
  readonly paperHeight: number; // paper-space height in mm
  readonly modelHeight: number; // model-space height = paperHeight × scaleFactor
}

export interface TextEntity extends BaseEntity {
  type: 'text';
  position: Point2D;
  text: string;
  /** SSoT for content when present — populated by DXF import (ADR-344 unification) and CreateTextCommand. */
  textNode?: DxfTextNode;
  fontSize?: number;
  height?: number;           // 🏢 ENTERPRISE: DXF text height (alias for fontSize, used by converters)
  fontFamily?: string;
  alignment?: 'left' | 'center' | 'right';
  rotation?: number;
  // 🏢 ADR-344 Phase 11 — Annotative scaling (optional, populated by XDATA parser)
  isAnnotative?: boolean;
  annotationScales?: readonly EntityAnnotationScale[];
}

export interface MTextEntity extends BaseEntity {
  type: 'mtext';
  position: Point2D;
  text: string;
  /** SSoT for content when present — populated by DXF import (ADR-344 unification) and CreateTextCommand. */
  textNode?: DxfTextNode;
  width: number;              // ✅ ENTERPRISE: AutoCAD multiline text width boundary
  height?: number;            // ✅ ENTERPRISE: AutoCAD multiline text height boundary
  fontSize?: number;
  fontFamily?: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  rotation?: number;
  lineSpacing?: number;       // ✅ ENTERPRISE: AutoCAD line spacing factor
  paragraphSpacing?: number;  // ✅ ENTERPRISE: AutoCAD paragraph spacing
  wordWrap?: boolean;         // ✅ ENTERPRISE: AutoCAD word wrap option
  // 🏢 ADR-344 Phase 11 — Annotative scaling (optional, populated by XDATA parser)
  isAnnotative?: boolean;
  annotationScales?: readonly EntityAnnotationScale[];
}

export interface SplineEntity extends BaseEntity {
  type: 'spline';
  controlPoints: Point2D[];   // ✅ ENTERPRISE: AutoCAD spline control points
  degree?: number;            // ✅ ENTERPRISE: AutoCAD spline degree (default: 3)
  knots?: number[];           // ✅ ENTERPRISE: AutoCAD spline knot vector
  weights?: number[];         // ✅ ENTERPRISE: AutoCAD spline control point weights (NURBS)
  closed?: boolean;           // ✅ ENTERPRISE: AutoCAD closed spline flag
  rational?: boolean;         // ✅ ENTERPRISE: AutoCAD rational spline (NURBS vs B-spline)
  tolerance?: number;         // ✅ ENTERPRISE: AutoCAD spline fit tolerance
}

// ADR-362 Phase A1: rich DimensionEntity discriminated union (10 variants) lives in `./dimension`.
// Legacy startPoint/endPoint/textPosition/value/unit/precision fields preserved as deprecated
// optionals inside `DimensionEntityCommon` for back-compat with existing consumers
// (PathCache.ts, InsertionSnapEngine.ts) — to be removed in Phase B/C.
import type { DimensionEntity } from './dimension';
export type { DimensionEntity } from './dimension';
export type {
  DimensionType,
  DimStyle,
  DimensionOverride,
  DimensionAssociation,
  DimensionAssociationType,
  DimLinearUnitFormat,
  DimAngularUnitFormat,
  DimTextVerticalPlacement,
  DimTextFillMode,
  DimToleranceJustify,
  DimAssociativity,
  DimInspectionMode,
  DimensionVariantByType,
  LinearDimensionEntity,
  AlignedDimensionEntity,
  Angular2LDimensionEntity,
  Angular3PDimensionEntity,
  RadiusDimensionEntity,
  DiameterDimensionEntity,
  ArcLengthDimensionEntity,
  JoggedRadiusDimensionEntity,
  OrdinateDimensionEntity,
  BaselineDimensionEntity,
  ContinuedDimensionEntity,
} from './dimension';
export {
  isLinearDimension,
  isAlignedDimension,
  isAngular2LDimension,
  isAngular3PDimension,
  isRadiusDimension,
  isDiameterDimension,
  isArcLengthDimension,
  isJoggedRadiusDimension,
  isOrdinateDimension,
  isBaselineDimension,
  isContinuedDimension,
} from './dimension';

// ADR-363 Phase 0 Bootstrap: BIM entity base types + concrete entity interfaces.
// Renderers and tools land in Phase 1+. These interfaces allow type-safe scene
// operations (selection, bounds, guards) without any rendering code.
import type {
  BimEntity,
  BimElementKind,
  BoundingBox3D,
} from '../bim/types/bim-base';

// ─── BIM entity concrete types (Phase 0 stubs — params/geometry filled Phase 1+) ─
export type WallKind = 'straight' | 'curved' | 'polyline';
export type OpeningKind = 'door' | 'window' | 'sliding-door' | 'french-door' | 'fixed';
export type SlabKind = 'floor' | 'ceiling' | 'roof' | 'ground' | 'foundation';
export type SlabOpeningKind = 'shaft' | 'well' | 'duct' | 'chimney';
export type ColumnKind = 'rectangular' | 'circular' | 'L-shape' | 'T-shape';
export type BeamKind = 'straight' | 'curved' | 'cantilever';

// Minimal geometry stub — full geometry types in bim/types/*-types.ts (Phase 1+)
interface BimGeometryStub {
  readonly bbox: BoundingBox3D;
}

// Minimal params stubs — full params in bim/types/*-types.ts (Phase 1+)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BimParamsStub = Record<string, any>;

export interface WallEntity extends BimEntity<WallKind, BimParamsStub, BimGeometryStub> {
  type: 'wall';
  hostedOpeningIds?: readonly string[];
}

export interface OpeningEntity extends BimEntity<OpeningKind, BimParamsStub, BimGeometryStub> {
  type: 'opening';
}

export interface SlabEntity extends BimEntity<SlabKind, BimParamsStub, BimGeometryStub> {
  type: 'slab';
}

export interface SlabOpeningEntity extends BimEntity<SlabOpeningKind, BimParamsStub, BimGeometryStub> {
  type: 'slab-opening';
}

export interface ColumnEntity extends BimEntity<ColumnKind, BimParamsStub, BimGeometryStub> {
  type: 'column';
}

export interface BeamEntity extends BimEntity<BeamKind, BimParamsStub, BimGeometryStub> {
  type: 'beam';
}

// Re-export BIM base types for downstream consumers
export type { BimEntity, BimElementKind, BimValidation, BimQuantityTakeoff, SoftLock, Point3D, AtoeCategoryCode } from '../bim/types/bim-base';

// ADR-362 Phase A1: standalone Center Mark + Centerline (D13).
import type { CenterMarkEntity, CenterLineEntity } from './center-mark';
export type { CenterMarkEntity, CenterLineEntity, CenterMarkStyle, CenterLineKind } from './center-mark';
export { isCenterMarkEntity, isCenterLineEntity } from './center-mark';

// ✅ ENTERPRISE: Additional entity types from scene.ts integration
export interface BlockEntity extends BaseEntity {
  type: 'block';
  name: string;              // Required: Block name (overrides optional name from BaseEntity)
  position: Point2D;
  scale: Point2D;
  rotation: number;
  entities: Entity[];
}

export interface AngleMeasurementEntity extends BaseEntity {
  type: 'angle-measurement';
  vertex: Point2D; // Center point of the angle
  point1: Point2D; // First arm endpoint
  point2: Point2D; // Second arm endpoint
  angle: number; // Angle in degrees
}

// ✅ ENTERPRISE: AutoCAD Leader Entity (annotation with arrow)
export interface LeaderEntity extends BaseEntity {
  type: 'leader';
  vertices: Point2D[];           // Leader path vertices (arrow tip to text)
  arrowHead?: {
    type: 'closed' | 'open' | 'dot' | 'none';
    size: number;
  };
  annotationText?: string;       // Associated annotation text
  annotationPosition?: Point2D;  // Text position (optional, derived from vertices)
  hookLineLength?: number;       // Length of horizontal hook at text
  hasHookLine?: boolean;         // Whether to draw hook line
}

// ✅ ENTERPRISE: AutoCAD Hatch Entity (fill pattern)
export interface HatchEntity extends BaseEntity {
  type: 'hatch';
  boundaryPaths: Point2D[][];    // Array of closed boundary paths
  patternName?: string;          // Predefined pattern name (SOLID, ANSI31, etc.)
  patternType?: 'solid' | 'gradient' | 'pattern';
  patternScale?: number;         // Pattern scale factor
  patternAngle?: number;         // Pattern rotation angle in degrees
  seedPoints?: Point2D[];        // Interior points for island detection
  fillColor?: string;            // Fill color for solid hatches
  backgroundColor?: string;      // Background color for patterns
  associative?: boolean;         // Whether hatch updates with boundary changes
}

// ✅ ENTERPRISE: AutoCAD XLine Entity (construction line - infinite in both directions)
export interface XLineEntity extends BaseEntity {
  type: 'xline';
  basePoint: Point2D;            // A point on the line
  direction: Point2D;            // Direction vector (normalized recommended)
  secondPoint?: Point2D;         // Alternative definition: second point on line
}

// ✅ ENTERPRISE: AutoCAD Ray Entity (semi-infinite line - one direction)
export interface RayEntity extends BaseEntity {
  type: 'ray';
  basePoint: Point2D;            // Ray origin point
  direction: Point2D;            // Direction vector (normalized recommended)
  secondPoint?: Point2D;         // Alternative definition: point defining direction
}

// ADR-353: Associative Array Entity.
// Defined here (not in systems/array/types.ts) to avoid a circular import
// (Entity↔ArrayEntity via hiddenSources: Entity[]).
import type { ArrayKind, ArrayParams } from '../systems/array/types';
export type { ArrayKind, ArrayParams };

// ADR-358: Parametric Stair Entity — discriminated union over 11 kinds.
import type { StairEntity } from './stair';
export type {
  StairEntity,
  StairKind,
  StairParams,
  StairVariantParams,
  StairGeometry,
  StairDoc,
  StairPresetDoc,
  StairQTO,
} from './stair';

export interface ArrayEntity extends BaseEntity {
  readonly type: 'array';
  readonly arrayKind: ArrayKind;
  /**
   * Deep-cloned source entity copies owned by this ArrayEntity.
   * Removed from scene on creation; temporarily restored in Edit Source mode.
   */
  readonly hiddenSources: Entity[];
  readonly params: ArrayParams;
  /** Path entity ID in scene (path arrays only; undefined for rect/polar). */
  readonly pathEntityId?: string;
  /** User base-point override; undefined = auto (bbox center). */
  readonly basePointOverride?: Point2D;
}

// Union type for all entities
// ✅ ENTERPRISE FIX: Explicit intersection with BaseEntity to ensure name property is available
export type Entity = (
  | LineEntity
  | PolylineEntity
  | LWPolylineEntity          // ✅ ENTERPRISE: AutoCAD lightweight polyline support
  | CircleEntity
  | ArcEntity
  | EllipseEntity            // ✅ ENTERPRISE: AutoCAD ellipse entity support
  | RectangleEntity
  | RectEntity               // ✅ ENTERPRISE: Alternative rectangle entity naming convention
  | PointEntity
  | TextEntity
  | MTextEntity              // ✅ ENTERPRISE: AutoCAD multiline text entity support
  | SplineEntity             // ✅ ENTERPRISE: AutoCAD spline curve entity support
  | DimensionEntity
  | BlockEntity
  | AngleMeasurementEntity
  | LeaderEntity             // ✅ ENTERPRISE: AutoCAD leader/annotation entity support
  | HatchEntity              // ✅ ENTERPRISE: AutoCAD hatch pattern entity support
  | XLineEntity              // ✅ ENTERPRISE: AutoCAD construction line (infinite) support
  | RayEntity                // ✅ ENTERPRISE: AutoCAD ray (semi-infinite line) support
  | ArrayEntity              // ADR-353: Associative array (rect/polar/path)
  | StairEntity              // ADR-358: Parametric stair (11 kinds)
  | CenterMarkEntity         // ADR-362 Phase A1: standalone center mark (D13)
  | CenterLineEntity         // ADR-362 Phase A1: standalone centerline (D13)
  // ADR-363 BIM Drawing Mode (Phase 0 — renderers/tools Phase 1+):
  | WallEntity
  | OpeningEntity
  | SlabEntity
  | SlabOpeningEntity
  | ColumnEntity
  | BeamEntity
) & Pick<BaseEntity, 'name'>; // ✅ ENTERPRISE: Ensures name property is always available on Entity type

// Entity collection types
export interface EntityCollection {
  entities: Entity[];
  bounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  layers: string[];
  metadata?: Record<string, unknown>;
}

// Entity creation helpers
export type CreateEntityParams<T extends Entity> = Omit<T, 'id'> & {
  id?: string;
};

// Entity update helpers
export type UpdateEntityParams<T extends Entity> = Partial<T> & {
  id: string;
};

// Entity query helpers
export interface EntityQuery {
  type?: EntityType | EntityType[];
  layer?: string | string[];
  selected?: boolean;
  visible?: boolean;
  bounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

// Entity validation
export interface EntityValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

// Type guards
export const isLineEntity = (entity: Entity): entity is LineEntity =>
  entity.type === 'line';

export const isPolylineEntity = (entity: Entity): entity is PolylineEntity =>
  entity.type === 'polyline';

export const isLWPolylineEntity = (entity: Entity): entity is LWPolylineEntity =>
  entity.type === 'lwpolyline';

export const isCircleEntity = (entity: Entity): entity is CircleEntity =>
  entity.type === 'circle';

export const isArcEntity = (entity: Entity): entity is ArcEntity =>
  entity.type === 'arc';

export const isEllipseEntity = (entity: Entity): entity is EllipseEntity =>
  entity.type === 'ellipse';

export const isRectangleEntity = (entity: Entity): entity is RectangleEntity =>
  entity.type === 'rectangle';

export const isRectEntity = (entity: Entity): entity is RectEntity =>
  entity.type === 'rect';

export const isPointEntity = (entity: Entity): entity is PointEntity =>
  entity.type === 'point';

export const isTextEntity = (entity: Entity): entity is TextEntity =>
  entity.type === 'text';

export const isMTextEntity = (entity: Entity): entity is MTextEntity =>
  entity.type === 'mtext';

export const isSplineEntity = (entity: Entity): entity is SplineEntity =>
  entity.type === 'spline';

export const isDimensionEntity = (entity: Entity): entity is DimensionEntity =>
  entity.type === 'dimension';

export const isBlockEntity = (entity: Entity): entity is BlockEntity =>
  entity.type === 'block';

export const isAngleMeasurementEntity = (entity: Entity): entity is AngleMeasurementEntity =>
  entity.type === 'angle-measurement';

// ✅ ENTERPRISE: Type guards for AutoCAD special entity types
export const isLeaderEntity = (entity: Entity): entity is LeaderEntity =>
  entity.type === 'leader';

export const isHatchEntity = (entity: Entity): entity is HatchEntity =>
  entity.type === 'hatch';

export const isXLineEntity = (entity: Entity): entity is XLineEntity =>
  entity.type === 'xline';

export const isRayEntity = (entity: Entity): entity is RayEntity =>
  entity.type === 'ray';

// ADR-353
export const isArrayEntity = (entity: Entity): entity is ArrayEntity =>
  entity.type === 'array';

// ADR-358
export const isStairEntity = (entity: Entity): entity is StairEntity =>
  entity.type === 'stair';

// ADR-362 Phase A1 — standalone center mark / centerline guards already re-exported
// from './center-mark' above (isCenterMarkEntity / isCenterLineEntity).

// ADR-363 BIM entity type guards
export const isWallEntity = (entity: Entity): entity is WallEntity =>
  entity.type === 'wall';

export const isOpeningEntity = (entity: Entity): entity is OpeningEntity =>
  entity.type === 'opening';

export const isSlabEntity = (entity: Entity): entity is SlabEntity =>
  entity.type === 'slab';

export const isSlabOpeningEntity = (entity: Entity): entity is SlabOpeningEntity =>
  entity.type === 'slab-opening';

export const isColumnEntity = (entity: Entity): entity is ColumnEntity =>
  entity.type === 'column';

export const isBeamEntity = (entity: Entity): entity is BeamEntity =>
  entity.type === 'beam';

/** True for any ADR-363 BIM parametric entity */
export const isBimEntity = (entity: Entity): entity is WallEntity | OpeningEntity | SlabEntity | SlabOpeningEntity | ColumnEntity | BeamEntity =>
  entity.type === 'wall' || entity.type === 'opening' || entity.type === 'slab' ||
  entity.type === 'slab-opening' || entity.type === 'column' || entity.type === 'beam';

// ✅ ENTERPRISE MIGRATION: generateEntityId moved to systems/entity-creation/utils.ts
// Re-export from centralized location for backward compatibility
export { generateEntityId } from '../systems/entity-creation/utils';

export const getEntityBounds = (entity: Entity): { minX: number; minY: number; maxX: number; maxY: number } => {
  switch (entity.type) {
    case 'line':
      return {
        minX: Math.min(entity.start.x, entity.end.x),
        minY: Math.min(entity.start.y, entity.end.y),
        maxX: Math.max(entity.start.x, entity.end.x),
        maxY: Math.max(entity.start.y, entity.end.y)
      };
    case 'polyline':
    case 'lwpolyline':  // ✅ ENTERPRISE: AutoCAD lightweight polyline bounds
      if ('vertices' in entity && entity.vertices && entity.vertices.length > 0) {
        const xs = entity.vertices.map(v => v.x);
        const ys = entity.vertices.map(v => v.y);
        return {
          minX: Math.min(...xs),
          minY: Math.min(...ys),
          maxX: Math.max(...xs),
          maxY: Math.max(...ys)
        };
      }
      // 🏢 ADR-034: Centralized Empty Spatial Bounds
      return EMPTY_SPATIAL_BOUNDS;
    case 'circle':
      return {
        minX: entity.center.x - entity.radius,
        minY: entity.center.y - entity.radius,
        maxX: entity.center.x + entity.radius,
        maxY: entity.center.y + entity.radius
      };
    case 'ellipse':  // ✅ ENTERPRISE: AutoCAD ellipse bounds calculation
      const maxAxisRadius = Math.max(entity.majorAxis, entity.minorAxis);
      return {
        minX: entity.center.x - maxAxisRadius,
        minY: entity.center.y - maxAxisRadius,
        maxX: entity.center.x + maxAxisRadius,
        maxY: entity.center.y + maxAxisRadius
      };
    case 'rectangle':
    case 'rect':     // ✅ ENTERPRISE: Alternative rectangle entity bounds
      return {
        minX: entity.x,
        minY: entity.y,
        maxX: entity.x + entity.width,
        maxY: entity.y + entity.height
      };
    case 'point':
      return {
        minX: entity.position.x,
        minY: entity.position.y,
        maxX: entity.position.x,
        maxY: entity.position.y
      };
    case 'text':
      // 🏢 ADR-107: Use centralized text metrics ratio for width estimation
      // 🏢 FIX (2026-02-20): Use entity.height (DXF standard) before fontSize fallback
      // DXF entities store text size in `height` (e.g. 2.5), NOT `fontSize`
      const textWidth = entity.text.length * (entity.height || entity.fontSize || 2.5) * TEXT_METRICS_RATIOS.CHAR_WIDTH_MONOSPACE;
      const textHeight = entity.height || entity.fontSize || 2.5;
      return {
        minX: entity.position.x,
        minY: entity.position.y - textHeight,
        maxX: entity.position.x + textWidth,
        maxY: entity.position.y
      };
    case 'mtext':    // ✅ ENTERPRISE: AutoCAD multiline text bounds
      // 🏢 ADR-142: Use centralized DEFAULT_FONT_SIZE for fallback
      const mtextHeight = entity.height || (entity.fontSize || TEXT_SIZE_LIMITS.DEFAULT_FONT_SIZE);
      return {
        minX: entity.position.x,
        minY: entity.position.y - mtextHeight,
        maxX: entity.position.x + entity.width,
        maxY: entity.position.y
      };
    case 'spline':   // ✅ ENTERPRISE: AutoCAD spline bounds from control points
      if ('controlPoints' in entity && entity.controlPoints && entity.controlPoints.length > 0) {
        const xs = entity.controlPoints.map(p => p.x);
        const ys = entity.controlPoints.map(p => p.y);
        return {
          minX: Math.min(...xs),
          minY: Math.min(...ys),
          maxX: Math.max(...xs),
          maxY: Math.max(...ys)
        };
      }
      // 🏢 ADR-034: Centralized Empty Spatial Bounds
      return EMPTY_SPATIAL_BOUNDS;
    case 'leader':   // ✅ ENTERPRISE: AutoCAD leader bounds from vertices
      if ('vertices' in entity && entity.vertices && entity.vertices.length > 0) {
        const leaderXs = entity.vertices.map(v => v.x);
        const leaderYs = entity.vertices.map(v => v.y);
        return {
          minX: Math.min(...leaderXs),
          minY: Math.min(...leaderYs),
          maxX: Math.max(...leaderXs),
          maxY: Math.max(...leaderYs)
        };
      }
      // 🏢 ADR-034: Centralized Empty Spatial Bounds
      return EMPTY_SPATIAL_BOUNDS;
    case 'hatch':    // ✅ ENTERPRISE: AutoCAD hatch bounds from boundary paths
      if ('boundaryPaths' in entity && entity.boundaryPaths && entity.boundaryPaths.length > 0) {
        const allPoints = entity.boundaryPaths.flat();
        if (allPoints.length > 0) {
          const hatchXs = allPoints.map(p => p.x);
          const hatchYs = allPoints.map(p => p.y);
          return {
            minX: Math.min(...hatchXs),
            minY: Math.min(...hatchYs),
            maxX: Math.max(...hatchXs),
            maxY: Math.max(...hatchYs)
          };
        }
      }
      // 🏢 ADR-034: Centralized Empty Spatial Bounds
      return EMPTY_SPATIAL_BOUNDS;
    case 'xline':    // ✅ ENTERPRISE: XLine is infinite - return basePoint as bounds center
      if ('basePoint' in entity && entity.basePoint) {
        // XLines are infinite, so we return a nominal bounds around the base point
        // Real rendering should handle infinite extent separately
        const NOMINAL_EXTENT = 10000; // Nominal extent for bounds calculation
        return {
          minX: entity.basePoint.x - NOMINAL_EXTENT,
          minY: entity.basePoint.y - NOMINAL_EXTENT,
          maxX: entity.basePoint.x + NOMINAL_EXTENT,
          maxY: entity.basePoint.y + NOMINAL_EXTENT
        };
      }
      // 🏢 ADR-034: Centralized Empty Spatial Bounds
      return EMPTY_SPATIAL_BOUNDS;
    case 'stair':    // ADR-358: project StairGeometry.bbox (3D) to 2D plan bounds
      if ('geometry' in entity && entity.geometry && entity.geometry.bbox) {
        const { min, max } = entity.geometry.bbox;
        return { minX: min.x, minY: min.y, maxX: max.x, maxY: max.y };
      }
      return EMPTY_SPATIAL_BOUNDS;
    // ADR-363 BIM entities — all carry geometry.bbox (BoundingBox3D), project to 2D
    case 'wall':
    case 'opening':
    case 'slab':
    case 'slab-opening':
    case 'column':
    case 'beam':
      if ('geometry' in entity && entity.geometry && entity.geometry.bbox) {
        const { min, max } = entity.geometry.bbox;
        return { minX: min.x, minY: min.y, maxX: max.x, maxY: max.y };
      }
      return EMPTY_SPATIAL_BOUNDS;
    case 'ray':      // ✅ ENTERPRISE: Ray is semi-infinite - return basePoint to direction extent
      if ('basePoint' in entity && entity.basePoint) {
        // Rays are semi-infinite, so we return bounds from origin in direction
        const NOMINAL_EXTENT = 10000; // Nominal extent for bounds calculation
        const dirX = entity.direction?.x ?? 1;
        const dirY = entity.direction?.y ?? 0;
        return {
          minX: Math.min(entity.basePoint.x, entity.basePoint.x + dirX * NOMINAL_EXTENT),
          minY: Math.min(entity.basePoint.y, entity.basePoint.y + dirY * NOMINAL_EXTENT),
          maxX: Math.max(entity.basePoint.x, entity.basePoint.x + dirX * NOMINAL_EXTENT),
          maxY: Math.max(entity.basePoint.y, entity.basePoint.y + dirY * NOMINAL_EXTENT)
        };
      }
      // 🏢 ADR-034: Centralized Empty Spatial Bounds
      return EMPTY_SPATIAL_BOUNDS;
    default:
      // ✅ ENTERPRISE FIX: Type-safe fallback for entities with vertices
      if ('vertices' in entity && entity.vertices && Array.isArray(entity.vertices) && entity.vertices.length > 0) {
        // ✅ ENTERPRISE: Type guard to ensure vertices are Point2D objects
        const vertices = entity.vertices as Point2D[];
        const xs = vertices.map(v => v.x);
        const ys = vertices.map(v => v.y);
        return {
          minX: Math.min(...xs),
          minY: Math.min(...ys),
          maxX: Math.max(...xs),
          maxY: Math.max(...ys)
        };
      }
      // 🏢 ADR-034: Centralized Empty Spatial Bounds
      return EMPTY_SPATIAL_BOUNDS;
  }
};

// ============================================================================
// 🔄 SCENE MANAGEMENT TYPES - Unified from scene.ts
// ============================================================================
// ✅ ENTERPRISE: Scene-specific types integrated for complete entity system

export type AnySceneEntity = Entity; // ✅ UNIFIED: Now alias to main Entity type

// ✅ ENTERPRISE: Legacy compatibility aliases
export type EntityModel = Entity; // ✅ FIX: Use full Entity type to preserve fontSize, position, text, etc.

/**
 * SceneLayer — ADR-358 §5.1 (FULL Enterprise + GOL + SSoT)
 *
 * Phase 1 shape: 12 base fields + Q15 `bimCategory` scaffold + Q16 `vpOverrides` scaffold.
 *
 * Required (always-on): name, color, visible, locked.
 * Optional in Phase 1 (default-fill at boundary I/O — DXF parser Phase 3, factory below):
 *   id, colorAci, colorTrueColor, linetype, lineweight, transparency, frozen,
 *   plottable, description, source, createdAt, category, tags, bimCategory, vpOverrides.
 *
 * All construction sites must use `createSceneLayer()` factory (ratchet `scene-layer-shape`).
 */
export interface SceneLayer {
  /** Stable identifier — `lyr_<UUID-v4>` from enterprise-id.service . REQUIRED (ADR-358 Phase 9C v2.13). Auto-generated by `createSceneLayer()` factory when input.id is omitted. Preserved across DXF round-trip via XDATA AppId `NestorLayerId`. */
  readonly id: string;
  /** Display name — DXF group 2. Mutable. */
  name: string;
  /** Legacy display color hex — kept for backward compatibility through Phase 9. Prefer `colorAci`/`colorTrueColor`. */
  color: string;
  /** ACI 1-255 — DXF group 62. Source of truth when `colorTrueColor` is null/undefined. */
  colorAci?: number;
  /** TrueColor 0xRRGGBB — DXF group 420. Overrides ACI if set. */
  colorTrueColor?: number | null;
  /** Linetype name — DXF group 6. Default "Continuous". */
  linetype?: string;
  /** Lineweight mm — DXF group 370. ISO catalog + special enums (-3/-2/-1). */
  lineweight?: LineweightMm;
  /** Transparency 0-90% — DXF group 1071 XDATA. 0 = opaque. */
  transparency?: number;
  /** ON/OFF — fast toggle, no regen. */
  visible: boolean;
  /** Freeze — skip regen (perf). DXF group 70 bit 1. */
  frozen?: boolean;
  /** Lock — no edit. DXF group 70 bit 4. */
  locked: boolean;
  /** Plottable — DXF group 290. False = not plotted. */
  plottable?: boolean;
  /** User metadata — DXF group 1000 XDATA. */
  description?: string;
  /** Provenance — internal, not DXF. */
  source?: SceneLayerSource;
  /** ISO timestamp creation — internal. */
  createdAt?: string;
  /** AEC category (Q7 §5.3.quinquies). Auto-suggested from AIA prefix. */
  category?: AecLayerCategory;
  /** Free-text tags — lowercase normalized, ≤8 entries. */
  tags?: ReadonlyArray<string>;
  /**
   * Q15 SCAFFOLD — Future BIM mode placeholder.
   * Optional IFC category string (e.g. "IfcWall", "IfcSlab").
   * Pre-commit ratchet `bim-category-scaffolding-no-active-use` BLOCKS read/write.
   * Active use deferred to Future BIM ADR (Phase 11+).
   */
  readonly bimCategory?: string | null;
  /**
   * Q16 SCAFFOLD — Future per-viewport overrides (VPLAYER).
   * Map keyed by viewportId → partial layer property overrides.
   * Pre-commit ratchet `vp-overrides-scaffolding-no-active-use` BLOCKS read/write.
   * DXF parser preserves these via XDATA round-trip but never reads in active code path (Phase 3).
   * Active use deferred to Future paperspace ADR.
   */
  readonly vpOverrides?: Record<string, Partial<VpLayerProps>> | null;
}

/** Source of a layer's creation — internal provenance, not DXF. */
export type SceneLayerSource = 'dxf-import' | 'user-created' | 'system-default';

/**
 * DXF group 370 lineweight catalog — 24 ISO values (mm) + 3 special enums.
 * Special: -3 = Default, -2 = ByLayer, -1 = ByBlock.
 */
export type LineweightMm =
  | 0 | 0.05 | 0.09 | 0.13 | 0.15 | 0.18 | 0.20 | 0.25
  | 0.30 | 0.35 | 0.40 | 0.50 | 0.53 | 0.60 | 0.70 | 0.80
  | 0.90 | 1.00 | 1.06 | 1.20 | 1.40 | 1.58 | 2.00 | 2.11
  | -3 | -2 | -1;

/** AEC discipline taxonomy — ADR-358 §5.3.quinquies (Q7). AIA prefix per category. */
export type AecLayerCategory =
  | 'architectural' | 'structural' | 'electrical' | 'mechanical'
  | 'plumbing' | 'fire' | 'civil' | 'telecom' | 'interior' | 'general';

/**
 * Q16 SCAFFOLD — VP overridable layer properties.
 * Subset of `SceneLayer` props that VPLAYER can override per-viewport.
 * Active wiring deferred; type only used for round-trip preservation in DXF I/O.
 */
export interface VpLayerProps {
  visible?: boolean;
  frozen?: boolean;
  colorAci?: number;
  colorTrueColor?: number | null;
  linetype?: string;
  lineweight?: LineweightMm;
  transparency?: number;
}

/**
 * SSoT factory for `SceneLayer` (ADR-358 §5.1).
 * Boundary I/O default-fill (DXF import, UI create, system seed) MUST go through here.
 * Pre-commit ratchet `scene-layer-shape` blocks inline literal construction outside allowlist.
 */
export function createSceneLayer(input: {
  name: string;
  color?: string;
  visible?: boolean;
  locked?: boolean;
  id?: string;
  colorAci?: number;
  colorTrueColor?: number | null;
  linetype?: string;
  lineweight?: LineweightMm;
  transparency?: number;
  frozen?: boolean;
  plottable?: boolean;
  description?: string;
  source?: SceneLayerSource;
  createdAt?: string;
  category?: AecLayerCategory;
  tags?: ReadonlyArray<string>;
  /**
   * Q15 SCAFFOLD round-trip — accepted only from DXF I/O sites (parser/writer/tests).
   * Active product code MUST NOT pass this; ratchet `bim-category-scaffolding-no-active-use`
   * blocks `.bimCategory` reads/writes outside the DXF round-trip whitelist.
   */
  bimCategory?: string | null;
  /**
   * Q16 SCAFFOLD round-trip — accepted only from DXF I/O sites (parser/writer/tests).
   * Active product code MUST NOT pass this; ratchet `vp-overrides-scaffolding-no-active-use`
   * blocks `.vpOverrides` reads/writes outside the DXF round-trip whitelist.
   */
  vpOverrides?: Record<string, Partial<VpLayerProps>> | null;
}): SceneLayer {
  return {
    id: input.id ?? generateLayerId(),
    name: input.name,
    color: input.color ?? '#ffffff',
    colorAci: input.colorAci ?? 7,
    colorTrueColor: input.colorTrueColor ?? null,
    linetype: input.linetype ?? 'Continuous',
    lineweight: input.lineweight ?? -3,
    transparency: input.transparency ?? 0,
    visible: input.visible ?? true,
    frozen: input.frozen ?? false,
    locked: input.locked ?? false,
    plottable: input.plottable ?? true,
    description: input.description,
    source: input.source ?? 'user-created',
    createdAt: input.createdAt,
    category: input.category ?? 'general',
    tags: input.tags ?? [],
    bimCategory: input.bimCategory ?? null,
    vpOverrides: input.vpOverrides ?? null,
  };
}

export interface SceneBounds {
  min: Point2D;
  max: Point2D;
}

/**
 * Stable layer identifier — `lyr_<UUID-v4>` generated by enterprise-id.service.
 * ADR-358 Phase 9E: SceneModel.layersById is keyed by this type.
 */
export type LayerId = string;

export interface SceneModel {
  entities: AnySceneEntity[];
  /** ADR-358 Phase 9E-6e: id-keyed layer map. Required on all scenes. */
  layersById: Record<LayerId, SceneLayer>;
  bounds: SceneBounds;
  units: 'mm' | 'cm' | 'm' | 'in' | 'ft';
  version?: string;
}

export interface DxfImportResult {
  success: boolean;
  scene?: SceneModel;
  error?: string;
  warnings?: string[];
  stats: {
    entityCount: number;
    layerCount: number;
    parseTimeMs: number;
  };
}