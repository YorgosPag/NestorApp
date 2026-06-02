/**
 * BIM Electrical Panel — Type Schema (ADR-408 Φ3, the circuit SOURCE element).
 *
 * The electrical panel (Revit "Electrical Equipment" / "Power Source",
 * IFC `IfcElectricDistributionBoard`) is the first MEP **source**: a point-based
 * BIM element that a `MepSystem` references as its `sourceEntityId` /
 * `sourceConnectorId`. It mirrors the ADR-406 light fixture pipeline 1:1, with
 * two deliberate differences:
 *
 *   1. Its connector flows **out** (`flow: 'out'`, classification `power`) — it
 *      feeds a circuit, where a fixture's connector flows in (it is a load).
 *   2. It is **wall-mounted**: the 3D box is centred vertically on
 *      `mountingElevationMm` above the storey FFL (a fixture hangs from a
 *      ceiling plane). See `panelToMesh` (uses the units-safe stair scene→meters
 *      pattern, NOT the fixture meter-scene assumption).
 *
 * Pattern mirrors `mep-fixture-types.ts`: kind + params + geometry cache +
 * validation. All scalar geometry stored in mm (column/wall §5.0 convention).
 *
 * SSoT:
 *   - `ElectricalPanelParams.position` + `rotation` + `width`/`length` define the
 *     2D footprint polygon (computed by `computeElectricalPanelGeometry`).
 *   - `ElectricalPanelGeometry` cache is re-derivable from params (corruption-safe).
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

// ─── Sub-type discriminator (ADR-408 Φ3) ──────────────────────────────────────

/**
 * Electrical panel kind discriminator. The opening slice ships
 * `'distribution-board'` (a panelboard / consumer unit); future electrical
 * equipment families append here (e.g. `'switchboard'`, `'transformer'`) without
 * a new EntityType. Maps 1:1 to the `'electrical-panel'` BimCategory.
 */
export type ElectricalPanelKind = 'distribution-board';

/**
 * Footprint shape of the panel body. A panelboard is always rectangular (the
 * single-value union keeps the geometry pipeline symmetric with the fixture and
 * leaves room for a future flush/surface variant).
 */
export type ElectricalPanelShape = 'rectangular';

// ─── Parameters (user-editable SSoT) ──────────────────────────────────────────

export interface ElectricalPanelParams extends MepConnectorHostParams {
  readonly kind: ElectricalPanelKind;
  readonly shape: ElectricalPanelShape;
  /** Insertion point (plan). `z` is derived from `mountingElevationMm`. */
  readonly position: Point3D;
  /** Degrees CCW about `position` (plan). */
  readonly rotation: number;
  /** mm. Footprint width (panel face along the wall). */
  readonly width: number;
  /** mm. Footprint length (panel depth, into the wall). */
  readonly length: number;
  /** mm. Vertical height of the panel box (3D vertical extent). */
  readonly bodyHeightMm: number;
  /**
   * mm. Mounting elevation above the storey FFL — the **vertical centre** of the
   * panel box (wall-mounted; a fixture's mounting elevation is its top face). The
   * 3D box spans `mountingElevationMm ± bodyHeightMm/2`.
   */
  readonly mountingElevationMm: number;
  /**
   * DXF canvas coordinate unit. Stored so `computeElectricalPanelGeometry` can
   * convert mm scalars → canvas units for the 2D footprint. Defaults to `'mm'`.
   */
  readonly sceneUnits?: SceneUnits;
  /** FK → Floor.id (storey reference). Semantic alias for entity-level floorId. */
  readonly storeyId?: string;
  /** Optional panel catalog id (Phase 6+). */
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
 * Computed panel geometry. Returned by `computeElectricalPanelGeometry(params)` —
 * NEVER mutated by consumers. `area` in m², `height` (= box height) in mm.
 */
export interface ElectricalPanelGeometry {
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
 * Electrical panel BIM entity. Extends `BimEntity` with an `ElectricalPanelKind`
 * discriminator. `type` is the generic `'electrical-panel'` (render-dispatch
 * key); the V/G category is the same `'electrical-panel'` (→ electrical via
 * DISCIPLINE_BY_CATEGORY).
 */
export interface ElectricalPanelEntity
  extends BimEntity<ElectricalPanelKind, ElectricalPanelParams, ElectricalPanelGeometry>,
    IfcEntityMixin {
  readonly type: 'electrical-panel';
  /** IFC4 class — panelboard / consumer unit. */
  readonly ifcType: 'IfcElectricDistributionBoard';
}

// ─── Defaults & constants ──────────────────────────────────────────────────────

/** Default panel face width (mm) — typical residential consumer unit. */
export const DEFAULT_PANEL_WIDTH_MM = 600;

/** Default panel depth into the wall (mm). */
export const DEFAULT_PANEL_LENGTH_MM = 150;

/** Default panel box vertical height (mm). */
export const DEFAULT_PANEL_BODY_HEIGHT_MM = 700;

/**
 * Default mounting elevation above FFL (mm) — vertical centre of the box, so the
 * top sits at a reachable height (Revit/IEC ergonomics: breakers ≤ ~2 m).
 */
export const DEFAULT_PANEL_MOUNTING_ELEVATION_MM = 1500;

/** Minimum panel footprint dimension (mm) — below this is a placement error. */
export const MIN_PANEL_DIMENSION_MM = 20;
