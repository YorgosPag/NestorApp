/**
 * BIM Heating Radiator (Καλοριφέρ / Θερμαντικό Σώμα) — Type Schema
 * (ADR-408 Σύστημα Θέρμανσης Εύρος Β #1, the hydronic TERMINAL element).
 *
 * The radiator (Revit "Mechanical Equipment" space heater, IFC `IfcSpaceHeater`)
 * is the hydronic-network analogue of the electrical light fixture (ADR-406): a
 * point-based BIM element that CONSUMES a pipe network rather than sourcing it. It
 * mirrors the plumbing manifold (ADR-408 Φ12) 1:1 in geometry/placement, with two
 * deliberate differences:
 *
 *   1. It is a TERMINAL, not a source. It carries EXACTLY TWO pipe connectors with
 *      FIXED classification: a supply inlet (`flow: 'in'`, `hydronic-supply`) at the
 *      −X bottom end and a return outlet (`flow: 'out'`, `hydronic-return`) at the
 *      +X bottom end. It therefore becomes a MEMBER of two pipe networks at once
 *      (one supply, one return) — membership is per-(entity, connector), so this
 *      needs no special handling beyond seeding the two connectors.
 *   2. It does NOT own a `systemClassification` (unlike the manifold): a radiator's
 *      hydraulic role is fixed by physics (supply in, return out), not user-chosen.
 *
 * Pattern mirrors `mep-manifold-types.ts`: kind + params + geometry cache +
 * validation. All scalar geometry stored in mm (column/wall §5.0 convention).
 *
 * SSoT:
 *   - `MepRadiatorParams.position` + `rotation` + `width`/`length` define the 2D
 *     footprint polygon (computed by `computeMepRadiatorGeometry`).
 *   - The two connectors are derived (seeded) from `width`/`connectorDiameterMm` by
 *     `buildRadiatorConnectors`, not hand-authored.
 *   - `MepRadiatorGeometry` cache is re-derivable from params (corruption-safe).
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

// ─── Sub-type discriminator (ADR-408 Εύρος Β) ─────────────────────────────────

/**
 * Radiator kind discriminator.
 *   - `'panel-radiator'` — θερμαντικό σώμα panel (the opening Εύρος Β slice): a flat
 *     rectangular wall-mounted heating body with one supply + one return connector.
 * Future heating terminal families (column radiator, towel rail, fan-coil) append
 * here without a new EntityType. Maps 1:1 to the `'mep-radiator'` BimCategory.
 */
export type MepRadiatorKind = 'panel-radiator';

/**
 * Footprint shape of the radiator body. A radiator is a rectangular panel; the
 * single-value union keeps the geometry pipeline symmetric with the manifold and
 * leaves room for a future column/profiled variant.
 */
export type MepRadiatorShape = 'rectangular';

// ─── Parameters (user-editable SSoT) ──────────────────────────────────────────

export interface MepRadiatorParams extends MepConnectorHostParams {
  readonly kind: MepRadiatorKind;
  readonly shape: MepRadiatorShape;
  /** Insertion point (plan). `z` is derived from `mountingElevationMm`. */
  readonly position: Point3D;
  /** Degrees CCW about `position` (plan). */
  readonly rotation: number;
  /** mm. Footprint width — the body length along the wall (local X), along which the two connectors sit. */
  readonly width: number;
  /** mm. Footprint length (radiator depth, local Y). */
  readonly length: number;
  /** mm. Vertical height of the radiator panel (3D vertical extent). */
  readonly bodyHeightMm: number;
  /**
   * mm. Mounting elevation above the storey FFL — the **vertical centre** of the
   * radiator box (wall-mounted). The 3D box spans `mountingElevationMm ± bodyHeightMm/2`.
   */
  readonly mountingElevationMm: number;
  /** mm — nominal supply/return connector diameter (typical 15mm hydronic tail). */
  readonly connectorDiameterMm: number;
  /**
   * W — optional catalogue thermal output (nominal heat emission at ΔT 50K). Drives
   * future sizing/load-balancing; absent ⇒ not yet specified.
   */
  readonly thermalOutputW?: number;
  /**
   * DXF canvas coordinate unit. Stored so `computeMepRadiatorGeometry` can convert
   * mm scalars → canvas units for the 2D footprint. Defaults to `'mm'`.
   */
  readonly sceneUnits?: SceneUnits;
  /** FK → Floor.id (storey reference). Semantic alias for entity-level floorId. */
  readonly storeyId?: string;
  /** Optional radiator catalog id (future). */
  readonly material?: string;
  /**
   * ADR-408 deferred hook — host element FK (wall) for future hosted placement
   * (Revit "Host"). Unused in the free-point slice; reserved so the hosted cascade
   * sub-step is non-breaking.
   */
  readonly hostId?: string;
}

// ─── Geometry cache (derivable from params; SSoT = params) ────────────────────

/**
 * Computed radiator geometry. Returned by `computeMepRadiatorGeometry(params)` —
 * NEVER mutated by consumers. `area` in m², `height` (= box height) in mm.
 */
export interface MepRadiatorGeometry {
  /** Polygon3D — horizontal footprint at the mounting plane. Closed CCW. */
  readonly footprint: Polygon3D;
  readonly bbox: BoundingBox3D;
  /** m². Footprint area. */
  readonly area: number;
  /** mm. Mirror of `params.bodyHeightMm` for downstream convenience. */
  readonly height: number;
}

// ─── Entity (BIM generic instantiation) ───────────────────────────────────────

/**
 * Heating radiator BIM entity. Extends `BimEntity` with a `MepRadiatorKind`
 * discriminator. `type` is the generic `'mep-radiator'` (render-dispatch key); the
 * V/G category is the same `'mep-radiator'` (→ plumbing via DISCIPLINE_BY_CATEGORY).
 */
export interface MepRadiatorEntity
  extends BimEntity<MepRadiatorKind, MepRadiatorParams, MepRadiatorGeometry>,
    IfcEntityMixin {
  readonly type: 'mep-radiator';
  /** IFC4 class — space heating terminal (radiator). */
  readonly ifcType: 'IfcSpaceHeater';
}

// ─── Defaults & constants ──────────────────────────────────────────────────────

/** Default radiator body width (mm) — the run along the wall. */
export const DEFAULT_RADIATOR_WIDTH_MM = 1000;

/** Default radiator depth (mm). */
export const DEFAULT_RADIATOR_LENGTH_MM = 100;

/** Default radiator panel vertical height (mm). */
export const DEFAULT_RADIATOR_BODY_HEIGHT_MM = 600;

/**
 * Default mounting elevation above FFL (mm) — vertical centre. With the default
 * 600mm body height the box spans ≈150–750mm (typical under-window radiator).
 */
export const DEFAULT_RADIATOR_MOUNTING_ELEVATION_MM = 450;

/** Default supply/return connector diameter (mm) — typical 15mm hydronic tail. */
export const DEFAULT_RADIATOR_CONNECTOR_DIAMETER_MM = 15;

/** Minimum radiator footprint dimension (mm) — below this is a placement error. */
export const MIN_RADIATOR_DIMENSION_MM = 50;
