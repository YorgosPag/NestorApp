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
import { mmToSceneUnits } from '../../utils/scene-units';
import type { IfcEntityMixin } from './ifc-entity-mixin';
import type { MepConnectorHostParams } from './mep-component-types';
import type { PlumbingSystemClassification } from './mep-connector-types';
import type { BimCategory } from '../../config/bim-object-styles';

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
   * Plumbing/piping classification of a `'pipe'` segment (ADR-408 Φ14) — what the
   * run conveys (cold/hot water, sanitary drainage, hydronic). DERIVED CACHE / hint
   * only: it colours + IFC-classifies a STANDALONE pipe (one not yet in a network).
   * Once the segment joins a `MepSystem`, **the System owns the classification**
   * (system colour wins) — exactly as `MepConnector.systemId` is a derived cache.
   * Absent / `'duct'` ⇒ no plumbing classification.
   */
  readonly classification?: PlumbingSystemClassification;
  /**
   * % slope of the run (ADR-408 Φ14), the drainage convention (e.g. 1–2%) — an
   * INSTANCE property of the segment (each gravity run has its own fall). Absent
   * ⇒ level run. Mirrors {@link MepPipeConnectorParams.slopePercent}.
   */
  readonly slopePercent?: number;
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
 * Default gravity fall (%) for a freshly drawn sanitary-drainage run (ADR-408 Φ14).
 * 1.5% is the common building-drainage minimum (between the 1–2% CIBSE range).
 */
export const DEFAULT_DRAINAGE_SLOPE_PERCENT = 1.5;

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

// ─── Per-endpoint elevation SSoT (ADR-408 Φ-A, true 3D segment) ───────────────────

/** Resolved per-endpoint centreline elevations (mm) of a segment's two ends. */
export interface SegmentEndpointElevationsMm {
  /** mm — elevation of the `startPoint` end. */
  readonly startMm: number;
  /** mm — elevation of the `endPoint` end. */
  readonly endMm: number;
}

/**
 * SSoT resolver for a segment's two endpoint elevations (mm). The authoritative
 * source is `startPoint.z` / `endPoint.z` (true 3D points) — a segment may slope
 * (riser / inclined run), so each end carries its own elevation. `centerlineElevationMm`
 * is the DERIVED back-compat midpoint, NOT the truth.
 *
 * Back-compat / migration is self-healing (no destructive Firestore migration):
 *   - **Both** ends at z=0/undefined ⇒ a legacy or freshly-created HORIZONTAL run —
 *     `centerlineElevationMm` is the single elevation, applied to both ends.
 *   - Otherwise (at least one end has a non-zero z) ⇒ the doc is in the per-endpoint
 *     format — read each `z`, falling back to `centerlineElevationMm` only where an
 *     individual `z` is absent.
 *
 * This is unambiguous because `centerlineElevationMm` is itself derived: a NEW doc
 * with both ends at z=0 always has `centerlineElevationMm === 0`, so the "both-zero"
 * branch is a no-op for it; it only ever lifts genuine LEGACY docs (independent
 * centreline) and never corrupts a riser whose start sits at floor (z=0, end≠0).
 *
 * Pure & idempotent — applying it to its own output is stable.
 */
export function resolveSegmentEndpointElevationsMm(
  params: MepSegmentParams,
): SegmentEndpointElevationsMm {
  const c = params.centerlineElevationMm;
  const sz = params.startPoint.z;
  const ez = params.endPoint.z;
  const startUnset = sz === undefined || sz === 0;
  const endUnset = ez === undefined || ez === 0;
  if (startUnset && endUnset) {
    return { startMm: c, endMm: c };
  }
  return { startMm: sz ?? c, endMm: ez ?? c };
}

/**
 * Derive the centreline ("Middle Elevation") from two endpoint elevations (mm) —
 * the midpoint. Used by builders/bridge to keep `centerlineElevationMm` in sync
 * as a derived cache whenever the endpoint z's change.
 */
export function deriveCenterlineElevationMm(startMm: number, endMm: number): number {
  return (startMm + endMm) / 2;
}

/**
 * Is the run inclined (start elevation ≠ end elevation, beyond 1mm)? Pure helper
 * for renderers / fitting risers (ADR-408 Φ-C). Reads the per-endpoint SSoT.
 */
export function isSegmentInclined(params: MepSegmentParams): boolean {
  const { startMm, endMm } = resolveSegmentEndpointElevationsMm(params);
  return Math.abs(startMm - endMm) > 1;
}

// ─── Vertical riser detection (ADR-408 Φ15 — γεωμετρία οδηγεί το 2D σύμβολο) ─────

/**
 * Max plan (XY) run, in mm, for a segment to read as a VERTICAL riser (στήλη
 * αποχέτευσης). A true soil stack has (near-)zero plan run; above this it is a
 * sloped/horizontal pipe. Generous enough to absorb snapping jitter, tight enough
 * to exclude a real sloped branch.
 */
export const RISER_MAX_PLAN_MM = 50;

/**
 * Min rise (|Δz|), in mm, for a (near-)vertical segment to count as a riser — below
 * this a coincident-XY pair is a degenerate stub, not a stack.
 */
export const RISER_MIN_RISE_MM = 100;

/**
 * Is this segment a VERTICAL riser (κατακόρυφη στήλη)? Pure + geometry-driven
 * (Revit-true: a vertical pipe is still a Pipe — the plan SYMBOL derives from it
 * being ~perpendicular to the plan view, NOT a stored kind/type). True ⟺ a
 * (near-)zero plan run AND a real rise. Consumed by the 2D renderer + the
 * cross-floor «riser through» overlay.
 */
export function isSegmentVertical(params: MepSegmentParams): boolean {
  if (derivePlanLengthMm(params) >= RISER_MAX_PLAN_MM) return false;
  const { startMm, endMm } = resolveSegmentEndpointElevationsMm(params);
  return Math.abs(endMm - startMm) > RISER_MIN_RISE_MM;
}

/**
 * Symbol direction of a riser — `'up'` when the end is higher than the start, else
 * `'down'`. Drives the plan symbol's up/down arrow (Revit «pipe up / pipe down»).
 */
export function riserDirection(params: MepSegmentParams): 'up' | 'down' {
  const { startMm, endMm } = resolveSegmentEndpointElevationsMm(params);
  return endMm >= startMm ? 'up' : 'down';
}

// ─── Slope (κλίση) — derived+invertible projection of per-endpoint z (Φ14 #2) ──

/**
 * Minimum plan run (mm) below which slope is undefined — a (near-)vertical riser
 * or zero-length run has no meaningful % grade, so slope helpers no-op / return 0
 * rather than divide by ~0.
 */
export const MIN_PLAN_LENGTH_FOR_SLOPE_MM = 1e-6;

/**
 * Plan (horizontal, XY) run length in **mm** — the denominator of the slope. The
 * axis points are in canvas units, so convert via `mmToSceneUnits` (the same `s`
 * the geometry SSoT uses). Vertical drop (z) is intentionally excluded: slope % is
 * rise-over-PLAN-run (Revit "Slope"), not rise-over-3D-length.
 */
export function derivePlanLengthMm(params: MepSegmentParams): number {
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const dx = params.endPoint.x - params.startPoint.x;
  const dy = params.endPoint.y - params.startPoint.y;
  return (Math.hypot(dx, dy) / s);
}

/**
 * Derive the slope % from the two endpoint elevations + plan run (ADR-408 Φ14 #2).
 * Sign convention: **positive = downhill toward `endPoint`** (drainage falls from
 * start to end). A (near-)vertical / zero plan run → 0 (no meaningful grade).
 */
export function deriveSlopePercent(startMm: number, endMm: number, planLengthMm: number): number {
  if (planLengthMm <= MIN_PLAN_LENGTH_FOR_SLOPE_MM) return 0;
  return ((startMm - endMm) / planLengthMm) * 100;
}

/**
 * Apply a slope % to a segment by moving the **end** endpoint z, anchoring the
 * START (ADR-408 Φ14 #2 — the inverse of `deriveSlopePercent`). Keeps the
 * per-endpoint z as the single SSoT: `endMm = startMm − planLen·slope/100`, with
 * `centerlineElevationMm` re-derived. A (near-)vertical / zero plan run is a no-op
 * (cannot project a grade onto a riser) so it never corrupts the z's.
 */
export function applySlopePercentToEndpoints(
  params: MepSegmentParams,
  slopePercent: number,
): MepSegmentParams {
  const planLen = derivePlanLengthMm(params);
  if (planLen <= MIN_PLAN_LENGTH_FOR_SLOPE_MM) return params;
  const { startMm } = resolveSegmentEndpointElevationsMm(params);
  const endMm = startMm - (planLen * slopePercent) / 100;
  return {
    ...params,
    startPoint: { ...params.startPoint, z: startMm },
    endPoint: { ...params.endPoint, z: endMm },
    centerlineElevationMm: deriveCenterlineElevationMm(startMm, endMm),
  };
}

// ─── V/G category (ADR-408 Φ14) ──────────────────────────────────────────────

/**
 * SSoT for a segment's `BimCategory` — the Visibility/Graphics bucket. A sanitary
 * drainage pipe gets its OWN category `'drain-pipe'` (so it toggles independently
 * of water pipes) while staying `domain:'pipe'` everywhere else (IFC/schema/section
 * unchanged — drainage IS a pipe). Every other run maps 1:1 to its `domain`.
 * Consumed by BOTH the 2D renderer and the 3D scene sync.
 */
export function resolveSegmentBimCategory(params: MepSegmentParams): BimCategory {
  if (params.domain === 'pipe' && params.classification === 'sanitary-drainage') {
    return 'drain-pipe';
  }
  return params.domain;
}
