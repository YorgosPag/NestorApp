/**
 * BIM MEP Segment — Type Schema (ADR-408 Φ8, duct/pipe element pipeline).
 *
 * A **MEP Segment** is a linear distribution run with a cross-section, swept
 * along a 2-click axis (Revit "Duct" / "Pipe"; IFC `IfcDuctSegment` /
 * `IfcPipeSegment`). It is the FIRST mechanical/plumbing BIM element and the
 * counterpart of the point-based electrical fixture/panel (ADR-406/408 Φ3).
 *
 * ONE unified entity covers BOTH domains via two orthogonal discriminators —
 * mirroring how `BeamEntity` unified rectangular + I-shape under one
 * `sectionKind` (data, not a second entity type):
 *   - `domain`      → `'duct'` (mechanical) | `'pipe'` (plumbing). Drives the
 *                     BimCategory + discipline (ADR-405) + IFC class + BOQ code.
 *   - `sectionKind` → `'rectangular'` (duct only) | `'round'` (round duct / pipe).
 *                     Drives the swept cross-section profile (rect extrude vs
 *                     circle sweep), exactly like beam `'rectangular' | 'I-shape'`.
 *
 * SSoT:
 *   - `startPoint` + `endPoint` define the axis (world coords, canvas units).
 *   - `width`/`height` (rectangular) OR `diameter` (round) define the section.
 *   - `centerlineElevationMm` = elevation of the cross-section CENTRE from project
 *     origin (Revit duct/pipe "Middle Elevation") — differs from beam (top face).
 *   - `MepSegmentGeometry` is a cache from `computeMepSegmentGeometry()` —
 *     re-derivable from params, NEVER mutated by consumers.
 *
 * Connectivity: `MepSegmentParams` composes {@link MepConnectorHostParams} as a
 * forward hook — duct/pipe SYSTEMS (grouping segments into networks, mirroring
 * the electrical Φ2 system + Φ7 routing) are a future phase; this slice ships the
 * element only and leaves `connectors` empty.
 *
 * @see ./mep-connector-types.ts
 * @see ./beam-types.ts (the linear-element template)
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 */

import type {
  BimEntity,
  BoundingBox3D,
  Point3D,
  Polygon3D,
  Polyline3D,
} from './bim-base';
import type { SceneUnits } from '../../utils/scene-units';
import type { IfcEntityMixin } from './ifc-entity-mixin';
import type { MepConnectorHostParams } from './mep-component-types';

// ─── Discriminators ────────────────────────────────────────────────────────────

/**
 * MEP distribution domain. `'duct'` = mechanical/HVAC air distribution;
 * `'pipe'` = plumbing/hydronic fluid distribution. Drives discipline, BimCategory,
 * IFC class and BOQ code. Doubles as the entity `kind` discriminator.
 */
export type MepSegmentDomain = 'duct' | 'pipe';

/** Alias: the segment's `kind` IS its domain. */
export type MepSegmentKind = MepSegmentDomain;

/**
 * Cross-section profile shape, orthogonal to `domain` (mirror of `BeamSectionKind`):
 *   - `'rectangular'` → width × height box section (rectangular duct).
 *   - `'round'`       → circular section (round duct / any pipe).
 * A pipe is always `'round'`; a duct may be either.
 */
export type MepSegmentSectionKind = 'rectangular' | 'round';

// ─── Parameters (user-editable, SSoT for geometry derivation) ────────────────────

/**
 * MEP segment parameters. All linear measurements in mm (Nestor convention),
 * except where a metre BOQ rollup is documented.
 */
export interface MepSegmentParams extends MepConnectorHostParams {
  readonly domain: MepSegmentDomain;
  readonly sectionKind: MepSegmentSectionKind;
  /** Axis start, world coords (canvas units). */
  readonly startPoint: Point3D;
  /** Axis end, world coords (canvas units). */
  readonly endPoint: Point3D;
  /** mm. Cross-section X — rectangular only (duct width). Ignored when round. */
  readonly width?: number;
  /** mm. Cross-section Y — rectangular only (duct height). Ignored when round. */
  readonly height?: number;
  /** mm. Outer diameter — round only (round duct / pipe). Ignored when rectangular. */
  readonly diameter?: number;
  /**
   * mm. Pipe wall thickness (round/pipe only, optional). When present, BOQ can
   * derive material volume (annulus); absent ⇒ solid-section approximation.
   */
  readonly wallThickness?: number;
  /**
   * mm. Elevation of the cross-section CENTRE (centreline) from project origin
   * (Revit duct/pipe "Middle Elevation"). The swept solid is centred vertically
   * on this value — UNLIKE beam (top face) / fixture (ceiling) / panel (mid box).
   */
  readonly centerlineElevationMm: number;
  /** Optional material library ID (insulation/sheet/pipe material — future BOQ). */
  readonly material?: string;
  /**
   * DXF canvas coordinate unit. Stored so `computeMepSegmentGeometry` can convert
   * mm scalars (width/height/diameter) → canvas units for the 2D plan outline.
   * Defaults to 'mm' when absent (legacy Firestore docs).
   */
  readonly sceneUnits?: SceneUnits;
  /** FK → Floor.id (storey reference), parallel to beam/wall. */
  readonly storeyId?: string;
}

// ─── Geometry cache (derivable from params; SSoT = params) ───────────────────────

/**
 * Computed segment geometry. Returned by `computeMepSegmentGeometry(params)` —
 * NEVER mutated by consumers.
 *
 *   - `axisPolyline` — centreline (start → end).
 *   - `outline` — plan-view footprint rectangle (section-width × length, CCW).
 *   - `length` — m. Axis length.
 *   - `crossSectionAreaM2` — m². Section area (rect = w·h, round = π·r²).
 *   - `surfaceAreaM2` — m². Outer surface = section perimeter × length (duct
 *     sheet metal / pipe insulation BOQ).
 *   - `volume` — m³. crossSectionArea × length (bounding solid).
 *   - `bbox` — folds outline + axis, z range centred on centerlineElevation.
 */
export interface MepSegmentGeometry {
  readonly axisPolyline: Polyline3D;
  readonly outline: Polygon3D;
  readonly bbox: BoundingBox3D;
  /** m — axis length. */
  readonly length: number;
  /** m² — cross-section area. */
  readonly crossSectionAreaM2: number;
  /** m² — outer surface area (perimeter × length). */
  readonly surfaceAreaM2: number;
  /** m³ — section area × length. */
  readonly volume: number;
}

// ─── Entity (BIM generic instantiation) ──────────────────────────────────────────

/** IFC4 class for a MEP segment, derived from domain. */
export type MepSegmentIfcType = 'IfcDuctSegment' | 'IfcPipeSegment';

/**
 * MEP segment BIM entity. Extends `BimEntity` with `kind: MepSegmentDomain`
 * discriminator + IFC mixin. `type` is the unified `'mep-segment'`.
 */
export interface MepSegmentEntity
  extends BimEntity<MepSegmentKind, MepSegmentParams, MepSegmentGeometry>,
    IfcEntityMixin {
  readonly type: 'mep-segment';
  /** IFC4 class — `IfcDuctSegment` (duct) | `IfcPipeSegment` (pipe). */
  readonly ifcType: MepSegmentIfcType;
}

// ─── Defaults & constants ────────────────────────────────────────────────────────

/** Default rectangular duct width (mm) — 40cm typical supply trunk. */
export const DEFAULT_DUCT_WIDTH_MM = 400;
/** Default rectangular duct height (mm) — 20cm typical. */
export const DEFAULT_DUCT_HEIGHT_MM = 200;
/** Default round duct diameter (mm). */
export const DEFAULT_ROUND_DUCT_DIAMETER_MM = 250;
/** Default pipe outer diameter (mm) — DN50. */
export const DEFAULT_PIPE_DIAMETER_MM = 50;
/** Default pipe wall thickness (mm). */
export const DEFAULT_PIPE_WALL_THICKNESS_MM = 3;

/** Minimum cross-section dimension (mm) — degenerate guard. */
export const MIN_SEGMENT_DIMENSION_MM = 10;
/** Minimum segment length (mm) — degenerate guard. */
export const MIN_SEGMENT_LENGTH_MM = 50;

/** Default centreline elevation (mm) — above a 3m ceiling, in the plenum. */
export const DEFAULT_SEGMENT_CENTERLINE_ELEVATION_MM = 2800;

/**
 * Resolve the IFC class for a domain. Pure SSoT used by the factory + converters.
 */
export function mepSegmentIfcType(domain: MepSegmentDomain): MepSegmentIfcType {
  return domain === 'duct' ? 'IfcDuctSegment' : 'IfcPipeSegment';
}

/**
 * Effective outer cross-section dimensions (mm), resolving defaults per
 * domain/sectionKind. `widthMm`/`heightMm` describe the bounding box of the
 * section (round ⇒ both = diameter). Pure SSoT consumed by geometry + 3D.
 */
export function resolveSegmentSection(params: MepSegmentParams): {
  readonly widthMm: number;
  readonly heightMm: number;
  readonly diameterMm: number | null;
} {
  if (params.sectionKind === 'round') {
    const d =
      params.diameter ??
      (params.domain === 'pipe' ? DEFAULT_PIPE_DIAMETER_MM : DEFAULT_ROUND_DUCT_DIAMETER_MM);
    return { widthMm: d, heightMm: d, diameterMm: d };
  }
  return {
    widthMm: params.width ?? DEFAULT_DUCT_WIDTH_MM,
    heightMm: params.height ?? DEFAULT_DUCT_HEIGHT_MM,
    diameterMm: null,
  };
}

/** Narrowing guard: is this a pipe (always round)? */
export function isPipeSegment(params: MepSegmentParams): boolean {
  return params.domain === 'pipe';
}
