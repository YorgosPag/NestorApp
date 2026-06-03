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
import type { ElectricalSystemClassification } from './mep-connector-types';
import type { WireStyle } from '../mep-systems/mep-wire-routing';
import type { WireWaypointMap } from '../mep-systems/mep-wire-waypoints';

/** System type discriminator. First slice ships `electrical-circuit`. */
export type MepSystemType = 'electrical-circuit';

/** One member of a System: a specific connector on a specific component. */
export interface MepSystemMember {
  /** FK → host component entity id (panel or fixture). */
  readonly entityId: string;
  /** Host-local connector id on that component. */
  readonly connectorId: string;
}

/** User-editable SSoT params for a MEP system. */
export interface MepSystemParams {
  readonly systemType: MepSystemType;
  /** Display name, e.g. "Circuit L1-04". */
  readonly name: string;
  readonly systemClassification: ElectricalSystemClassification;
  /** Source / base equipment — the panel connector that feeds the circuit. */
  readonly sourceEntityId: string;
  readonly sourceConnectorId: string;
  /** MEMBERSHIP TRUTH — ordered list of downstream members. */
  readonly members: readonly MepSystemMember[];
  /**
   * The System **owns** its display colour (Revit "System Colour"): the hex
   * applied to every member + source when colour-by-system renders (ADR-408 Φ5).
   * SSoT truth — `MepConnector.systemId` is the membership cache, this is the
   * paint. Assigned a deterministic palette default at creation; user-editable.
   */
  readonly color?: string;
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
  /** Optional electrical rollups (derivable from member connectedLoadVa). */
  readonly ratedVoltage?: number;
  readonly poles?: 1 | 2 | 3;
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

/** Default electrical circuit params (members/source filled by the caller). */
export function buildDefaultCircuitParams(
  name: string,
  sourceEntityId: string,
  sourceConnectorId: string,
  members: readonly MepSystemMember[] = [],
  color?: string,
): MepSystemParams {
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
