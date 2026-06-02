/**
 * Core Entity Types for DXF Viewer
 * Provides type safety for all entity operations
 */

import type { Point2D } from '../rendering/types/Types';
import type { DxfTextNode } from '../text-engine/types';
import type { LineweightMm } from './scene-types';

// ─── BaseEntity + EntityType extracted to break circular import (ADR-363 fix) ─
// bim-base.ts used to import BaseEntity from here → created:
//   entities.ts → bim/wall-types.ts → bim/bim-base.ts → entities.ts (circular)
// Now bim-base.ts imports from base-entity.ts directly — no cycle.
export type { PreviewGripPoint, EntityType, BaseEntity } from './base-entity';
import type { PreviewGripPoint, EntityType, BaseEntity } from './base-entity';

// EntityType is re-exported from base-entity.ts above (duplicate removed)

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

// ─── BIM entity concrete types ──────────────────────────────────────────────
// ADR-363 Phase 1: Wall promoted to concrete types (WallParams + WallGeometry).
// Phase 2: Opening promoted. Phase 3: Slab promoted.
// Other entities (slab-opening/column/beam) remain stubs until their phases.
// BIM types live in `bim/types/*-types.ts` per N.7.1 SRP — this file re-exports
// them so legacy imports keep working.
// `OpeningKind` re-exported below from `bim/types/opening-types` (Phase 2 concrete).
// `SlabKind` re-exported below from `bim/types/slab-types` (Phase 3 concrete).
export type SlabOpeningKind = 'shaft' | 'well' | 'duct' | 'chimney';

// Minimal geometry stub — full geometry types in bim/types/*-types.ts (Phase 2+)
interface BimGeometryStub {
  readonly bbox: BoundingBox3D;
}

// Minimal params stubs — full params in bim/types/*-types.ts (Phase 2+)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BimParamsStub = Record<string, any>;

// ADR-363 Phase 1: Wall concrete types live in bim/types/wall-types.ts (SRP).
// Imported here for local references (Entity union, isWallEntity guard) and
// re-exported so legacy `@/.../types/entities` imports keep working.
import type {
  WallKind,
  WallCategory,
  WallParams,
  WallGeometry,
  WallEntity,
} from '../bim/types/wall-types';
import type { WallDna, WallDnaLayer, WallLayerSide } from '../bim/types/wall-dna-types';
export type {
  WallKind,
  WallCategory,
  WallParams,
  WallGeometry,
  WallEntity,
  WallDna,
  WallDnaLayer,
  WallLayerSide,
};

// ADR-363 Phase 2: Opening concrete types live in bim/types/opening-types.ts (SRP).
// Re-export through this barrel for legacy `@/.../types/entities` imports.
export type {
  OpeningKind,
  OpeningHanding,
  OpeningSwing,
  OpeningParams,
  OpeningGeometry,
  OpeningEntity,
} from '../bim/types/opening-types';
// Re-import the concrete OpeningEntity here so the Entity union (below) keeps
// using it instead of the stub-based placeholder.
import type { OpeningEntity } from '../bim/types/opening-types';

// ADR-363 Phase 3: Slab concrete types live in bim/types/slab-types.ts (SRP).
// Re-export through this barrel for legacy `@/.../types/entities` imports.
export type {
  SlabKind,
  SlabReinforcement,
  SlabParams,
  SlabGeometry,
  SlabEntity,
} from '../bim/types/slab-types';
// Re-import the concrete SlabEntity here so the Entity union (below) keeps
// using it instead of the stub-based placeholder.
import type { SlabEntity } from '../bim/types/slab-types';

// ADR-363 Phase 4: Column concrete types live in bim/types/column-types.ts (SRP).
// Re-export through this barrel for legacy `@/.../types/entities` imports.
export type {
  ColumnKind,
  ColumnAnchor,
  ColumnParams,
  ColumnGeometry,
  ColumnEntity,
  ColumnLshapeParams,
  ColumnTshapeParams,
} from '../bim/types/column-types';
import type { ColumnEntity } from '../bim/types/column-types';

// ADR-406: MEP point-based fixture concrete types live in bim/types/mep-fixture-types.ts (SRP).
export type {
  MepFixtureKind,
  MepFixtureShape,
  MepFixtureParams,
  MepFixtureGeometry,
  MepFixtureEntity,
} from '../bim/types/mep-fixture-types';
import type { MepFixtureEntity } from '../bim/types/mep-fixture-types';

// ADR-408 Φ3: electrical panel concrete types live in bim/types/electrical-panel-types.ts (SRP).
export type {
  ElectricalPanelKind,
  ElectricalPanelShape,
  ElectricalPanelParams,
  ElectricalPanelGeometry,
  ElectricalPanelEntity,
} from '../bim/types/electrical-panel-types';
import type { ElectricalPanelEntity } from '../bim/types/electrical-panel-types';

// ADR-407: standalone path-based railing concrete types live in bim/types/railing-types.ts (SRP).
export type {
  RailingKind,
  RailingType,
  RailingParams,
  RailingGeometry,
  RailingEntity,
} from '../bim/types/railing-types';
import type { RailingEntity } from '../bim/types/railing-types';

// ADR-363 Phase 5: Beam concrete types live in bim/types/beam-types.ts (SRP).
export type {
  BeamKind,
  BeamSupportType,
  BeamParams,
  BeamGeometry,
  BeamEntity,
} from '../bim/types/beam-types';
import type { BeamEntity } from '../bim/types/beam-types';

// ADR-363 Phase 3.7: Slab-opening concrete types live in
// bim/types/slab-opening-types.ts (SRP). Re-export through this barrel.
export type {
  SlabOpeningKind as SlabOpeningKindBim,
  SlabOpeningParams,
  SlabOpeningGeometry,
  SlabOpeningEntity,
} from '../bim/types/slab-opening-types';
import type { SlabOpeningEntity } from '../bim/types/slab-opening-types';

// Re-export BIM base types for downstream consumers
export type { BimEntity, BimElementKind, BimValidation, SoftLock, Point3D, AtoeCategoryCode } from '../bim/types/bim-base';

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
// ADR-363 Phase 0.5 follow-up: import from canonical bim/ path (types/stair.ts barrel deleted).
import type { StairEntity } from '../bim/types/stair-types';
export type {
  StairEntity,
  StairKind,
  StairParams,
  StairVariantParams,
  StairGeometry,
  StairDoc,
  StairPresetDoc,
} from '../bim/types/stair-types';

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
  // ADR-406 — point-based MEP fixture (light fixture first).
  | MepFixtureEntity
  // ADR-408 Φ3 — point-based electrical panel (circuit source).
  | ElectricalPanelEntity
  // ADR-407 — standalone path-based railing.
  | RailingEntity
) & Pick<BaseEntity,
  // Required identifiers — needed everywhere (ADR-363 fix: BIM entities now in union)
  'id' | 'name' | 'layerId' |
  // Optional styling/state — accessed broadly across hooks/renderers
  'visible' | 'color' | 'colorMode' | 'colorAci' | 'colorTrueColor' |
  'linetypeName' | 'lineweightMm' | 'transparency' |
  'showPreviewGrips' | 'previewGripPoints' |
  'selected' | 'preview' | 'measurement'
>; // ✅ ADR-363: exposes all BaseEntity props used via Entity union (Autodesk pattern)

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

/** ADR-406 — point-based MEP fixture (light fixture first). */
export const isMepFixtureEntity = (entity: Entity): entity is MepFixtureEntity =>
  entity.type === 'mep-fixture';

/** ADR-408 Φ3 — point-based electrical panel (circuit source). */
export const isElectricalPanelEntity = (entity: Entity): entity is ElectricalPanelEntity =>
  entity.type === 'electrical-panel';

/** ADR-407 — standalone path-based railing. */
export const isRailingEntity = (entity: Entity): entity is RailingEntity =>
  entity.type === 'railing';

/** True for any ADR-363/406/407/408 BIM parametric entity */
export const isBimEntity = (entity: Entity): entity is WallEntity | OpeningEntity | SlabEntity | SlabOpeningEntity | ColumnEntity | BeamEntity | MepFixtureEntity | ElectricalPanelEntity | RailingEntity =>
  entity.type === 'wall' || entity.type === 'opening' || entity.type === 'slab' ||
  entity.type === 'slab-opening' || entity.type === 'column' || entity.type === 'beam' ||
  entity.type === 'mep-fixture' || entity.type === 'electrical-panel' || entity.type === 'railing';

// ✅ ENTERPRISE MIGRATION: generateEntityId moved to systems/entity-creation/utils.ts
// Re-export from centralized location for backward compatibility
export { generateEntityId } from '../systems/entity-creation/utils';

export { getEntityBounds, getEntityRenderBounds, getEntityExtentsBounds } from './entity-bounds';
export type { SpatialBounds } from './entity-bounds';

// Scene aliases — simple Entity re-names kept here for backward compat.
// Full scene types (SceneLayer, SceneModel, etc.) live in ./scene-types.
export type AnySceneEntity = Entity;
export type EntityModel = Entity;

export type {
  LineweightMm,
  SceneLayerSource,
  AecLayerCategory,
  VpLayerProps,
  SceneLayer,
  SceneBounds,
  LayerId,
  SceneModel,
  DxfImportResult,
} from './scene-types';
export { createSceneLayer } from './scene-types';