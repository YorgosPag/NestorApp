/**
 * BIM Heating Boiler (Λέβητας / Καυστήρας) — Type Schema
 * (ADR-408 Σύστημα Θέρμανσης Εύρος Β #2, the hydronic SOURCE element).
 *
 * The boiler (Revit "Mechanical Equipment", IFC `IfcBoiler`) is the heat SOURCE of a
 * hydronic network — the inverse of the radiator (ADR-408 Εύρος Β #1, a terminal that
 * CONSUMES a network). It is a point-based BIM element that mirrors the radiator 1:1
 * in geometry/placement, with three deliberate differences:
 *
 *   1. It is a SOURCE, not a terminal. It carries EXACTLY TWO pipe connectors with
 *      FIXED classification but REVERSED flow direction vs the radiator: a supply
 *      outlet (`flow: 'out'`, `hydronic-supply`) at the +X end and a return inlet
 *      (`flow: 'in'`, `hydronic-return`) at the −X end. The supply outlet (flow:'out')
 *      makes the boiler the SOURCE of a hydronic-supply pipe network; the return inlet
 *      makes it a member of the return network.
 *   2. It OWNS a `systemClassification` (like the manifold, unlike the radiator):
 *      defaults to `hydronic-supply`, and a pipe network sourced from this boiler
 *      inherits it (Revit "source equipment owns the System Classification").
 *   3. IFC `IfcBoiler` + Revit "Mechanical Equipment" family (the radiator is
 *      `IfcSpaceHeater`).
 *
 * Pattern mirrors `mep-radiator-types.ts`: kind + params + geometry cache +
 * validation. All scalar geometry stored in mm (column/wall §5.0 convention).
 *
 * SSoT:
 *   - `MepBoilerParams.position` + `rotation` + `width`/`length` define the 2D
 *     footprint polygon (computed by `computeMepBoilerGeometry`).
 *   - The two connectors are derived (seeded) from `width`/`connectorDiameterMm` by
 *     `buildBoilerConnectors`, not hand-authored.
 *   - `MepBoilerGeometry` cache is re-derivable from params (corruption-safe).
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
import type { BoilerFuelType } from '../mep-boilers/boiler-model-catalog';

// ─── Sub-type discriminator (ADR-408 Εύρος Β #2) ──────────────────────────────

/**
 * Boiler kind discriminator.
 *   - `'wall-boiler'` — επίτοιχος λέβητας (the opening Εύρος Β #2 slice): a wall-hung
 *     hydronic heat source with one supply outlet + one return inlet.
 * Future boiler families (floor-standing, combi, heat-pump) append here without a new
 * EntityType. Maps 1:1 to the `'mep-boiler'` BimCategory.
 */
export type MepBoilerKind = 'wall-boiler';

/**
 * Footprint shape of the boiler body. A boiler is a rectangular cabinet; the
 * single-value union keeps the geometry pipeline symmetric with the radiator and
 * leaves room for a future profiled variant.
 */
export type MepBoilerShape = 'rectangular';

// ─── Parameters (user-editable SSoT) ──────────────────────────────────────────

export interface MepBoilerParams extends MepConnectorHostParams {
  readonly kind: MepBoilerKind;
  readonly shape: MepBoilerShape;
  /** Insertion point (plan). `z` is derived from `mountingElevationMm`. */
  readonly position: Point3D;
  /** Degrees CCW about `position` (plan). */
  readonly rotation: number;
  /** mm. Footprint width — the cabinet width along the wall (local X), along which the two connectors sit. */
  readonly width: number;
  /** mm. Footprint length (boiler depth, local Y). */
  readonly length: number;
  /** mm. Vertical height of the boiler cabinet (3D vertical extent). */
  readonly bodyHeightMm: number;
  /**
   * mm. Mounting elevation above the storey FFL — the **vertical centre** of the
   * boiler box (wall-mounted). The 3D box spans `mountingElevationMm ± bodyHeightMm/2`.
   */
  readonly mountingElevationMm: number;
  /** mm — nominal supply/return connector diameter (typical 22mm hydronic flow/return). */
  readonly connectorDiameterMm: number;
  /**
   * Hydraulic system classification the boiler SOURCES (ADR-408 Εύρος Β). Defaults to
   * `hydronic-supply`; a pipe network created from this boiler inherits it (Revit
   * "source equipment owns the System Classification"). Owned like the manifold.
   */
  readonly systemClassification?: PlumbingSystemClassification;
  /**
   * COMBI boiler flag (ADR-408 Εύρος Β — combi). When `true` the boiler also produces
   * domestic hot water: `buildBoilerConnectors` seeds TWO more connectors alongside the
   * hydronic supply/return pair — a DHW hot outlet (`domestic-hot-water`, sources the DHW
   * network) AND a DHW cold inlet (`domestic-cold-water`, member of the cold network) — so
   * the combi takes cold water and heats it, exactly like the water heater. Absent/false ⇒
   * space-heating only (2 connectors). Additive/optional — pre-combi boilers unchanged.
   */
  readonly producesDhw?: boolean;
  /**
   * DHW RECIRCULATION flag (ADR-408 Εύρος Β — combi + recirculation, Revit "Domestic Hot
   * Water + Recirculation"). When `true` AND the boiler is a combi (`producesDhw`),
   * `buildBoilerConnectors` seeds a FIFTH connector — a recirculation return inlet
   * (`flow:'in'`, reusing the `domestic-hot-water` classification) — so the cooled DHW
   * returns to the boiler and is re-heated, closing the recirculation loop. Gated by
   * `producesDhw` (a plain boiler / non-combi has no recirc even if this is set).
   * Additive/optional — pre-recirc combis unchanged.
   */
  readonly dhwRecirculation?: boolean;
  /**
   * mm — nominal DHW connector diameter for a combi boiler (hot outlet + cold inlet).
   * Typically smaller than the hydronic tails (DN15 vs DN22). Absent ⇒ falls back to
   * `connectorDiameterMm`. Only relevant when `producesDhw` is set.
   */
  readonly dhwConnectorDiameterMm?: number;
  /**
   * mm — nominal combustion flue (καπναγωγός) diameter for a gas/oil boiler. Drives
   * the `boiler-flue` duct connector (`buildBoilerConnectors`, ADR-408 duct foundation).
   * Absent ⇒ falls back to {@link DEFAULT_BOILER_FLUE_DIAMETER_MM}. Only relevant when
   * `fuelType` is a combustion source (gas/oil); ignored for electric/heat-pump.
   */
  readonly flueDiameterMm?: number;
  /**
   * W — optional catalogue thermal output (nominal heat output). Drives future
   * sizing/load-balancing; absent ⇒ not yet specified.
   */
  readonly thermalOutputW?: number;
  /**
   * DXF canvas coordinate unit. Stored so `computeMepBoilerGeometry` can convert
   * mm scalars → canvas units for the 2D footprint. Defaults to `'mm'`.
   */
  readonly sceneUnits?: SceneUnits;
  /** FK → Floor.id (storey reference). Semantic alias for entity-level floorId. */
  readonly storeyId?: string;
  /** Optional boiler catalog id (future). */
  readonly material?: string;
  /**
   * ADR-408 deferred hook — host element FK (wall) for future hosted placement
   * (Revit "Host"). Unused in the free-point slice; reserved so the hosted cascade
   * sub-step is non-breaking.
   */
  readonly hostId?: string;
  /**
   * Boiler Model Catalog id (ADR-408 Type Catalog). When set, the boiler's
   * geometry + thermalOutputW are driven by the catalog entry. Absent ⇒ fully
   * parametric (the user controls each dimension individually).
   * Persisted as a stable kebab-case string (e.g. `'gas-condensing-24'`).
   */
  readonly modelId?: string;
  /**
   * Heating fuel / energy source discriminator. Populated automatically when
   * picking a model from the Type Catalog; cleared when resetting to parametric.
   * Matches `BoilerFuelType` from `boiler-model-catalog`.
   */
  readonly fuelType?: BoilerFuelType;
}

// ─── Geometry cache (derivable from params; SSoT = params) ────────────────────

/**
 * Computed boiler geometry. Returned by `computeMepBoilerGeometry(params)` —
 * NEVER mutated by consumers. `area` in m², `height` (= box height) in mm.
 */
export interface MepBoilerGeometry {
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
 * Heating boiler BIM entity. Extends `BimEntity` with a `MepBoilerKind`
 * discriminator. `type` is the generic `'mep-boiler'` (render-dispatch key); the
 * V/G category is the same `'mep-boiler'` (→ plumbing via DISCIPLINE_BY_CATEGORY).
 */
export interface MepBoilerEntity
  extends BimEntity<MepBoilerKind, MepBoilerParams, MepBoilerGeometry>,
    IfcEntityMixin {
  readonly type: 'mep-boiler';
  /** IFC4 class — space heating source (boiler). */
  readonly ifcType: 'IfcBoiler';
}

// ─── Defaults & constants ──────────────────────────────────────────────────────

/** Default boiler cabinet width (mm) — the run along the wall. */
export const DEFAULT_BOILER_WIDTH_MM = 450;

/** Default boiler depth (mm). */
export const DEFAULT_BOILER_LENGTH_MM = 350;

/** Default boiler cabinet vertical height (mm). */
export const DEFAULT_BOILER_BODY_HEIGHT_MM = 700;

/**
 * Default mounting elevation above FFL (mm) — vertical centre. With the default
 * 700mm body height the box spans ≈850–1550mm (typical wall-hung boiler).
 */
export const DEFAULT_BOILER_MOUNTING_ELEVATION_MM = 1200;

/** Default supply/return connector diameter (mm) — typical 22mm hydronic flow/return. */
export const DEFAULT_BOILER_CONNECTOR_DIAMETER_MM = 22;

/** Default DHW connector diameter (mm) for a combi boiler — typical 15mm tap-water tail. */
export const DEFAULT_BOILER_DHW_CONNECTOR_DIAMETER_MM = 15;

/**
 * Default combustion flue (καπναγωγός) diameter (mm) for a gas/oil boiler — typical
 * DN100 wall-hung condensing flue (range DN80–130). Used when `flueDiameterMm` is absent.
 */
export const DEFAULT_BOILER_FLUE_DIAMETER_MM = 100;

/**
 * Default classification the boiler sources — the hydronic supply flow. A network
 * created from the boiler inherits this (Revit "source owns System Classification").
 */
export const DEFAULT_BOILER_SYSTEM_CLASSIFICATION: PlumbingSystemClassification =
  'hydronic-supply';

/** Minimum boiler footprint dimension (mm) — below this is a placement error. */
export const MIN_BOILER_DIMENSION_MM = 50;
