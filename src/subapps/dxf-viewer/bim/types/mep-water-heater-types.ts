/**
 * BIM Domestic Hot Water Heater (Θερμοσίφωνας / Παραγωγή ΖΝΧ) — Type Schema
 * (ADR-408 — η πηγή του δικτύου ζεστού νερού χρήσης / domestic-hot-water SOURCE).
 *
 * The water heater (Revit "Mechanical Equipment", IFC `IfcUnitaryEquipment`) is the
 * SOURCE of the **domestic hot water** network — the missing source that finally feeds
 * the hot-water inlets of the plumbing fixtures (νιπτήρας/ντουζιέρα/μπανιέρα). It mirrors
 * the heating boiler (`mep-boiler`) 1:1 in geometry/placement, with the DHW-specific
 * connector semantics — three deliberate differences vs the boiler:
 *
 *   1. It carries EXACTLY TWO pipe connectors with FIXED classification: a cold inlet
 *      (`flow: 'in'`, `domestic-cold-water`) at the −X end and a hot outlet
 *      (`flow: 'out'`, `domestic-hot-water`) at the +X end. The hot outlet (flow:'out')
 *      makes the heater the SOURCE of a `domestic-hot-water` pipe network; the cold inlet
 *      makes it a member of the cold-water network. (The boiler's pair is
 *      hydronic-supply/return — space heating, not domestic hot water.)
 *   2. It OWNS a `systemClassification` (like the boiler/manifold): defaults to
 *      `domestic-hot-water`, and a pipe network sourced from this heater inherits it
 *      (Revit "source equipment owns the System Classification").
 *   3. IFC `IfcUnitaryEquipment` (packaged plumbing equipment) — distinct from the
 *      boiler's `IfcBoiler` to keep domestic-hot-water generation cleanly separated from
 *      space heating.
 *
 * Pattern mirrors `mep-boiler-types.ts`: kind + params + geometry cache + validation.
 * All scalar geometry stored in mm (column/wall §5.0 convention).
 *
 * SSoT:
 *   - `MepWaterHeaterParams.position` + `rotation` + `width`/`length` define the 2D
 *     footprint polygon (computed by `computeMepWaterHeaterGeometry`).
 *   - The two connectors are derived (seeded) from `width`/`connectorDiameterMm` by
 *     `buildWaterHeaterConnectors`, not hand-authored.
 *   - `MepWaterHeaterGeometry` cache is re-derivable from params (corruption-safe).
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

// ─── Sub-type discriminator (ADR-408 DHW) ─────────────────────────────────────

/**
 * Water-heater kind discriminator.
 *   - `'electric-water-heater'` — ηλεκτρικός θερμοσίφωνας (the opening DHW slice): a
 *     wall/floor domestic-hot-water source with one cold inlet + one hot outlet.
 * Future families (solar / gas / heat-pump water heater) append here without a new
 * EntityType. Maps 1:1 to the `'mep-water-heater'` BimCategory.
 */
export type MepWaterHeaterKind = 'electric-water-heater';

/**
 * Footprint shape of the water-heater body. A storage water heater is a rectangular
 * (or cylindrical, projected as rectangular) cabinet; the single-value union keeps the
 * geometry pipeline symmetric with the boiler and leaves room for a future variant.
 */
export type MepWaterHeaterShape = 'rectangular';

// ─── Parameters (user-editable SSoT) ──────────────────────────────────────────

export interface MepWaterHeaterParams extends MepConnectorHostParams {
  readonly kind: MepWaterHeaterKind;
  readonly shape: MepWaterHeaterShape;
  /** Insertion point (plan). `z` is derived from `mountingElevationMm`. */
  readonly position: Point3D;
  /** Degrees CCW about `position` (plan). */
  readonly rotation: number;
  /** mm. Footprint width — the tank width (local X), along which the two connectors sit. */
  readonly width: number;
  /** mm. Footprint length (tank depth, local Y). */
  readonly length: number;
  /** mm. Vertical height of the water-heater body (3D vertical extent). */
  readonly bodyHeightMm: number;
  /**
   * mm. Mounting elevation above the storey FFL — the **vertical centre** of the
   * water-heater body. The 3D box spans `mountingElevationMm ± bodyHeightMm/2`.
   */
  readonly mountingElevationMm: number;
  /** mm — nominal cold-inlet / hot-outlet connector diameter (typical 22mm). */
  readonly connectorDiameterMm: number;
  /**
   * Hydraulic system classification the heater SOURCES (ADR-408 DHW). Defaults to
   * `domestic-hot-water`; a pipe network created from this heater inherits it (Revit
   * "source equipment owns the System Classification"). Owned like the boiler/manifold.
   */
  readonly systemClassification?: PlumbingSystemClassification;
  /**
   * W — optional catalogue heating element power (nominal). Drives future sizing /
   * recovery-rate; absent ⇒ not yet specified.
   */
  readonly thermalOutputW?: number;
  /**
   * L — optional catalogue storage tank capacity (litres). Domestic-hot-water specific
   * (Revit appliance property); absent ⇒ not yet specified.
   */
  readonly tankCapacityL?: number;
  /**
   * DXF canvas coordinate unit. Stored so `computeMepWaterHeaterGeometry` can convert
   * mm scalars → canvas units for the 2D footprint. Defaults to `'mm'`.
   */
  readonly sceneUnits?: SceneUnits;
  /** FK → Floor.id (storey reference). Semantic alias for entity-level floorId. */
  readonly storeyId?: string;
  /** Optional water-heater catalog id (future). */
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
 * Computed water-heater geometry. Returned by `computeMepWaterHeaterGeometry(params)` —
 * NEVER mutated by consumers. `area` in m², `height` (= box height) in mm.
 */
export interface MepWaterHeaterGeometry {
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
 * Domestic hot water heater BIM entity. Extends `BimEntity` with a
 * `MepWaterHeaterKind` discriminator. `type` is the generic `'mep-water-heater'`
 * (render-dispatch key); the V/G category is the same `'mep-water-heater'`
 * (→ plumbing via DISCIPLINE_BY_CATEGORY).
 */
export interface MepWaterHeaterEntity
  extends BimEntity<MepWaterHeaterKind, MepWaterHeaterParams, MepWaterHeaterGeometry>,
    IfcEntityMixin {
  readonly type: 'mep-water-heater';
  /** IFC4 class — packaged plumbing equipment (domestic hot water heater). */
  readonly ifcType: 'IfcUnitaryEquipment';
}

// ─── Defaults & constants ──────────────────────────────────────────────────────

/** Default water-heater tank width (mm). */
export const DEFAULT_WATER_HEATER_WIDTH_MM = 500;

/** Default water-heater depth (mm). */
export const DEFAULT_WATER_HEATER_LENGTH_MM = 500;

/** Default water-heater body vertical height (mm) — a ~80L vertical storage cylinder. */
export const DEFAULT_WATER_HEATER_BODY_HEIGHT_MM = 900;

/**
 * Default mounting elevation above FFL (mm) — vertical centre. With the default 900mm
 * body height the box spans ≈1050–1950mm (typical wall-hung storage heater above WC).
 */
export const DEFAULT_WATER_HEATER_MOUNTING_ELEVATION_MM = 1500;

/** Default cold-inlet / hot-outlet connector diameter (mm) — typical 22mm. */
export const DEFAULT_WATER_HEATER_CONNECTOR_DIAMETER_MM = 22;

/**
 * Default classification the heater sources — the domestic hot water flow. A network
 * created from the heater inherits this (Revit "source owns System Classification").
 */
export const DEFAULT_WATER_HEATER_SYSTEM_CLASSIFICATION: PlumbingSystemClassification =
  'domestic-hot-water';

/** Minimum water-heater footprint dimension (mm) — below this is a placement error. */
export const MIN_WATER_HEATER_DIMENSION_MM = 50;
