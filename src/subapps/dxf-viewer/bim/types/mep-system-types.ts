/**
 * BIM MEP System — Type Schema (ADR-408 Φ2, MEP backbone).
 *
 * A **System** is a logical network that groups MEP components through their
 * connectors (Revit electrical circuit / duct system / piping system; IFC
 * `IfcDistributionSystem`). The opening slice ships the **electrical circuit**.
 *
 * SSoT / ownership (ADR-408 §):
 *   - A `MepSystem` is a **first-class persisted document** (collection
 *     `floorplan_mep_systems`, enterprise-id `mepsys_*`) but has **NO geometry**
 *     — it is not a drawn shape, not selectable on the canvas, and therefore is
 *     deliberately NOT part of the scene `Entity` union. It loads into its own
 *     store, like a schedule/preset.
 *   - The System **owns membership truth** (`params.members`). The
 *     `MepConnector.systemId` back-reference on each member is a derived cache,
 *     reconciled System→connector (`mep-system-coordinator.ts`). System wins.
 *   - A member is a `(entityId, connectorId)` tuple — the host component plus the
 *     specific connector on it that participates in the circuit.
 *   - The circuit **source** is the base equipment (Revit "Power Source"): a
 *     panel's outgoing connector. `sourceEntityId`/`sourceConnectorId`.
 *
 * `duct`/`pipe` system types are reserved (mirror ADR-405 reserved disciplines).
 *
 * @see ./mep-connector-types.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { Timestamp } from 'firebase/firestore';
import type {
  ElectricalSystemClassification,
  PlumbingSystemClassification,
  DuctSystemClassification,
  FuelSystemClassification,
  PipeFluid,
} from './mep-connector-types';
import type { WireStyle } from '../mep-systems/mep-wire-routing';
import type { WireWaypointMap } from '../mep-systems/mep-wire-waypoints';

/**
 * System type discriminator (ADR-408 + ADR-432). `electrical-circuit` (Φ2),
 * `pipe-network` (Φ9 — plumbing: ύδρευση / αποχέτευση / θέρμανση) and `duct-network`
 * (ADR-432 — HVAC αεραγωγοί: προσαγωγή / επιστροφή αέρα). The discriminant narrows
 * {@link MepSystemParams} so electrical-only fields (wireStyle, conductors, …) never
 * appear on a pipe/duct network and the air classification never appears on a pipe one.
 */
export type MepSystemType =
  | 'electrical-circuit'
  | 'pipe-network'
  | 'duct-network'
  | 'fuel-network';

/** One member of a System: a specific connector on a specific component. */
export interface MepSystemMember {
  /** FK → host component entity id (panel or fixture). */
  readonly entityId: string;
  /** Host-local connector id on that component. */
  readonly connectorId: string;
}

/**
 * Fields shared by every MEP system regardless of domain. The domain-specific
 * arms ({@link MepElectricalSystemParams} / {@link MepPipeSystemParams}) extend
 * this and pin `systemType` + the matching `systemClassification`.
 */
export interface MepSystemParamsBase {
  /** Display name, e.g. "Circuit L1-04" / "Κρύο νερό 1". */
  readonly name: string;
  /** Source / base equipment connector — panel (circuit) or root segment/manifold (pipe). */
  readonly sourceEntityId: string;
  readonly sourceConnectorId: string;
  /** MEMBERSHIP TRUTH — ordered list of members. */
  readonly members: readonly MepSystemMember[];
  /**
   * The System **owns** its display colour (Revit "System Colour"): the hex
   * applied to every member + source when colour-by-system renders (ADR-408 Φ5).
   * SSoT truth — `MepConnector.systemId` is the membership cache, this is the
   * paint. Defaulted at creation (palette for circuits, classification colour for
   * pipe networks); user-editable.
   */
  readonly color?: string;
}

/** Electrical-circuit params (ADR-408 Φ2). */
export interface MepElectricalSystemParams extends MepSystemParamsBase {
  readonly systemType: 'electrical-circuit';
  readonly systemClassification: ElectricalSystemClassification;
  /**
   * Per-circuit wire-drawing style (Revit "Wiring Type") for the derived
   * home-run run: `'straight'` (default) / `'orthogonal'` / `'arc'`. SSoT lives
   * here on the System; the path carries it and both 2D + 3D renderers read it
   * via `buildWirePolyline` (ADR-408 Φ7). Absent ⇒ `'straight'`.
   */
  readonly wireStyle?: WireStyle;
  /**
   * Per-segment user waypoints (Revit "Wire Vertex") for the derived home-run
   * run, keyed order-independently by the segment's host pair (ADR-408 Φ7 FU#3).
   * SSoT user data — `computeCircuitWirePaths` splices them into the routed
   * polyline so 2D + 3D follow. Absent ⇒ pure auto-routed daisy chain.
   */
  readonly wireWaypoints?: WireWaypointMap;
  /**
   * Per-circuit conductor breakdown (Revit "#wires" / home-run tick marks): how
   * many ungrounded (`hot`), grounded (`neutral`) and equipment-ground (`ground`)
   * conductors run on the home-run leg. Drives the 2D tick annotation
   * (`buildConductorTicks` → `MepWireRenderer`). Absent ⇒ {@link DEFAULT_CONDUCTORS}.
   */
  readonly conductors?: ConductorBreakdown;
  /** Optional electrical rollups (derivable from member connectedLoadVa). */
  readonly ratedVoltage?: number;
  readonly poles?: 1 | 2 | 3;
}

/** Pipe-network params (ADR-408 Φ9 — plumbing: ύδρευση / αποχέτευση / θέρμανση). */
export interface MepPipeSystemParams extends MepSystemParamsBase {
  readonly systemType: 'pipe-network';
  readonly systemClassification: PlumbingSystemClassification;
  /** mm — nominal network diameter (optional; feeds future sizing). */
  readonly diameterMm?: number;
  /** Conveyed fluid (defaulted from classification). */
  readonly fluid?: PipeFluid;
}

/** Duct-network params (ADR-432 — HVAC: αεραγωγοί προσαγωγής / επιστροφής αέρα). */
export interface MepDuctSystemParams extends MepSystemParamsBase {
  readonly systemType: 'duct-network';
  readonly systemClassification: DuctSystemClassification;
  /** mm — nominal network duct diameter (round duct; optional, feeds sizing). */
  readonly diameterMm?: number;
}

/**
 * Fuel-network params (ADR-434 — gas/oil supply: τροφοδοσία αερίου). Mirror of
 * {@link MepDuctSystemParams} for the combustion-fuel domain: the network groups gas/oil
 * supply runs from the meter source to the appliances. Like the duct network (and unlike a
 * pipe network) the `'fuel'` segment carries NO classification — the System owns the
 * `fuel-gas` / `fuel-oil` classification.
 */
export interface MepFuelSystemParams extends MepSystemParamsBase {
  readonly systemType: 'fuel-network';
  readonly systemClassification: FuelSystemClassification;
  /** mm — nominal network fuel-line diameter (optional, feeds sizing). */
  readonly diameterMm?: number;
}

/**
 * User-editable SSoT params for a MEP system — a **discriminated union** on
 * `systemType`. Narrow before touching domain-specific fields.
 */
export type MepSystemParams =
  | MepElectricalSystemParams
  | MepPipeSystemParams
  | MepDuctSystemParams
  | MepFuelSystemParams;

/** Narrow to the electrical-circuit arm (Revit circuit). */
export function isElectricalSystemParams(
  params: MepSystemParams,
): params is MepElectricalSystemParams {
  return params.systemType === 'electrical-circuit';
}

/** Narrow to the pipe-network arm (ADR-408 Φ9 — plumbing). */
export function isPipeSystemParams(
  params: MepSystemParams,
): params is MepPipeSystemParams {
  return params.systemType === 'pipe-network';
}

/** Narrow to the duct-network arm (ADR-432 — HVAC air). */
export function isDuctSystemParams(
  params: MepSystemParams,
): params is MepDuctSystemParams {
  return params.systemType === 'duct-network';
}

/** Narrow to the fuel-network arm (ADR-434 — gas/oil supply). */
export function isFuelSystemParams(
  params: MepSystemParams,
): params is MepFuelSystemParams {
  return params.systemType === 'fuel-network';
}

/**
 * Conductor counts of a circuit's home-run, by NEC/Revit role. Each conductor
 * draws one tick across the home-run leg: `hot` = long tick (ungrounded), `neutral`
 * = short tick (grounded), `ground` = short tick with a dot (equipment ground).
 */
export interface ConductorBreakdown {
  readonly hot: number;
  readonly neutral: number;
  readonly ground: number;
}

/**
 * A persisted MEP system. Named `…Entity` for parallelism with BIM elements, but
 * it is geometry-less and NOT in the scene `Entity` union. Tenant + audit fields
 * mirror `MepFixtureDoc`.
 */
export interface MepSystemEntity {
  readonly id: string;
  readonly params: MepSystemParams;
  readonly companyId?: string;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly createdAt?: Timestamp;
  readonly createdBy?: string;
  readonly updatedAt?: Timestamp;
  readonly updatedBy?: string;
}

// ─── Defaults ──────────────────────────────────────────────────────────────────

/**
 * Default conductor count for a circuit's home-run when none is set: a standard
 * 2-wire-plus-ground lighting branch (1 hot + 1 neutral + 1 equipment ground).
 */
export const DEFAULT_CONDUCTORS: ConductorBreakdown = { hot: 1, neutral: 1, ground: 1 };

/** Default electrical circuit params (members/source filled by the caller). */
export function buildDefaultCircuitParams(
  name: string,
  sourceEntityId: string,
  sourceConnectorId: string,
  members: readonly MepSystemMember[] = [],
  color?: string,
): MepElectricalSystemParams {
  return {
    systemType: 'electrical-circuit',
    name,
    systemClassification: 'lighting',
    sourceEntityId,
    sourceConnectorId,
    members,
    ...(color ? { color } : {}),
  };
}

/**
 * Default pipe-network params (ADR-408 Φ9). Unlike a circuit there is no panel
 * source; the caller passes the deterministic root segment connector as source
 * and the classification derived/chosen for the network. Members filled by the
 * caller (typically the connectivity-graph walk, `mep-pipe-network-derive.ts`).
 */
export function buildDefaultPipeNetworkParams(
  name: string,
  systemClassification: PlumbingSystemClassification,
  sourceEntityId: string,
  sourceConnectorId: string,
  members: readonly MepSystemMember[] = [],
  color?: string,
): MepPipeSystemParams {
  return {
    systemType: 'pipe-network',
    name,
    systemClassification,
    sourceEntityId,
    sourceConnectorId,
    members,
    ...(color ? { color } : {}),
  };
}

/**
 * Default duct-network params (ADR-432 — HVAC). Mirror of {@link buildDefaultPipeNetworkParams}
 * for the air domain: the caller passes the AHU outlet connector as source and the duct
 * classification (`supply-air` / `return-air`) the network carries. Members filled by the
 * caller (the HVAC commit: every emitted duct segment's two endpoint connectors + the served
 * air terminals' duct inlets).
 */
export function buildDefaultDuctNetworkParams(
  name: string,
  systemClassification: DuctSystemClassification,
  sourceEntityId: string,
  sourceConnectorId: string,
  members: readonly MepSystemMember[] = [],
  color?: string,
): MepDuctSystemParams {
  return {
    systemType: 'duct-network',
    name,
    systemClassification,
    sourceEntityId,
    sourceConnectorId,
    members,
    ...(color ? { color } : {}),
  };
}

/**
 * Default fuel-network params (ADR-434 — gas/oil). Mirror of {@link buildDefaultDuctNetworkParams}
 * for the fuel domain: the caller passes the gas-meter outlet connector as source and the fuel
 * classification (`fuel-gas` / `fuel-oil`) the network carries. Members filled by the caller (the
 * gas commit: every emitted fuel segment's two endpoint connectors + the served gas appliances'
 * fuel inlets).
 */
export function buildDefaultFuelNetworkParams(
  name: string,
  systemClassification: FuelSystemClassification,
  sourceEntityId: string,
  sourceConnectorId: string,
  members: readonly MepSystemMember[] = [],
  color?: string,
): MepFuelSystemParams {
  return {
    systemType: 'fuel-network',
    name,
    systemClassification,
    sourceEntityId,
    sourceConnectorId,
    members,
    ...(color ? { color } : {}),
  };
}
