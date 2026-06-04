/**
 * BIM Plumbing Manifold (Συλλέκτης) — Type Schema (ADR-408 Φ12, the plumbing
 * distribution SOURCE element).
 *
 * The plumbing manifold (Revit "Plumbing Equipment" / floor manifold, IFC
 * `IfcPipeFitting` PredefinedType JUNCTION — a multi-branch distributor) is the
 * water-network analogue of the electrical panel (ADR-408 Φ3): a point-based BIM
 * element that a plumbing `MepSystem` references as its `sourceEntityId`. It
 * mirrors the electrical-panel pipeline 1:1, with two deliberate differences:
 *
 *   1. Its connectors are in the **pipe** domain: ONE inlet (`flow: 'in'`,
 *      classification `domestic-cold-water`) at the −X short end and N outlets
 *      (`flow: 'out'`) spread along the bar, where a panel has a single power-out.
 *   2. It is **floor-mounted**: the 3D box is centred vertically on a low
 *      `mountingElevationMm` (≈ floor level), not wall-mounted at chest height.
 *
 * Pattern mirrors `electrical-panel-types.ts`: kind + params + geometry cache +
 * validation. All scalar geometry stored in mm (column/wall §5.0 convention).
 *
 * SSoT:
 *   - `MepManifoldParams.position` + `rotation` + `width`/`length` define the 2D
 *     footprint polygon (computed by `computeMepManifoldGeometry`).
 *   - `outletCount` drives connector layout; connectors are derived (seeded) from
 *     it, not hand-authored.
 *   - `MepManifoldGeometry` cache is re-derivable from params (corruption-safe).
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
import type { PlumbingSystemClassification } from './mep-connector-types';

// ─── Sub-type discriminator (ADR-408 Φ12) ─────────────────────────────────────

/**
 * Manifold kind discriminator.
 *   - `'floor-manifold'` — συλλέκτης δαπέδου (domestic water DISTRIBUTOR): 1 inlet
 *     + N outlets, feeds branches (the opening Φ12 slice).
 *   - `'drainage-collector'` — φρεάτιο/συλλέκτης αποχέτευσης (sanitary COLLECTOR,
 *     ADR-408 Φ14): the mirror — N gravity inlets + 1 sewer outlet. Same point-based
 *     `IfcPipeFitting` body; only the connector roles + default classification flip.
 * Future plumbing equipment families append here without a new EntityType. Maps 1:1
 * to the `'mep-manifold'` BimCategory.
 */
export type MepManifoldKind = 'floor-manifold' | 'drainage-collector';

/** True for the drainage collector kind (N inlets + 1 outlet, sanitary). */
export function isDrainageCollectorKind(kind: MepManifoldKind): boolean {
  return kind === 'drainage-collector';
}

/**
 * Footprint shape of the manifold body. A manifold is a rectangular bar; the
 * single-value union keeps the geometry pipeline symmetric with the panel and
 * leaves room for a future round-header variant.
 */
export type MepManifoldShape = 'rectangular';

// ─── Parameters (user-editable SSoT) ──────────────────────────────────────────

export interface MepManifoldParams extends MepConnectorHostParams {
  readonly kind: MepManifoldKind;
  readonly shape: MepManifoldShape;
  /** Insertion point (plan). `z` is derived from `mountingElevationMm`. */
  readonly position: Point3D;
  /** Degrees CCW about `position` (plan). */
  readonly rotation: number;
  /** mm. Footprint width — the bar length, along which the outlets line up (local X). */
  readonly width: number;
  /** mm. Footprint length (manifold depth, local Y). */
  readonly length: number;
  /** mm. Vertical height of the manifold box (3D vertical extent). */
  readonly bodyHeightMm: number;
  /**
   * mm. Mounting elevation above the storey FFL — the **vertical centre** of the
   * manifold box (floor-mounted). The 3D box spans `mountingElevationMm ± bodyHeightMm/2`.
   */
  readonly mountingElevationMm: number;
  /**
   * Number of outlet (`flow: 'out'`) pipe connectors. The single inlet is always
   * present additionally. Drives the seeded connector layout + outlet stubs.
   */
  readonly outletCount: number;
  /** mm — nominal inlet connector diameter. */
  readonly inletDiameterMm: number;
  /** mm — nominal outlet connector diameter. */
  readonly outletDiameterMm: number;
  /**
   * Revit "System Classification" the manifold distributes (ADR-408 Φ-heating) —
   * `domestic-cold-water` (ύδρευση) … `hydronic-supply`/`hydronic-return`
   * (θέρμανση). The manifold OWNS it; its seeded connectors derive from it
   * (`buildMepManifoldConnectors`) and a pipe network created from this manifold
   * inherits it. Absent ⇒ `domestic-cold-water` (back-compat with pre-heating docs).
   */
  readonly systemClassification?: PlumbingSystemClassification;
  /**
   * DXF canvas coordinate unit. Stored so `computeMepManifoldGeometry` can
   * convert mm scalars → canvas units for the 2D footprint. Defaults to `'mm'`.
   */
  readonly sceneUnits?: SceneUnits;
  /** FK → Floor.id (storey reference). Semantic alias for entity-level floorId. */
  readonly storeyId?: string;
  /** Optional manifold catalog id (future). */
  readonly material?: string;
  /**
   * ADR-408 deferred hook — host element FK (wall) for future hosted placement
   * (Revit "Host"). Unused in the free-point slice; reserved so the hosted
   * cascade sub-step is non-breaking.
   */
  readonly hostId?: string;
}

// ─── Geometry cache (derivable from params; SSoT = params) ────────────────────

/**
 * Computed manifold geometry. Returned by `computeMepManifoldGeometry(params)` —
 * NEVER mutated by consumers. `area` in m², `height` (= box height) in mm.
 */
export interface MepManifoldGeometry {
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
 * Plumbing manifold BIM entity. Extends `BimEntity` with a `MepManifoldKind`
 * discriminator. `type` is the generic `'mep-manifold'` (render-dispatch key);
 * the V/G category is the same `'mep-manifold'` (→ plumbing via
 * DISCIPLINE_BY_CATEGORY).
 */
export interface MepManifoldEntity
  extends BimEntity<MepManifoldKind, MepManifoldParams, MepManifoldGeometry>,
    IfcEntityMixin {
  readonly type: 'mep-manifold';
  /** IFC4 class — multi-branch pipe junction fitting (manifold). */
  readonly ifcType: 'IfcPipeFitting';
}

// ─── Defaults & constants ──────────────────────────────────────────────────────

/** Default manifold bar width (mm) — the run along which outlets line up. */
export const DEFAULT_MANIFOLD_WIDTH_MM = 400;

/** Default manifold depth (mm). */
export const DEFAULT_MANIFOLD_LENGTH_MM = 80;

/** Default manifold box vertical height (mm). */
export const DEFAULT_MANIFOLD_BODY_HEIGHT_MM = 60;

/** Default mounting elevation above FFL (mm) — vertical centre, floor-level. */
export const DEFAULT_MANIFOLD_MOUNTING_ELEVATION_MM = 400;

/** Default number of outlet connectors. */
export const DEFAULT_MANIFOLD_OUTLET_COUNT = 4;

/** Default inlet diameter (mm) — typical 1" supply header. */
export const DEFAULT_MANIFOLD_INLET_DIAMETER_MM = 25;

/** Default outlet diameter (mm) — typical 16mm PEX branch. */
export const DEFAULT_MANIFOLD_OUTLET_DIAMETER_MM = 16;

/** Minimum manifold footprint dimension (mm) — below this is a placement error. */
export const MIN_MANIFOLD_DIMENSION_MM = 20;

/** Min / max outlet count guards. */
export const MIN_MANIFOLD_OUTLET_COUNT = 1;
export const MAX_MANIFOLD_OUTLET_COUNT = 12;
