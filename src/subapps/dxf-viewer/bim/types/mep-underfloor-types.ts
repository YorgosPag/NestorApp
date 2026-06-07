/**
 * BIM Underfloor (radiant floor) Heating Loop — Type Schema
 * (ADR-408 Σύστημα Θέρμανσης Εύρος Β #3, area/path-based hydronic terminal).
 *
 * The underfloor loop (Revit "Radiant Floor / hydronic loop", IFC `IfcSpaceHeater`
 * radiant) is an AREA-based heating TERMINAL — the opposite paradigm from the
 * point-based radiator/boiler. It owns its OWN footprint polygon (one polygon per
 * room, the FloorFinish ADR-419 pattern) and a parametric serpentine pipe path is
 * COMPUTED inside that polygon (spacing + edge clearance + pattern). The computed
 * pipe length feeds the BOQ.
 *
 * Like the radiator it is a hydronic TERMINAL with EXACTLY TWO connectors at the loop
 * ENTRY: a supply inlet (`flow:'in'`, hydronic-supply) and a return outlet
 * (`flow:'out'`, hydronic-return). It becomes a member of a hydronic-supply network
 * AND a hydronic-return network simultaneously (per-(entity,connector) membership) —
 * fed from a manifold/boiler. It is NOT a network source and grows NO auto-fittings
 * (the loop is one continuous element).
 *
 * SSoT:
 *   - `MepUnderfloorParams.footprint` (CCW polygon, world mm) is the area SSoT.
 *   - The serpentine `loopPath`, `totalLengthM` and the two connector positions are
 *     DERIVED by `computeMepUnderfloorGeometry(params)` — never hand-authored.
 *   - `MepUnderfloorGeometry` cache is re-derivable from params (corruption-safe).
 *
 * Unlike the point-based hosts the underfloor entity has NO `position`/`rotation`;
 * the two connectors store their `localPosition` already in WORLD coords and resolve
 * through an IDENTITY host transform (same opt-out as `mep-segment`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type {
  BimEntity,
  BoundingBox3D,
  Point3D,
  Polygon3D,
} from './bim-base';
import type { SceneUnits } from '../../utils/scene-units';
import type { IfcEntityMixin } from './ifc-entity-mixin';
import type { MepConnectorHostParams } from './mep-component-types';

// ─── Sub-type discriminator (ADR-408 Εύρος Β #3) ──────────────────────────────

/**
 * Underfloor loop kind discriminator.
 *   - `'hydronic-loop'` — water-based radiant floor loop (the opening Εύρος Β #3
 *     slice): a serpentine pipe field embedded in the screed, fed supply/return.
 * Future families (electric mat) append here without a new EntityType. Maps 1:1 to
 * the `'mep-underfloor'` BimCategory.
 */
export type MepUnderfloorKind = 'hydronic-loop';

/**
 * Serpentine layout pattern of the pipe field.
 *   - `'boustrophedon'` — back-and-forth parallel rows (ox-plough) + a perimeter
 *     return leg back to entry. Simplest, single-direction flow.
 *   - `'counterflow-spiral'` — bifilar interleave: supply and return run parallel
 *     everywhere (even floor temperature, Revit-realistic).
 */
export type MepUnderfloorPattern = 'boustrophedon' | 'counterflow-spiral';

// ─── Parameters (user-editable SSoT) ──────────────────────────────────────────

export interface MepUnderfloorParams extends MepConnectorHostParams {
  readonly kind: MepUnderfloorKind;
  /** Closed polygon (CCW), world coords mm. The heating area. Min 3 vertices. */
  readonly footprint: Polygon3D;
  /** mm. Centre-to-centre pipe spacing of the serpentine rows (typical 100–200mm). */
  readonly pipeSpacingMm: number;
  /** mm. Inset from the room walls before the field starts (typical 100mm). */
  readonly edgeClearanceMm: number;
  /** Serpentine layout pattern. Defaults to `'boustrophedon'`. */
  readonly patternType: MepUnderfloorPattern;
  /**
   * Footprint edge index where the supply/return enter (the manifold side). The two
   * connectors are placed at this edge's midpoint projection. Defaults to 0.
   */
  readonly entrySide?: number;
  /**
   * mm. Elevation of the pipe centreline above the storey FFL (pipe embedded in the
   * screed). Default ~50mm. Resolved by the connector-elevation SSoT.
   */
  readonly screedOffsetMm: number;
  /** mm — nominal supply/return connector diameter (typical 16–20mm PEX). */
  readonly connectorDiameterMm: number;
  /**
   * W — optional catalogue thermal output (nominal heat output of the loop). Drives
   * future sizing/load-balancing; absent ⇒ not yet specified.
   */
  readonly thermalOutputW?: number;
  /**
   * DXF canvas coordinate unit. Stored so `computeMepUnderfloorGeometry` can convert
   * mm scalars → canvas units for the serpentine field. Defaults to `'mm'`.
   */
  readonly sceneUnits?: SceneUnits;
  /** FK → Floor.id (storey reference). */
  readonly floorId?: string;
  /** User label (π.χ. «Σαλόνι - Ενδοδαπέδια»). */
  readonly name?: string;
}

// ─── Geometry cache (derivable from params; SSoT = params) ────────────────────

/**
 * Computed underfloor geometry. Returned by `computeMepUnderfloorGeometry(params)` —
 * NEVER mutated by consumers. `areaM2` in m², `totalLengthM` in m (BOQ pipe length).
 */
export interface MepUnderfloorGeometry {
  /** Axis-aligned bbox of the footprint (XY plane). */
  readonly bbox: BoundingBox3D;
  /** m². Footprint area (Shoelace). */
  readonly areaM2: number;
  /** m. Total developed pipe length of the serpentine loop (BOQ-ready). */
  readonly totalLengthM: number;
  /** The continuous serpentine polyline (supply leg + return leg), world coords. */
  readonly loopPath: readonly Point3D[];
  /** Supply inlet world position (= loop entry). */
  readonly supplyConnectorLocal: Point3D;
  /** Return outlet world position (adjacent to supply at entry). */
  readonly returnConnectorLocal: Point3D;
}

// ─── Entity (BIM generic instantiation) ───────────────────────────────────────

/**
 * Underfloor heating loop BIM entity. Extends `BimEntity` with a
 * `MepUnderfloorKind` discriminator. `type` is the generic `'mep-underfloor'`
 * (render-dispatch key); the V/G category is the same `'mep-underfloor'`
 * (→ plumbing via DISCIPLINE_BY_CATEGORY).
 */
export interface MepUnderfloorEntity
  extends BimEntity<MepUnderfloorKind, MepUnderfloorParams, MepUnderfloorGeometry>,
    IfcEntityMixin {
  readonly type: 'mep-underfloor';
  /** IFC4 class — space heating terminal (radiant floor). */
  readonly ifcType: 'IfcSpaceHeater';
}

// ─── Defaults & constants ──────────────────────────────────────────────────────

/** Default pipe spacing (mm) — typical residential radiant floor. */
export const DEFAULT_UNDERFLOOR_SPACING_MM = 150;

/** Default edge clearance (mm) — inset from the walls before the field. */
export const DEFAULT_UNDERFLOOR_EDGE_CLEARANCE_MM = 100;

/** Default serpentine layout pattern. */
export const DEFAULT_UNDERFLOOR_PATTERN: MepUnderfloorPattern = 'boustrophedon';

/** Default screed offset (mm) — pipe centreline above FFL. */
export const DEFAULT_UNDERFLOOR_SCREED_OFFSET_MM = 50;

/** Default supply/return connector diameter (mm) — typical 16mm PEX. */
export const DEFAULT_UNDERFLOOR_CONNECTOR_DIAMETER_MM = 16;

/** Min polygon vertices for a valid underfloor footprint. */
export const MIN_UNDERFLOOR_VERTICES = 3;

/** Min pipe spacing (mm) — below this is a placement/param error. */
export const MIN_UNDERFLOOR_SPACING_MM = 50;
