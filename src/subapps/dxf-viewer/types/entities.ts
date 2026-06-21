/**
 * Core Entity Types for DXF Viewer
 * Provides type safety for all entity operations
 */

import type { Point2D } from '../rendering/types/Types';
import type { DxfTextNode } from '../text-engine/types';
import type { LineweightMm } from './scene-types';
import type { HatchPattern } from '../data/hatch-pattern-catalog';

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
// ADR-436 — structural foundation (substructure) entity.
import type { FoundationEntity } from '../bim/types/foundation-types';

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

// ADR-408 Φ12: plumbing manifold concrete types live in bim/types/mep-manifold-types.ts (SRP).
export type {
  MepManifoldKind,
  MepManifoldShape,
  MepManifoldParams,
  MepManifoldGeometry,
  MepManifoldEntity,
} from '../bim/types/mep-manifold-types';
import type { MepManifoldEntity } from '../bim/types/mep-manifold-types';

// ADR-408 Εύρος Β: heating radiator concrete types live in bim/types/mep-radiator-types.ts (SRP).
export type {
  MepRadiatorKind,
  MepRadiatorShape,
  MepRadiatorParams,
  MepRadiatorGeometry,
  MepRadiatorEntity,
} from '../bim/types/mep-radiator-types';
import type { MepRadiatorEntity } from '../bim/types/mep-radiator-types';

// ADR-408 Εύρος Β #2: heating boiler concrete types live in bim/types/mep-boiler-types.ts (SRP).
export type {
  MepBoilerKind,
  MepBoilerShape,
  MepBoilerParams,
  MepBoilerGeometry,
  MepBoilerEntity,
} from '../bim/types/mep-boiler-types';
import type { MepBoilerEntity } from '../bim/types/mep-boiler-types';

// ADR-408 DHW: domestic hot water heater concrete types live in bim/types/mep-water-heater-types.ts (SRP).
export type {
  MepWaterHeaterKind,
  MepWaterHeaterShape,
  MepWaterHeaterParams,
  MepWaterHeaterGeometry,
  MepWaterHeaterEntity,
} from '../bim/types/mep-water-heater-types';
import type { MepWaterHeaterEntity } from '../bim/types/mep-water-heater-types';

// ADR-408 Εύρος Β #3: underfloor heating concrete types live in bim/types/mep-underfloor-types.ts (SRP).
export type {
  MepUnderfloorKind,
  MepUnderfloorPattern,
  MepUnderfloorParams,
  MepUnderfloorGeometry,
  MepUnderfloorEntity,
} from '../bim/types/mep-underfloor-types';
import type { MepUnderfloorEntity } from '../bim/types/mep-underfloor-types';

// ADR-407: standalone path-based railing concrete types live in bim/types/railing-types.ts (SRP).
export type {
  RailingKind,
  RailingType,
  RailingParams,
  RailingGeometry,
  RailingEntity,
} from '../bim/types/railing-types';
import type { RailingEntity } from '../bim/types/railing-types';

// ADR-410: mesh-based CC0 furniture concrete types live in bim/types/furniture-types.ts (SRP).
export type {
  FurnitureKind,
  FurnitureParams,
  FurnitureGeometry,
  FurnitureEntity,
} from '../bim/types/furniture-types';
import type { FurnitureEntity } from '../bim/types/furniture-types';

// ADR-415: pure-vector 2D floorplan symbol types live in bim/types/floorplan-symbol-types.ts (SRP).
export type {
  FloorplanSymbolCategory,
  FloorplanSymbolKind,
  FloorplanSymbolParams,
  FloorplanSymbolGeometry,
  FloorplanSymbolEntity,
} from '../bim/types/floorplan-symbol-types';
import type { FloorplanSymbolEntity } from '../bim/types/floorplan-symbol-types';

// ADR-417: parametric pitched roof concrete types live in bim/types/roof-types.ts (SRP).
export type {
  RoofKind,
  RoofShape,
  RoofSlopeUnit,
  RoofEdgeSlope,
  RoofParams,
  RoofGeometry,
  RoofEntity,
} from '../bim/types/roof-types';
import type { RoofEntity } from '../bim/types/roof-types';

// ADR-419 — thin polygon floor covering per room (IfcCovering FLOORING).
export type {
  FloorFinishMaterialId,
  FloorFinishHatchType,
  FloorFinishParams,
  FloorFinishGeometry,
  FloorFinishEntity,
} from '../bim/types/floor-finish-types';
import type { FloorFinishEntity } from '../bim/types/floor-finish-types';

// ADR-511 — wall finish per room/face (IfcCovering CLADDING/INTERIOR).
export type {
  WallCoveringMaterialId,
  WallCoveringHatchType,
  WallCoveringLayer,
  WallCoveringFaceSide,
  WallCoveringKind,
  WallCoveringParams,
  WallCoveringGeometry,
  WallCoveringEntity,
} from '../bim/types/wall-covering-types';
import type { WallCoveringEntity } from '../bim/types/wall-covering-types';

// ADR-422 — analytical thermal space / θερμικός χώρος (IfcSpace).
export type {
  ThermalSpaceUseType,
  ThermalSpaceParams,
  ThermalSpaceGeometry,
  ThermalSpaceEntity,
} from '../bim/types/thermal-space-types';
import type { ThermalSpaceEntity } from '../bim/types/thermal-space-types';

// ADR-437 — space separator / γραμμή διαχωρισμού χώρου (IfcVirtualElement).
export type {
  SpaceSeparatorKind,
  SpaceSeparatorParams,
  SpaceSeparatorGeometry,
  SpaceSeparatorEntity,
} from '../bim/types/space-separator-types';
import type { SpaceSeparatorEntity } from '../bim/types/space-separator-types';

// ADR-408 Φ8: unified linear MEP segment (duct + pipe) types live in bim/types/mep-segment-types.ts (SRP).
export type {
  MepSegmentDomain,
  MepSegmentKind,
  MepSegmentSectionKind,
  MepSegmentParams,
  MepSegmentGeometry,
  MepSegmentEntity,
} from '../bim/types/mep-segment-types';
import type { MepSegmentEntity } from '../bim/types/mep-segment-types';

// ADR-408 Φ11: auto pipe fittings (point-based junction element).
export type {
  MepFittingDomain,
  MepFittingKind,
  ElbowStyle,
  MepFittingParams,
  MepFittingGeometry,
  MepFittingEntity,
} from '../bim/types/mep-fitting-types';
import type { MepFittingEntity } from '../bim/types/mep-fitting-types';

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
// 🏢 ADR-507 — γραμμοσκίαση (hatch) όπως AutoCAD HATCH/BHATCH. Φ1a προσθέτει τα
// πεδία solid + user-defined lines + island/draw-order (incremental — οι υπόλοιπες
// φάσεις προσθέτουν gradient/predefined PAT/associative metadata).
// ⚠️ opacity/transparency/colorMode κληρονομούνται από BaseEntity — ΜΗΝ διπλασιάζεις.
export interface HatchEntity extends BaseEntity {
  type: 'hatch';
  boundaryPaths: Point2D[][];    // Array of closed boundary paths (path[0] = outer, rest = islands)
  patternName?: string;          // Predefined pattern name (SOLID, ANSI31, etc.)
  patternType?: 'solid' | 'gradient' | 'pattern';
  patternScale?: number;         // Pattern scale factor
  patternAngle?: number;         // Pattern rotation angle in degrees
  seedPoints?: Point2D[];        // Interior points for island detection
  fillColor?: string;            // Fill color for solid hatches
  backgroundColor?: string;      // Background color for patterns
  associative?: boolean;         // Whether hatch updates with boundary changes
  // ── ADR-507 Φ1a ────────────────────────────────────────────────────────────
  /** Fill family. 'solid' = συμπαγές γέμισμα· 'user-defined' = παράλληλες γραμμές
   *  (lineAngle/lineSpacing)· 'predefined' = PAT pattern (Φ2)· 'gradient' (Φ5). */
  fillType?: 'solid' | 'user-defined' | 'predefined' | 'gradient';
  /** Island detection style (DXF code 75): normal=even-odd, outer, ignore. */
  islandStyle?: 'normal' | 'outer' | 'ignore';
  /** User-defined hatch — γωνία γραμμών (μοίρες). */
  lineAngle?: number;
  /** User-defined hatch — κάθετη απόσταση γραμμών (mm). */
  lineSpacing?: number;
  /** User-defined hatch — διπλή (σταυρωτή) γραμμοσκίαση. */
  doubleCrossHatch?: boolean;
  /** Σημείο αναφοράς (phase) του μοτίβου — προεπιλογή world origin. */
  patternOrigin?: Point2D;
  /** Inline (imported) PAT μοτίβο για third-party DXF εκτός catalog (ADR-507 Φ6).
   *  Όταν το `patternName` δεν υπάρχει στο catalog, ο DXF reader χτίζει ad-hoc
   *  μοτίβο από τις inline group codes → ο geometry resolver το καταναλώνει 1:1. */
  inlinePattern?: HatchPattern;
  /** Draw-order bucket (0=back … 4=front) — §5δ auto-send-to-back. */
  drawOrder?: 0 | 1 | 2 | 3 | 4;
  /** Ανοχή κενού ορίου για boundary detection (mm, Φ3). */
  gapTolerance?: number;
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
  // ADR-436 — structural foundation (pad/strip/tie-beam, IfcFooting).
  | FoundationEntity
  // ADR-406 — point-based MEP fixture (light fixture first).
  | MepFixtureEntity
  // ADR-408 Φ3 — point-based electrical panel (circuit source).
  | ElectricalPanelEntity
  // ADR-408 Φ12 — point-based plumbing manifold (pipe-network source).
  | MepManifoldEntity
  // ADR-408 Εύρος Β — point-based hydronic radiator (heating terminal).
  | MepRadiatorEntity
  // ADR-408 Εύρος Β #2 — point-based hydronic boiler (heating source).
  | MepBoilerEntity
  // ADR-408 DHW — point-based domestic hot water heater (DHW source).
  | MepWaterHeaterEntity
  // ADR-408 Εύρος Β #3 — area-based radiant floor heating loop.
  | MepUnderfloorEntity
  // ADR-407 — standalone path-based railing.
  | RailingEntity
  // ADR-410 — mesh-based CC0 furniture.
  | FurnitureEntity
  // ADR-408 Φ8 — unified linear MEP segment (duct + pipe).
  | MepSegmentEntity
  // ADR-408 Φ11 — auto pipe fitting (point-based junction element).
  | MepFittingEntity
  // ADR-415 — pure-vector 2D floorplan symbol (category-driven; WC/sanitary first).
  | FloorplanSymbolEntity
  // ADR-417 — parametric pitched roof (footprint + per-edge slopes).
  | RoofEntity
  // ADR-419 — thin polygon floor covering per room (IfcCovering FLOORING).
  | FloorFinishEntity
  | WallCoveringEntity
  // ADR-422 — analytical thermal space (IfcSpace).
  | ThermalSpaceEntity
  // ADR-437 — space separator (IfcVirtualElement).
  | SpaceSeparatorEntity
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

/** ADR-436 — structural foundation (pad/strip/tie-beam, IfcFooting). */
export const isFoundationEntity = (entity: Entity): entity is FoundationEntity =>
  entity.type === 'foundation';

/** ADR-406 — point-based MEP fixture (light fixture first). */
export const isMepFixtureEntity = (entity: Entity): entity is MepFixtureEntity =>
  entity.type === 'mep-fixture';

/** ADR-408 Φ3 — point-based electrical panel (circuit source). */
export const isElectricalPanelEntity = (entity: Entity): entity is ElectricalPanelEntity =>
  entity.type === 'electrical-panel';

/** ADR-408 Φ12 — point-based plumbing manifold (pipe-network source). */
export const isMepManifoldEntity = (entity: Entity): entity is MepManifoldEntity =>
  entity.type === 'mep-manifold';

/** ADR-408 Εύρος Β — point-based hydronic radiator (heating terminal). */
export const isMepRadiatorEntity = (entity: Entity): entity is MepRadiatorEntity =>
  entity.type === 'mep-radiator';

/** ADR-408 Εύρος Β #2 — point-based hydronic boiler (heating source). */
export const isMepBoilerEntity = (entity: Entity): entity is MepBoilerEntity =>
  entity.type === 'mep-boiler';

/** ADR-408 DHW — point-based domestic hot water heater (DHW source). */
export const isMepWaterHeaterEntity = (entity: Entity): entity is MepWaterHeaterEntity =>
  entity.type === 'mep-water-heater';

/** ADR-408 Εύρος Β #3 — area-based radiant floor heating loop. */
export const isMepUnderfloorEntity = (entity: Entity): entity is MepUnderfloorEntity =>
  entity.type === 'mep-underfloor';

/** ADR-407 — standalone path-based railing. */
export const isRailingEntity = (entity: Entity): entity is RailingEntity =>
  entity.type === 'railing';

/** ADR-410 — mesh-based CC0 furniture (chair first). */
export const isFurnitureEntity = (entity: Entity): entity is FurnitureEntity =>
  entity.type === 'furniture';

/** ADR-408 Φ8 — unified linear MEP segment (duct + pipe). */
export const isMepSegmentEntity = (entity: Entity): entity is MepSegmentEntity =>
  entity.type === 'mep-segment';

/** ADR-408 Φ11 — auto pipe fitting (point-based junction element). */
export const isMepFittingEntity = (entity: Entity): entity is MepFittingEntity =>
  entity.type === 'mep-fitting';

/** ADR-415 — pure-vector 2D floorplan symbol (category-driven; WC first). */
export const isFloorplanSymbolEntity = (entity: Entity): entity is FloorplanSymbolEntity =>
  entity.type === 'floorplan-symbol';

/** ADR-417 — parametric pitched roof (footprint + per-edge slopes). */
export const isRoofEntity = (entity: Entity): entity is RoofEntity =>
  entity.type === 'roof';

/** ADR-419 — thin polygon floor covering per room (IfcCovering FLOORING). */
export const isFloorFinishEntity = (entity: Entity): entity is FloorFinishEntity =>
  entity.type === 'floor-finish';

/** ADR-511 — wall finish per room/face (IfcCovering CLADDING/INTERIOR). */
export const isWallCoveringEntity = (entity: Entity): entity is WallCoveringEntity =>
  entity.type === 'wall-covering';

/** ADR-422 — analytical thermal space (IfcSpace). */
export const isThermalSpaceEntity = (entity: Entity): entity is ThermalSpaceEntity =>
  entity.type === 'thermal-space';

/** ADR-437 — space separator (IfcVirtualElement). */
export const isSpaceSeparatorEntity = (entity: Entity): entity is SpaceSeparatorEntity =>
  entity.type === 'space-separator';

/** True for any ADR-363/406/407/408/410/415/417/419/422/437 BIM parametric entity */
export const isBimEntity = (entity: Entity): entity is WallEntity | OpeningEntity | SlabEntity | SlabOpeningEntity | ColumnEntity | BeamEntity | FoundationEntity | MepFixtureEntity | ElectricalPanelEntity | MepManifoldEntity | MepRadiatorEntity | MepBoilerEntity | MepWaterHeaterEntity | MepUnderfloorEntity | RailingEntity | FurnitureEntity | MepSegmentEntity | MepFittingEntity | FloorplanSymbolEntity | RoofEntity | FloorFinishEntity | WallCoveringEntity | ThermalSpaceEntity | SpaceSeparatorEntity =>
  entity.type === 'wall' || entity.type === 'opening' || entity.type === 'slab' ||
  entity.type === 'slab-opening' || entity.type === 'column' || entity.type === 'beam' ||
  entity.type === 'foundation' ||
  entity.type === 'mep-fixture' || entity.type === 'electrical-panel' || entity.type === 'mep-manifold' || entity.type === 'mep-radiator' || entity.type === 'mep-boiler' || entity.type === 'mep-water-heater' || entity.type === 'mep-underfloor' || entity.type === 'railing' ||
  entity.type === 'furniture' || entity.type === 'mep-segment' || entity.type === 'mep-fitting' ||
  entity.type === 'floorplan-symbol' || entity.type === 'roof' || entity.type === 'floor-finish' || entity.type === 'wall-covering' || entity.type === 'thermal-space' || entity.type === 'space-separator';

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