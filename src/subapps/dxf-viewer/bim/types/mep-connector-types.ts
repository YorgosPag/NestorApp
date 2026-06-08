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
/** Prefix for the per-index inlet connector ids of a drainage collector (`m-in-0`, …). */
export const MANIFOLD_BRANCH_INLET_CONNECTOR_ID_PREFIX = 'm-in-';

/**
 * Inlet connector of a plumbing manifold (ADR-408 Φ12, συλλέκτης) — the supply
 * feed. `flow: 'in'` (the network's water enters here), `domain: 'pipe'`. The
 * manifold is the distribution SOURCE: its outlet connectors feed the branches,
 * exactly as an electrical panel's power-out feeds a circuit.
 *
 * `localPosition` is host-local (scene units, pre-rotation) — the caller resolves
 * it from the bar geometry (see `buildMepManifoldConnectors`).
 *
 * `classification` (Revit "System Classification") is the hydraulic type the
 * manifold distributes — `domestic-cold-water` (ύδρευση, default) … `hydronic-supply`
 * (θέρμανση). It is owned by the manifold (`MepManifoldParams.systemClassification`)
 * and threaded onto every seeded connector; the default keeps pre-Φ-heating callers
 * unchanged.
 */
export function buildManifoldInletConnector(
  localPosition: Point3D,
  diameterMm: number,
  classification: PlumbingSystemClassification = 'domestic-cold-water',
): MepConnector {
  return {
    connectorId: MANIFOLD_INLET_CONNECTOR_ID,
    domain: 'pipe',
    flow: 'in',
    localPosition,
    pipe: { systemClassification: classification, diameterMm },
  };
}

/**
 * One outlet (branch-out) connector of a plumbing manifold (ADR-408 Φ12). Pipes
 * snap to these to form the distributed water branches. `flow: 'out'`,
 * `domain: 'pipe'`. `index` (0-based) yields a host-local connectorId.
 * `classification` mirrors {@link buildManifoldInletConnector} (manifold-owned).
 */
export function buildManifoldOutletConnector(
  index: number,
  localPosition: Point3D,
  diameterMm: number,
  classification: PlumbingSystemClassification = 'domestic-cold-water',
): MepConnector {
  return {
    connectorId: `${MANIFOLD_OUTLET_CONNECTOR_ID_PREFIX}${index}`,
    domain: 'pipe',
    flow: 'out',
    localPosition,
    pipe: { systemClassification: classification, diameterMm },
  };
}

/**
 * One branch-IN connector of a drainage collector (φρεάτιο, ADR-408 Φ14). The
 * mirror of {@link buildManifoldOutletConnector}: a collector gathers N gravity
 * branches (`flow: 'in'`) into a single sewer outlet, so its many connectors are
 * inlets. `index` (0-based) yields a host-local connectorId (`m-in-0`, …).
 * `classification` defaults to `sanitary-drainage` (the collector's purpose).
 */
export function buildManifoldBranchInletConnector(
  index: number,
  localPosition: Point3D,
  diameterMm: number,
  classification: PlumbingSystemClassification = 'sanitary-drainage',
): MepConnector {
  return {
    connectorId: `${MANIFOLD_BRANCH_INLET_CONNECTOR_ID_PREFIX}${index}`,
    domain: 'pipe',
    flow: 'in',
    localPosition,
    pipe: { systemClassification: classification, diameterMm },
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

// ─── Heating radiator connectors (ADR-408 Εύρος Β #1) ─────────────────────────────

/** Connector id for the supply inlet (προσαγωγή) of a heating radiator. */
export const RADIATOR_SUPPLY_CONNECTOR_ID = 'rad-supply';
/** Connector id for the return outlet (επιστροφή) of a heating radiator. */
export const RADIATOR_RETURN_CONNECTOR_ID = 'rad-return';

/**
 * Supply inlet connector of a hydronic radiator (ADR-408 Εύρος Β, καλοριφέρ) — the
 * hot-water feed. A radiator is a heating TERMINAL (not a source): hot water enters
 * the supply inlet (`flow: 'in'`) and leaves the return outlet. `domain: 'pipe'`,
 * classification FIXED to `hydronic-supply` (a radiator's hydraulic role is set by
 * physics, not user choice — unlike a manifold which owns a configurable type).
 *
 * `localPosition` is host-local (scene units, pre-rotation) — the caller resolves it
 * from the body geometry (see `buildRadiatorConnectors`).
 */
export function buildRadiatorSupplyConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: RADIATOR_SUPPLY_CONNECTOR_ID,
    domain: 'pipe',
    flow: 'in',
    localPosition,
    pipe: { systemClassification: 'hydronic-supply', diameterMm },
  };
}

/**
 * Return outlet connector of a hydronic radiator (ADR-408 Εύρος Β). The cooled
 * water leaves here (`flow: 'out'`), `domain: 'pipe'`, classification FIXED to
 * `hydronic-return`. Together with {@link buildRadiatorSupplyConnector} the radiator
 * becomes a member of BOTH a hydronic-supply and a hydronic-return network — one
 * per connector (membership is per-(entity, connector), so no special handling).
 */
export function buildRadiatorReturnConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: RADIATOR_RETURN_CONNECTOR_ID,
    domain: 'pipe',
    flow: 'out',
    localPosition,
    pipe: { systemClassification: 'hydronic-return', diameterMm },
  };
}

// ─── Heating boiler connectors (ADR-408 Εύρος Β #2) ───────────────────────────────

/** Connector id for the supply outlet (προσαγωγή) of a heating boiler. */
export const BOILER_SUPPLY_CONNECTOR_ID = 'boiler-supply';
/** Connector id for the return inlet (επιστροφή) of a heating boiler. */
export const BOILER_RETURN_CONNECTOR_ID = 'boiler-return';
/** Connector id for the DHW hot-water outlet of a COMBI heating boiler (παραγωγή ΖΝΧ). */
export const BOILER_DHW_CONNECTOR_ID = 'boiler-dhw';

/**
 * Supply outlet connector of a hydronic boiler (ADR-408 Εύρος Β #2, λέβητας) — the
 * hot-water feed. A boiler is the heating SOURCE (opposite of a radiator terminal):
 * hot water LEAVES the supply outlet (`flow: 'out'`), so this connector SOURCES the
 * hydronic-supply network. `domain: 'pipe'`, classification FIXED to `hydronic-supply`
 * (a boiler's hydraulic role is set by physics — supply out / return in).
 *
 * `localPosition` is host-local (scene units, pre-rotation) — the caller resolves it
 * from the body geometry (see `buildBoilerConnectors`).
 */
export function buildBoilerSupplyConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: BOILER_SUPPLY_CONNECTOR_ID,
    domain: 'pipe',
    flow: 'out',
    localPosition,
    pipe: { systemClassification: 'hydronic-supply', diameterMm },
  };
}

/**
 * Return inlet connector of a hydronic boiler (ADR-408 Εύρος Β #2). The cooled water
 * RETURNS into the boiler here (`flow: 'in'`), `domain: 'pipe'`, classification FIXED
 * to `hydronic-return`. Together with {@link buildBoilerSupplyConnector} the boiler
 * sources the hydronic-supply network (supply outlet) and is a member of the
 * hydronic-return network (return inlet) — membership is per-(entity, connector).
 */
export function buildBoilerReturnConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: BOILER_RETURN_CONNECTOR_ID,
    domain: 'pipe',
    flow: 'in',
    localPosition,
    pipe: { systemClassification: 'hydronic-return', diameterMm },
  };
}

/**
 * DHW hot-water outlet connector of a COMBI heating boiler (ADR-408 Εύρος Β — combi).
 * A combi boiler heats space AND produces domestic hot water: in addition to its
 * hydronic supply/return pair it carries a SECOND `flow:'out'` outlet — heated tap
 * water LEAVES here, `domain:'pipe'`, classification FIXED to `domestic-hot-water`.
 * This is what makes the combi boiler the SOURCE of a DHW network (exactly like the
 * water heater's hot outlet, {@link buildWaterHeaterHotOutletConnector}). Only seeded
 * when `MepBoilerParams.producesDhw` is set (a plain boiler heats space only).
 *
 * Because the boiler now has TWO out-connectors of DISTINCT classification, the
 * pipe-network resolver must pick the source connector BY classification — see
 * `findPipeNetworkSourceConnectorId(source, classification)` in `pipe-network-source.ts`.
 *
 * `localPosition` is host-local (scene units, pre-rotation) — the caller resolves it
 * from the body geometry, OFFSET so it never coincides with the supply outlet
 * (see `buildBoilerConnectors`).
 */
export function buildBoilerDhwConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: BOILER_DHW_CONNECTOR_ID,
    domain: 'pipe',
    flow: 'out',
    localPosition,
    pipe: { systemClassification: 'domestic-hot-water', diameterMm },
  };
}

// ─── Domestic hot water heater connectors (ADR-408 DHW / θερμοσίφωνας) ────────────

/** Connector id for the cold-water inlet (τροφοδοσία κρύου) of a DHW water heater. */
export const WATER_HEATER_COLD_CONNECTOR_ID = 'wh-cold';
/** Connector id for the hot-water outlet (έξοδος ζεστού) of a DHW water heater. */
export const WATER_HEATER_HOT_CONNECTOR_ID = 'wh-hot';

/**
 * Cold-water inlet connector of a domestic hot water heater (ADR-408 DHW, θερμοσίφωνας).
 * Mains cold water ENTERS the heater here (`flow: 'in'`), `domain: 'pipe'`,
 * classification FIXED to `domestic-cold-water` — making the heater a MEMBER of the
 * cold-water network (its hydraulic role is set by physics — cold in / hot out).
 *
 * `localPosition` is host-local (scene units, pre-rotation) — the caller resolves it
 * from the body geometry (see `buildWaterHeaterConnectors`).
 */
export function buildWaterHeaterColdInletConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: WATER_HEATER_COLD_CONNECTOR_ID,
    domain: 'pipe',
    flow: 'in',
    localPosition,
    pipe: { systemClassification: 'domestic-cold-water', diameterMm },
  };
}

/**
 * Hot-water outlet connector of a domestic hot water heater (ADR-408 DHW). Heated water
 * LEAVES the heater here (`flow: 'out'`), `domain: 'pipe'`, classification FIXED to
 * `domestic-hot-water`. Together with {@link buildWaterHeaterColdInletConnector} the
 * heater SOURCES the domestic-hot-water network (hot outlet) and is a member of the
 * cold-water network (cold inlet) — membership is per-(entity, connector). This hot
 * outlet is the missing SOURCE that finally feeds the fixtures' hot-water inlets.
 */
export function buildWaterHeaterHotOutletConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: WATER_HEATER_HOT_CONNECTOR_ID,
    domain: 'pipe',
    flow: 'out',
    localPosition,
    pipe: { systemClassification: 'domestic-hot-water', diameterMm },
  };
}

// ─── Underfloor heating loop connectors (ADR-408 Εύρος Β #3) ──────────────────────

/** Connector id for the supply inlet (προσαγωγή) of an underfloor heating loop. */
export const UNDERFLOOR_SUPPLY_CONNECTOR_ID = 'uf-supply';
/** Connector id for the return outlet (επιστροφή) of an underfloor heating loop. */
export const UNDERFLOOR_RETURN_CONNECTOR_ID = 'uf-return';

/**
 * Supply inlet connector of an underfloor (radiant floor) heating loop (ADR-408
 * Εύρος Β #3, ενδοδαπέδια). Like the radiator the loop is a heating TERMINAL (not a
 * source): hot water enters the supply inlet (`flow: 'in'`), threads the serpentine
 * field and leaves the return outlet. `domain: 'pipe'`, classification FIXED to
 * `hydronic-supply` (physics-set, not user choice).
 *
 * UNLIKE the point-based radiator/boiler the underfloor entity is area-based with NO
 * host `position`/`rotation`; `localPosition` is therefore stored already in WORLD
 * coordinates (the computed loop-entry point) and resolved with an IDENTITY host
 * transform — the same opt-out the `mep-segment` connectors use.
 */
export function buildUnderfloorSupplyConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: UNDERFLOOR_SUPPLY_CONNECTOR_ID,
    domain: 'pipe',
    flow: 'in',
    localPosition,
    pipe: { systemClassification: 'hydronic-supply', diameterMm },
  };
}

/**
 * Return outlet connector of an underfloor heating loop (ADR-408 Εύρος Β #3). The
 * cooled water leaves here (`flow: 'out'`), `domain: 'pipe'`, classification FIXED to
 * `hydronic-return`. Together with {@link buildUnderfloorSupplyConnector} the loop
 * becomes a member of BOTH a hydronic-supply and a hydronic-return network — one per
 * connector (membership is per-(entity, connector), so no special handling), exactly
 * like the radiator. `localPosition` is in WORLD coords (identity host, see above).
 */
export function buildUnderfloorReturnConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: UNDERFLOOR_RETURN_CONNECTOR_ID,
    domain: 'pipe',
    flow: 'out',
    localPosition,
    pipe: { systemClassification: 'hydronic-return', diameterMm },
  };
}

// ─── Floor-drain connector (ADR-408 Φ14) ──────────────────────────────────────

/** Connector id for the single sanitary-drainage outlet of a floor drain (σιφώνι). */
export const FLOOR_DRAIN_CONNECTOR_ID = 'fd-drain';

/**
 * The single sanitary-drainage outlet connector of a floor drain (ADR-408 Φ14,
 * σιφώνι/στόμιο δαπέδου). Mirror of {@link buildRadiatorSupplyConnector} but a
 * floor drain is a gravity TERMINAL with exactly ONE port: floor water LEAVES the
 * drain into the sewer pipe (`flow: 'out'`, no return — unlike a radiator's
 * supply/return pair). `domain: 'pipe'`, classification FIXED to `sanitary-drainage`
 * (a floor drain's hydraulic role is set by physics, not user choice), so a pipe
 * snapped here joins the drainage network for free.
 *
 * `localPosition` is host-local (scene units, pre-rotation) — the caller resolves it
 * from the body geometry (the drain centre, z=0 at floor level).
 */
export function buildFloorDrainConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: FLOOR_DRAIN_CONNECTOR_ID,
    domain: 'pipe',
    flow: 'out',
    localPosition,
    pipe: { systemClassification: 'sanitary-drainage', diameterMm },
  };
}

// ─── Sanitary fixture drain connector (ADR-408 Φ14) ────────────────────────────

/** Connector id for the single sanitary-drainage outlet of a sanitary terminal. */
export const SANITARY_DRAIN_CONNECTOR_ID = 'san-drain';

/**
 * The single sanitary-drainage outlet of a sanitary terminal (WC/washbasin/shower/
 * bathtub/bidet — ADR-408 Φ14, Revit "Plumbing Fixture"). Identical hydraulic role
 * to {@link buildFloorDrainConnector}: a gravity TERMINAL with exactly ONE port —
 * waste water LEAVES the fixture into the drain pipe (`flow: 'out'`, no return).
 * `domain: 'pipe'`, classification FIXED to `sanitary-drainage` (set by physics,
 * not user choice), so a pipe snapped here joins the drainage network for free.
 * `diameterMm` is the fixture's DN waste size (WC=100, basin/bidet=40, shower/tub=50).
 *
 * `localPosition` is host-local (scene units, pre-rotation) — the caller resolves it
 * from the body geometry (the fixture centre, z=0 at floor level).
 */
export function buildSanitaryDrainConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: SANITARY_DRAIN_CONNECTOR_ID,
    domain: 'pipe',
    flow: 'out',
    localPosition,
    pipe: { systemClassification: 'sanitary-drainage', diameterMm },
  };
}

// ─── Sanitary fixture water-supply connectors (ADR-408 — plumbing fixture connect) ──

/** Connector id for the cold-water supply inlet of a sanitary terminal. */
export const SANITARY_COLD_CONNECTOR_ID = 'san-cold';
/** Connector id for the hot-water supply inlet of a sanitary terminal. */
export const SANITARY_HOT_CONNECTOR_ID = 'san-hot';

/**
 * Cold-water supply inlet of a sanitary terminal (Revit "Plumbing Fixture" — Domestic
 * Cold Water connector). A fixture is a water TERMINAL (load): cold water ENTERS here
 * (`flow: 'in'`), `domain: 'pipe'`, classification FIXED to `domestic-cold-water` (set
 * by physics, not user choice). A water pipe snapped here joins the cold-water network
 * for free.
 *
 * `localPosition` is host-local (scene units, pre-rotation) — the caller offsets it from
 * the fixture body so cold/hot/drain do not coincide (see `buildSanitaryFixtureConnectors`).
 */
export function buildSanitaryColdWaterConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: SANITARY_COLD_CONNECTOR_ID,
    domain: 'pipe',
    flow: 'in',
    localPosition,
    pipe: { systemClassification: 'domestic-cold-water', diameterMm },
  };
}

/**
 * Hot-water supply inlet of a sanitary terminal (Domestic Hot Water connector). Same
 * hydraulic role as {@link buildSanitaryColdWaterConnector} but classification FIXED to
 * `domestic-hot-water` — only seeded for kinds that take hot water (basin/shower/bath/
 * bidet; a WC is cold-only).
 */
export function buildSanitaryHotWaterConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: SANITARY_HOT_CONNECTOR_ID,
    domain: 'pipe',
    flow: 'in',
    localPosition,
    pipe: { systemClassification: 'domestic-hot-water', diameterMm },
  };
}
