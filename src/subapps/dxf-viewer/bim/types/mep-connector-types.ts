/**
 * BIM MEP Connector — Type Schema (ADR-408 Φ1, MEP backbone foundation).
 *
 * A **Connector** is a typed connection point on an MEP component (Revit
 * "Connector" / IFC `IfcDistributionPort`). It is the keystone that turns a
 * placed MEP symbol into a real network member: it carries domain, flow
 * direction and domain-specific parameters (electrical voltage/poles/load).
 *
 * SSoT / ownership (ADR-408 §):
 *   - A connector is an **embedded sub-object** of its host component's params
 *     (`MepConnectorHostParams.connectors`) — NEVER a standalone entity, never
 *     a Firestore document, never an enterprise-id. (Revit: Connector ⊂ Family.)
 *   - `connectorId` is **host-local** (unique only within the component). Global
 *     identity of a connection point = the `(entityId, connectorId)` tuple — the
 *     exact granularity a `MepSystem` references for membership (see
 *     {@link MepSystemMember} in `mep-system-types.ts`).
 *   - `localPosition`/`localDirection` are in the host's own frame (same mm ×
 *     sceneUnits convention as `MepFixtureParams.position`, pre-rotation). The
 *     world position is **derived** from the host transform via
 *     {@link connectorWorldPosition} — no connector geometry is ever persisted.
 *   - `systemId` is a **derived cache** of the owning System back-reference. The
 *     System's member list is the truth; `systemId` is reconciled System→connector
 *     (see `mep-system-coordinator.ts`). A stale `systemId` is harmless.
 *
 * First slice ships the **electrical** domain only; `duct`/`pipe` are reserved
 * in the union (mirror of ADR-405 reserving disciplines with empty categories).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { Point3D } from './bim-base';

// ─── Domain + flow ───────────────────────────────────────────────────────────

/**
 * Revit "Connector Domain". The opening slice ships `electrical`; `duct`/`pipe`
 * are reserved so HVAC/plumbing connectors extend without a type change.
 */
export type MepConnectorDomain = 'electrical' | 'duct' | 'pipe';

/** Revit flow direction on a connector. */
export type MepFlowDirection = 'in' | 'out' | 'bidirectional';

/**
 * Revit electrical "System Classification" — the electrical sub-type a connector
 * (and the System it joins) carries.
 */
export type ElectricalSystemClassification = 'power' | 'lighting' | 'data' | 'controls';

// ─── Domain-specific params ───────────────────────────────────────────────────

/** Electrical-domain connector params (Revit Electrical Connector). */
export interface MepElectricalConnectorParams {
  readonly systemClassification: ElectricalSystemClassification;
  /** V — nominal voltage. */
  readonly voltage?: number;
  readonly poles?: 1 | 2 | 3;
  /** VA — apparent connected load; a circuit source sums member loads. */
  readonly connectedLoadVa?: number;
  readonly numberOfPhases?: 1 | 3;
}

// ─── Connector ────────────────────────────────────────────────────────────────

/**
 * A typed connection point on an MEP component, embedded in the host params.
 * LOCAL to the host: `localPosition`/`localDirection` are in the host frame
 * (pre-rotation). Resolve world coords with {@link connectorWorldPosition}.
 */
export interface MepConnector {
  /** Stable id, unique within the host component only (e.g. `'c1'`). */
  readonly connectorId: string;
  readonly domain: MepConnectorDomain;
  readonly flow: MepFlowDirection;
  /** Offset from the host origin, host-local frame (mm × sceneUnits, pre-rotation). */
  readonly localPosition: Point3D;
  /** Unit direction the connector faces, host-local frame. Optional for point loads. */
  readonly localDirection?: Point3D;
  /** Domain-specific payload — present when `domain === 'electrical'`. */
  readonly electrical?: MepElectricalConnectorParams;
  /**
   * Derived back-reference to the owning System — NOT truth (see file header).
   * Reconciled System→connector; absent = unassigned.
   */
  readonly systemId?: string;
}

// ─── World-position derivation (pure SSoT) ─────────────────────────────────────

const DEG_TO_RAD = Math.PI / 180;

/**
 * Resolve a connector's world position from the host transform. Mirrors
 * `transformFootprint` in `mep-fixture-geometry.ts`: rotate the host-local
 * offset by `hostRotationDeg` (CCW about the host origin), then translate to
 * `hostPosition`. Pure; persists nothing — the connector moves/rotates with the
 * host for free, exactly like the host footprint.
 *
 * `z` adds the host elevation to the local `z` offset (default 0).
 */
export function connectorWorldPosition(
  connector: MepConnector,
  hostPosition: Point3D,
  hostRotationDeg: number,
): Point3D {
  const { x, y, z = 0 } = connector.localPosition;
  const a = hostRotationDeg * DEG_TO_RAD;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return {
    x: hostPosition.x + (x * cos - y * sin),
    y: hostPosition.y + (x * sin + y * cos),
    z: (hostPosition.z ?? 0) + z,
  };
}

// ─── Defaults ──────────────────────────────────────────────────────────────────

/** Connector id used for the single power-in connector of a light fixture. */
export const FIXTURE_POWER_CONNECTOR_ID = 'c1';

/**
 * Default lighting power-in connector at the host origin — what a freshly drawn
 * light fixture carries so it can join a lighting circuit. `flow:'in'` (a
 * fixture is a load), classification `lighting`.
 */
export function buildDefaultLightingConnector(): MepConnector {
  return {
    connectorId: FIXTURE_POWER_CONNECTOR_ID,
    domain: 'electrical',
    flow: 'in',
    localPosition: { x: 0, y: 0, z: 0 },
    electrical: { systemClassification: 'lighting' },
  };
}

/** Connector id used for the single power-out connector of an electrical panel. */
export const PANEL_OUT_CONNECTOR_ID = 'c1';

/**
 * Default power-out connector at the host origin — what a freshly drawn
 * electrical panel (ADR-408 Φ3) carries so it can be the SOURCE of a circuit.
 * `flow:'out'` (a panel feeds loads), classification `power`.
 */
export function buildDefaultPanelOutgoingConnector(): MepConnector {
  return {
    connectorId: PANEL_OUT_CONNECTOR_ID,
    domain: 'electrical',
    flow: 'out',
    localPosition: { x: 0, y: 0, z: 0 },
    electrical: { systemClassification: 'power' },
  };
}
