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
import type { FlueTerminationType } from '../mep-boilers/boiler-flue-terminal';

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
   * mm — nominal combustion FUEL SUPPLY (τροφοδοσία καυσίμου) diameter for a gas/oil
   * boiler. Drives the `boiler-fuel` fuel-domain connector (`buildBoilerConnectors`,
   * ADR-408 fuel foundation). Absent ⇒ falls back to {@link DEFAULT_BOILER_FUEL_DIAMETER_MM}.
   * Only relevant when `fuelType` is a combustion source (gas/oil); ignored for
   * electric/heat-pump. Additive/optional — pre-fuel-inlet boilers unchanged.
   */
  readonly fuelConnectorDiameterMm?: number;
  /**
   * CONDENSING boiler flag (ADR-408 Εύρος Β — condensate drain). When `true` the boiler
   * is a condensing appliance (Revit «Condensing» Yes/No): it extracts latent heat from
   * the flue gases and produces acidic CONDENSATE that must drain to the sanitary system.
   * `buildBoilerConnectors` then seeds a `boiler-condensate` connector (`flow:'out'`,
   * REUSING the `sanitary-drainage` classification — NOT a new union member) so the
   * condensate joins the SAME drainage network a floor drain / sanitary fixture does.
   * Set automatically for the gas condensing presets (`applyBoilerModelToParams`); cleared
   * with the model (Type-property). Explicit (Revit-grade), NOT inferred from efficiency —
   * gated independently of `fuelType`. Additive/optional — pre-condensate boilers unchanged.
   */
  readonly condensing?: boolean;
  /**
   * mm — nominal CONDENSATE DRAIN (αποχέτευση συμπυκνωμάτων) diameter for a condensing
   * boiler. Drives the `boiler-condensate` pipe connector (`buildBoilerConnectors`).
   * Absent ⇒ falls back to {@link DEFAULT_BOILER_CONDENSATE_DIAMETER_MM}. Only relevant
   * when `condensing` is set. Additive/optional — pre-condensate boilers unchanged.
   */
  readonly condensateConnectorDiameterMm?: number;
  /**
   * CONDENSATE NEUTRALISER flag (εξουδετερωτής συμπυκνωμάτων). When `true` (and the boiler
   * is `condensing`) the plan symbol draws a small in-line cartridge box on the condensate
   * drain run — a limestone neutraliser that raises the acidic condensate's pH before it
   * reaches the sewer (boiler → P-trap → neutraliser → drain). Visualisation only — no extra
   * connector. Gated by `condensing` (a non-condensing boiler has no condensate to neutralise).
   * Additive/optional — pre-neutraliser boilers unchanged.
   */
  readonly condensateNeutraliser?: boolean;
  /**
   * Combustion flue VENT TERMINAL type (Revit «Vent Terminal», καμινάδα) — how the flue
   * discharges to atmosphere (roof cowl / through-wall / concentric). Drives the distinct
   * terminal-cap glyph on the plan symbol + the tag line. Absent ⇒ {@link
   * DEFAULT_FLUE_TERMINATION} (roof cowl). Only relevant when `fuelType` is a combustion
   * source (gas/oil); ignored for electric/heat-pump. Additive/optional — pre-terminal
   * boilers unchanged.
   */
  readonly flueTermination?: FlueTerminationType;
  /**
   * SERVICE / MAINTENANCE CLEARANCE flag (Revit Mechanical Equipment «Clearances»). When
   * `true` the plan symbol draws a dashed «keep-clear» envelope offset uniformly outward
   * from the boiler footprint — the access zone required to service the appliance, used for
   * coordination / clash detection. Visualisation only (no connector / geometry impact).
   * Additive/optional — pre-clearance boilers unchanged.
   */
  readonly showServiceClearance?: boolean;
  /**
   * mm — uniform service-clearance distance offset outward from the footprint on every
   * side (Revit «Clearance» distance). Absent ⇒ falls back to {@link
   * DEFAULT_BOILER_SERVICE_CLEARANCE_MM}. Only drawn when `showServiceClearance` is set.
   * Additive/optional — pre-clearance boilers unchanged.
   */
  readonly serviceClearanceMm?: number;
  /**
   * SAFETY RELIEF VALVE flag (Revit «Safety Relief Valve», IFC `IfcValve` PRESSURERELIEF).
   * When `true` the plan symbol draws a small relief-valve body glyph on the boiler body — a
   * code-mandatory pressure-relief device every sealed-system boiler must carry (discharges to
   * a safe point if the system over-pressurises). Visualisation only — no extra connector (the
   * footprint perimeter is full). Additive/optional — pre-relief-valve boilers unchanged.
   */
  readonly safetyReliefValve?: boolean;
  /**
   * bar — relief-valve SET PRESSURE (Revit «Safety Relief Valve» set pressure). The pressure at
   * which the valve lifts; typical sealed-system value is 3 bar. Absent ⇒ falls back to {@link
   * DEFAULT_BOILER_RELIEF_PRESSURE_BAR}. Only meaningful when `safetyReliefValve` is set. A
   * standard valve rating from {@link BOILER_RELIEF_PRESSURES_BAR}. Additive/optional.
   */
  readonly reliefValvePressureBar?: number;
  /**
   * EXPANSION VESSEL flag (Revit Mechanical Equipment accessory, IFC `IfcTank` EXPANSION).
   * When `true` the plan symbol draws a small diaphragm-vessel body glyph on the boiler body
   * (a circle bisected by the membrane line) — the second code-mandatory pressure component of
   * every SEALED heating system (the natural partner of the safety relief valve: the vessel
   * absorbs thermal expansion, the valve relieves over-pressure). Visualisation only — no extra
   * connector (the footprint perimeter is full). Additive/optional — pre-vessel boilers unchanged.
   */
  readonly expansionVessel?: boolean;
  /**
   * L — expansion-vessel nominal VOLUME (litres). The vessel capacity sized to absorb the
   * system water's thermal expansion; typical domestic sealed system is 12 L. Absent ⇒ falls
   * back to {@link DEFAULT_BOILER_EXPANSION_VESSEL_L}. Only meaningful when `expansionVessel`
   * is set. A standard rating from {@link BOILER_EXPANSION_VESSEL_VOLUMES_L}. Additive/optional.
   */
  readonly expansionVesselVolumeL?: number;
  /**
   * PRESSURE GAUGE flag (Revit Mechanical Equipment accessory, IFC `IfcSensor` PRESSURE).
   * When `true` the plan symbol draws a small dial-gauge body glyph on the boiler body (a
   * circle with a radial pointer needle) — the third instrument of the sealed-system
   * pressurisation «trio» (safety relief valve + expansion vessel + pressure gauge): it lets
   * the installer read the system fill pressure. Visualisation only — no extra connector (the
   * footprint perimeter is full). Additive/optional — pre-gauge boilers unchanged.
   */
  readonly pressureGauge?: boolean;
  /**
   * bar — SYSTEM (cold fill) PRESSURE shown on the gauge. The pressure the sealed system is
   * charged to COLD (typical domestic value ~1.5 bar) — DISTINCT from the relief valve's SET
   * pressure ({@link reliefValvePressureBar}, ~3 bar, at which the valve lifts). Absent ⇒ falls
   * back to {@link DEFAULT_BOILER_SYSTEM_PRESSURE_BAR}. Only meaningful when `pressureGauge` is
   * set. A standard fill value from {@link BOILER_SYSTEM_PRESSURES_BAR}. Additive/optional.
   */
  readonly systemPressureBar?: number;
  /**
   * W — optional catalogue thermal output (nominal heat output). Drives future
   * sizing/load-balancing; absent ⇒ not yet specified.
   */
  readonly thermalOutputW?: number;
  /**
   * W — MINIMUM modulating thermal output (Revit «Turndown Ratio» / IFC part-load family).
   * A modulating boiler varies its firing rate between this minimum and its NOMINAL output
   * (`thermalOutputW`, the maximum); the TURNDOWN RATIO = `thermalOutputW / minThermalOutputW`
   * (`resolveTurndownRatio`). Populated by the Type Catalog for modulating presets; absent ⇒
   * a fixed-output / on-off appliance (no turndown). Additive/optional — pre-modulation
   * boilers unchanged.
   */
  readonly minThermalOutputW?: number;
  /**
   * % — seasonal APPLIANCE efficiency (Revit «Nominal Efficiency», IFC
   * `Pset_BoilerTypeCommon.NominalEfficiency`). Populated by the Type Catalog; drives
   * the EU ErP energy class (`resolveErpClass`, primary-energy adjusted) shown on the
   * plan tag + the «Θερμικά» readout, and unblocks ADR-422 L8 ΚΕΝΑΚ primary-energy
   * (`Q_primary = Q_net / η`). Absent ⇒ unspecified. Additive/optional.
   */
  readonly seasonalEfficiencyPercent?: number;
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
 * Default combustion flue (καπναγωγός) diameter (mm) — the GAS baseline: typical DN100
 * wall-hung gas condensing flue (range DN80–130). For OIL boilers the larger
 * {@link DEFAULT_BOILER_OIL_FLUE_DIAMETER_MM} applies — resolve per fuel via
 * {@link defaultBoilerFlueDiameterMm}, NOT this const directly. Used when `flueDiameterMm`
 * is absent.
 */
export const DEFAULT_BOILER_FLUE_DIAMETER_MM = 100;

/**
 * Default combustion flue (καπναγωγός) diameter (mm) for an OIL boiler — DN130. Oil flue
 * gases run cooler and sootier than gas, so the type-driven default flue is larger (Revit
 * Mechanical Equipment Type behaviour). Resolved via {@link defaultBoilerFlueDiameterMm}.
 */
export const DEFAULT_BOILER_OIL_FLUE_DIAMETER_MM = 130;

/**
 * Default combustion FUEL SUPPLY (τροφοδοσία καυσίμου) diameter (mm) — the GAS baseline:
 * typical DN20 gas connection (3/4" BSP). For OIL boilers the narrower
 * {@link DEFAULT_BOILER_OIL_FUEL_DIAMETER_MM} applies — resolve per fuel via
 * {@link defaultBoilerFuelDiameterMm}, NOT this const directly. Used when
 * `fuelConnectorDiameterMm` is absent.
 */
export const DEFAULT_BOILER_FUEL_DIAMETER_MM = 20;

/**
 * Default combustion FUEL SUPPLY (τροφοδοσία καυσίμου) diameter (mm) for an OIL boiler —
 * DN15. Oil supply lines are narrower than gas connections (type-driven default, Revit
 * Mechanical Equipment Type behaviour). Resolved via {@link defaultBoilerFuelDiameterMm}.
 */
export const DEFAULT_BOILER_OIL_FUEL_DIAMETER_MM = 15;

/**
 * Resolve the type-driven default combustion flue (καπναγωγός) diameter (mm) for a boiler's
 * `fuelType` (Revit Mechanical Equipment Type default): OIL → the larger DN130, every other
 * combustion source (gas) → the DN100 gas baseline. Pure SSoT shared by the connector
 * builder (`buildBoilerConnectors`) and the plan tag (`resolveBoilerTagLines`) so the drawn
 * port and its label always agree. Only meaningful under the combustion gate (gas/oil); an
 * explicit `flueDiameterMm` overrides it.
 */
export function defaultBoilerFlueDiameterMm(fuelType: BoilerFuelType | undefined): number {
  return fuelType === 'oil' ? DEFAULT_BOILER_OIL_FLUE_DIAMETER_MM : DEFAULT_BOILER_FLUE_DIAMETER_MM;
}

/**
 * Resolve the type-driven default combustion FUEL SUPPLY (τροφοδοσία καυσίμου) diameter (mm)
 * for a boiler's `fuelType` (Revit Mechanical Equipment Type default): OIL → the narrower
 * DN15, every other combustion source (gas) → the DN20 gas baseline. Pure SSoT shared by the
 * connector builder (`buildBoilerConnectors`) and the plan tag (`resolveBoilerTagLines`).
 * Only meaningful under the combustion gate (gas/oil); an explicit `fuelConnectorDiameterMm`
 * overrides it.
 */
export function defaultBoilerFuelDiameterMm(fuelType: BoilerFuelType | undefined): number {
  return fuelType === 'oil' ? DEFAULT_BOILER_OIL_FUEL_DIAMETER_MM : DEFAULT_BOILER_FUEL_DIAMETER_MM;
}

/**
 * Default CONDENSATE DRAIN (αποχέτευση συμπυκνωμάτων) diameter (mm) for a condensing
 * boiler — typical DN25 condensate trap line (range DN20–32). Used when
 * `condensateConnectorDiameterMm` is absent.
 */
export const DEFAULT_BOILER_CONDENSATE_DIAMETER_MM = 25;

/**
 * Default SERVICE / MAINTENANCE CLEARANCE distance (mm) — the uniform «keep-clear»
 * envelope offset outward from the boiler footprint (Revit Mechanical Equipment
 * «Clearances»). ~500mm front service access for a wall-hung boiler. Used when
 * `serviceClearanceMm` is absent and `showServiceClearance` is set.
 */
export const DEFAULT_BOILER_SERVICE_CLEARANCE_MM = 500;

/**
 * Default SAFETY RELIEF VALVE set pressure (bar) — the pressure at which the valve lifts.
 * 3 bar is the standard set pressure for a domestic sealed-system boiler (Revit «Safety
 * Relief Valve»). Used when `reliefValvePressureBar` is absent and `safetyReliefValve` is set.
 */
export const DEFAULT_BOILER_RELIEF_PRESSURE_BAR = 3;

/**
 * Standard SAFETY RELIEF VALVE set-pressure ratings (bar) — the discrete valve diaphragm/spring
 * ratings offered in the «Ασφάλεια» panel picker (Revit set-pressure is selected from standard
 * ratings, not a free numeric). SSoT shared by the ribbon options + (future) validation. The
 * default 3 bar (sealed-system standard) is one of these.
 */
export const BOILER_RELIEF_PRESSURES_BAR: readonly number[] = [1.5, 2.5, 3, 4, 6];

/**
 * Default EXPANSION VESSEL volume (litres) — the diaphragm vessel capacity sized to absorb
 * the system water's thermal expansion. 12 L is the standard for a domestic sealed-system
 * boiler (Revit Mechanical Equipment accessory). Used when `expansionVesselVolumeL` is absent
 * and `expansionVessel` is set.
 */
export const DEFAULT_BOILER_EXPANSION_VESSEL_L = 12;

/**
 * Standard EXPANSION VESSEL volume ratings (litres) — the discrete capacities offered in the
 * «Ασφάλεια» panel picker (vessel volume is selected from standard sizes). SSoT shared by the
 * ribbon options + (future) validation. All integers (no rounding hazard → plain numeric
 * picker). The default 12 L is one of these.
 */
export const BOILER_EXPANSION_VESSEL_VOLUMES_L: readonly number[] = [8, 12, 18, 24, 35];

/**
 * Default SYSTEM (cold fill) PRESSURE (bar) shown on the gauge — the pressure a domestic
 * sealed heating system is charged to cold. 1.5 bar is the standard fill value (DISTINCT from
 * the relief valve's 3 bar SET pressure). Used when `systemPressureBar` is absent and
 * `pressureGauge` is set.
 */
export const DEFAULT_BOILER_SYSTEM_PRESSURE_BAR = 1.5;

/**
 * Standard SYSTEM (cold fill) PRESSURE values (bar) — the discrete fill pressures offered in the
 * «Ασφάλεια» panel gauge picker. SSoT shared by the ribbon options + (future) validation. The
 * values are FRACTIONAL (1 / 1.2 / 1.5 / 2 bar) → a static-enum STRING picker is mandatory (the
 * generic numeric path would round them, corrupting 1.2 / 1.5). The default 1.5 bar is one of these.
 */
export const BOILER_SYSTEM_PRESSURES_BAR: readonly number[] = [1, 1.2, 1.5, 2];

/**
 * Default classification the boiler sources — the hydronic supply flow. A network
 * created from the boiler inherits this (Revit "source owns System Classification").
 */
export const DEFAULT_BOILER_SYSTEM_CLASSIFICATION: PlumbingSystemClassification =
  'hydronic-supply';

/** Minimum boiler footprint dimension (mm) — below this is a placement error. */
export const MIN_BOILER_DIMENSION_MM = 50;
