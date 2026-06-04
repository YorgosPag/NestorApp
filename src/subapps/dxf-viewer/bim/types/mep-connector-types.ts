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

/**
 * Revit plumbing/piping "System Classification" (ADR-408 Φ9). The hydraulic
 * sub-type a pipe connector — and the pipe network it joins — carries. Disjoint
 * value space from {@link ElectricalSystemClassification}; the two are kept apart
 * by the System's `systemType` discriminant (electrical-circuit vs pipe-network).
 *
 *   - `domestic-cold-water` / `domestic-hot-water` — ύδρευση κρύου / ζεστού.
 *   - `sanitary-drainage`                          — αποχέτευση (gravity, sloped).
 *   - `hydronic-supply` / `hydronic-return`        — θέρμανση προσαγωγή / επιστροφή.
 */
export type PlumbingSystemClassification =
  | 'domestic-cold-water'
  | 'domestic-hot-water'
  | 'sanitary-drainage'
  | 'hydronic-supply'
  | 'hydronic-return';

/**
 * Any MEP system classification across domains. Held only where the domain is
 * not yet narrowed; once `systemType` is known, prefer the domain-specific union.
 */
export type MepSystemClassification =
  | ElectricalSystemClassification
  | PlumbingSystemClassification;

/** Conveyed fluid for a plumbing connector/segment (drives later sizing/analysis). */
export type PipeFluid = 'water' | 'hot-water' | 'wastewater' | 'glycol' | 'other';

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

/**
 * Plumbing/piping-domain connector params (Revit Pipe Connector), present when
 * `MepConnector.domain === 'pipe'` (ADR-408 Φ9).
 */
export interface MepPipeConnectorParams {
  readonly systemClassification: PlumbingSystemClassification;
  /** mm — nominal connector diameter (matches the host segment section). */
  readonly diameterMm?: number;
  /** Conveyed fluid. */
  readonly fluid?: PipeFluid;
  /**
   * % slope along the run, signed toward `flow` (drainage convention, e.g. 1–2%).
   * Relevant for `sanitary-drainage`; absent ⇒ level run.
   */
  readonly slopePercent?: number;
  /** L/s — design flow (optional; feeds future sizing). */
  readonly flowLps?: number;
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
  /** Domain-specific payload — present when `domain === 'pipe'` (ADR-408 Φ9). */
  readonly pipe?: MepPipeConnectorParams;
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

// ─── Plumbing manifold connectors (ADR-408 Φ12) ──────────────────────────────────

/** Connector id for the single inlet (supply-in) of a plumbing manifold. */
export const MANIFOLD_INLET_CONNECTOR_ID = 'm-in';
/** Prefix for the per-index outlet connector ids of a plumbing manifold (`m-out-0`, …). */
export const MANIFOLD_OUTLET_CONNECTOR_ID_PREFIX = 'm-out-';

/**
 * Inlet connector of a plumbing manifold (ADR-408 Φ12, συλλέκτης) — the supply
 * feed. `flow: 'in'` (the network's water enters here), `domain: 'pipe'`. The
 * manifold is the distribution SOURCE: its outlet connectors feed the branches,
 * exactly as an electrical panel's power-out feeds a circuit.
 *
 * `localPosition` is host-local (scene units, pre-rotation) — the caller resolves
 * it from the bar geometry (see `buildMepManifoldConnectors`).
 */
export function buildManifoldInletConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: MANIFOLD_INLET_CONNECTOR_ID,
    domain: 'pipe',
    flow: 'in',
    localPosition,
    pipe: { systemClassification: 'domestic-cold-water', diameterMm },
  };
}

/**
 * One outlet (branch-out) connector of a plumbing manifold (ADR-408 Φ12). Pipes
 * snap to these to form the distributed water branches. `flow: 'out'`,
 * `domain: 'pipe'`. `index` (0-based) yields a host-local connectorId.
 */
export function buildManifoldOutletConnector(
  index: number,
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: `${MANIFOLD_OUTLET_CONNECTOR_ID_PREFIX}${index}`,
    domain: 'pipe',
    flow: 'out',
    localPosition,
    pipe: { systemClassification: 'domestic-cold-water', diameterMm },
  };
}

// ─── Linear segment endpoint connectors (ADR-408 Φ9) ─────────────────────────────

/** Connector id for the START endpoint of a linear duct/pipe segment. */
export const SEGMENT_START_CONNECTOR_ID = 'seg-start';
/** Connector id for the END endpoint of a linear duct/pipe segment. */
export const SEGMENT_END_CONNECTOR_ID = 'seg-end';

/**
 * The two endpoint connectors a freshly seeded linear `mep-segment` carries
 * (ADR-408 Φ9) so it can join a pipe/duct network. A segment is a conduit, not a
 * source or load → `flow: 'bidirectional'`. Carries NO `pipe` payload at seed
 * time: the **System** owns the classification (derived), exactly as the
 * electrical connector defers its circuit identity to the owning circuit.
 *
 * Unlike a point host (fixture/panel) a segment has no `position`+`rotation`; its
 * two world endpoints ARE its transform. So `localPosition` is the zero vector and
 * the world position is resolved directly from `startPoint`/`endPoint` by the
 * segment-specific resolver (see `mep-segments/` Φ9, NOT `connectorWorldPosition`).
 */
export function buildSegmentEndpointConnector(
  role: 'start' | 'end',
  domain: 'duct' | 'pipe',
): MepConnector {
  return {
    connectorId: role === 'start' ? SEGMENT_START_CONNECTOR_ID : SEGMENT_END_CONNECTOR_ID,
    domain,
    flow: 'bidirectional',
    localPosition: { x: 0, y: 0, z: 0 },
  };
}
