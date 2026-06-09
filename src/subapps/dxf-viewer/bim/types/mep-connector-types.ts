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
 * Revit "Connector Domain". `electrical`, `pipe` and `duct` ship as full domains;
 * `fuel` carves out combustion-fuel conveyance (gas/oil supply lines) as its OWN
 * domain — mirror of how `duct` was carved out for the boiler flue exhaust. Fuel is
 * deliberately NOT folded into `pipe`: a gas/oil supply line is not water plumbing,
 * so it gets a disjoint classification family ({@link FuelSystemClassification}) and
 * is invisible to every water/pipe consumer (which equality-check `domain === 'pipe'`).
 */
export type MepConnectorDomain = 'electrical' | 'duct' | 'pipe' | 'fuel';

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
 *   - `fire-sprinkler`                             — πυρόσβεση (pressurised wet pipe,
 *     ADR-433). A fire-protection line is plumbing-domain (it conveys water under
 *     pressure, exactly like cold/hot supply — NOT a duct), so it lives here and rides
 *     the whole pipe network / sizing / colour machinery for free; only its own
 *     industry colour (fire-red) and design standards (NFPA 13 / EN 12845) differ.
 */
export type PlumbingSystemClassification =
  | 'domestic-cold-water'
  | 'domestic-hot-water'
  | 'sanitary-drainage'
  | 'hydronic-supply'
  | 'hydronic-return'
  | 'fire-sprinkler';

/**
 * Any MEP system classification across domains. Held only where the domain is
 * not yet narrowed; once `systemType` is known, prefer the domain-specific union.
 */
export type MepSystemClassification =
  | ElectricalSystemClassification
  | PlumbingSystemClassification
  | DuctSystemClassification
  | FuelSystemClassification;

/** Conveyed fluid for a plumbing connector/segment (drives later sizing/analysis). */
export type PipeFluid = 'water' | 'hot-water' | 'wastewater' | 'glycol' | 'other';

/**
 * Revit duct "System Classification" (ADR-408 — duct domain foundation). The
 * air/gas sub-type a duct connector — and the duct network it joins — carries.
 * Disjoint value space from {@link ElectricalSystemClassification} and
 * {@link PlumbingSystemClassification}; kept apart by the System's `systemType`
 * discriminant. The opening member is `exhaust` (combustion flue / καπναγωγός);
 * the HVAC discipline (ADR-432) appends `supply-air` / `return-air` — exactly the
 * extension this comment foretold (no type change elsewhere: the duct domain was
 * built classification-agnostic).
 *
 *   - `exhaust`     — combustion flue exhaust (καπναγωγός λέβητα, ADR-408).
 *   - `supply-air`  — προσαγωγή αέρα (AHU → στόμια, HVAC supply network, ADR-432).
 *   - `return-air`  — επιστροφή αέρα (στόμια → AHU, HVAC return network, ADR-432).
 */
export type DuctSystemClassification = 'exhaust' | 'supply-air' | 'return-air';

/**
 * Revit-style "System Classification" for the {@link MepConnectorDomain} `fuel` domain
 * (ADR-408 — fuel domain foundation). The combustion-fuel sub-type a fuel connector — and
 * the fuel supply line it joins — carries. Disjoint value space from the electrical /
 * plumbing / duct classifications; kept apart by the connector's own `domain` discriminant.
 *
 *   - `fuel-gas` — φυσικό αέριο / υγραέριο (gas supply to a gas boiler).
 *   - `fuel-oil` — πετρέλαιο θέρμανσης (oil supply to an oil boiler).
 *
 * Mirrors the boiler's `BoilerFuelType` (`gas`/`oil`) but is a SEPARATE concept: that
 * is the equipment's energy source, this is the conveyed-medium system classification.
 */
export type FuelSystemClassification = 'fuel-gas' | 'fuel-oil';

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

/**
 * Duct-domain connector params (Revit Duct/Vent Connector), present when
 * `MepConnector.domain === 'duct'` (ADR-408 — duct domain foundation). The opening
 * use is the boiler flue (καπναγωγός) carrying combustion exhaust; the params mirror
 * the minimal pipe payload — a classification + a nominal diameter.
 */
export interface MepDuctConnectorParams {
  readonly systemClassification: DuctSystemClassification;
  /** mm — nominal duct/flue diameter (typical flue DN80/100/130). */
  readonly diameterMm?: number;
}

/**
 * Fuel-domain connector params (combustion-fuel supply line), present when
 * `MepConnector.domain === 'fuel'` (ADR-408 — fuel domain foundation). The opening
 * use is the gas/oil boiler fuel inlet (τροφοδοσία καυσίμου); the params mirror the
 * minimal pipe/duct payload — a classification + a nominal diameter.
 */
export interface MepFuelConnectorParams {
  readonly systemClassification: FuelSystemClassification;
  /** mm — nominal fuel-line diameter (typical gas DN15/20/25, oil DN15). */
  readonly diameterMm?: number;
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
  /** Domain-specific payload — present when `domain === 'duct'` (ADR-408 duct foundation). */
  readonly duct?: MepDuctConnectorParams;
  /** Domain-specific payload — present when `domain === 'fuel'` (ADR-408 fuel foundation). */
  readonly fuel?: MepFuelConnectorParams;
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

/**
 * Default general-power-in connector at the host origin (ADR-430) — what a freshly
 * drawn socket (πρίζα / power outlet) carries so it can join a 16A socket circuit.
 * Identical shape to {@link buildDefaultLightingConnector} but classified `'power'`
 * (a general receptacle) instead of `'lighting'`, so the electrical-strong
 * auto-design groups it onto a socket circuit, not a lighting circuit. `flow:'in'`
 * (a socket is a load). Reuses {@link FIXTURE_POWER_CONNECTOR_ID} (host-local id).
 */
export function buildDefaultPowerConnector(): MepConnector {
  return {
    connectorId: FIXTURE_POWER_CONNECTOR_ID,
    domain: 'electrical',
    flow: 'in',
    localPosition: { x: 0, y: 0, z: 0 },
    electrical: { systemClassification: 'power' },
  };
}

/**
 * Default data-in connector at the host origin (ADR-431) — what a freshly drawn data
 * outlet (πρίζα δικτύου / RJ45) carries so it can join a structured-cabling channel.
 * Identical shape to {@link buildDefaultPowerConnector} but classified `'data'` (a
 * weak-current RJ45 keystone) instead of `'power'`, so the electrical-weak auto-design
 * homes it on a comms-rack channel, not a power circuit. `flow:'in'` (an outlet is a
 * leaf of the structured-cabling star). Reuses {@link FIXTURE_POWER_CONNECTOR_ID}.
 */
export function buildDefaultDataConnector(): MepConnector {
  return {
    connectorId: FIXTURE_POWER_CONNECTOR_ID,
    domain: 'electrical',
    flow: 'in',
    localPosition: { x: 0, y: 0, z: 0 },
    electrical: { systemClassification: 'data' },
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

/**
 * Default data-out connector at the host origin (ADR-431) — what a freshly drawn
 * comms-rack (rack / patch-panel) carries so it can be the SOURCE of a structured-
 * cabling channel. Identical shape to {@link buildDefaultPanelOutgoingConnector} but
 * classified `'data'` (weak current) instead of `'power'`, so the electrical-weak
 * source resolver homes data channels on the rack — not the power panel. `flow:'out'`
 * (the rack feeds the outlets). Reuses {@link PANEL_OUT_CONNECTOR_ID} (host-local id).
 */
export function buildDefaultCommsRackOutgoingConnector(): MepConnector {
  return {
    connectorId: PANEL_OUT_CONNECTOR_ID,
    domain: 'electrical',
    flow: 'out',
    localPosition: { x: 0, y: 0, z: 0 },
    electrical: { systemClassification: 'data' },
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
  domain: 'duct' | 'pipe' | 'fuel',
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
export const BOILER_DHW_HOT_CONNECTOR_ID = 'boiler-dhw-hot';
/** Connector id for the DHW cold-water inlet of a COMBI heating boiler (τροφοδοσία ΖΝΧ). */
export const BOILER_DHW_COLD_CONNECTOR_ID = 'boiler-dhw-cold';
/** Connector id for the DHW recirculation return inlet of a COMBI boiler (ανακυκλοφορία ΖΝΧ). */
export const BOILER_DHW_RECIRC_CONNECTOR_ID = 'boiler-dhw-recirc';
/** Connector id for the combustion flue/vent outlet of a gas/oil boiler (καπναγωγός). */
export const BOILER_FLUE_CONNECTOR_ID = 'boiler-flue';
/** Connector id for the combustion fuel supply inlet of a gas/oil boiler (τροφοδοσία καυσίμου). */
export const BOILER_FUEL_CONNECTOR_ID = 'boiler-fuel';

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
 * water heater's hot outlet, {@link buildWaterHeaterHotOutletConnector}). Paired with
 * {@link buildBoilerDhwColdInletConnector}: the combi takes cold water IN and puts hot
 * water OUT — the full Revit water path, NOT hot "from nowhere". Only seeded when
 * `MepBoilerParams.producesDhw` is set (a plain boiler heats space only).
 *
 * Because the boiler now has TWO out-connectors of DISTINCT classification, the
 * pipe-network resolver must pick the source connector BY classification — see
 * `findPipeNetworkSourceConnectorId(source, classification)` in `pipe-network-source.ts`.
 *
 * `localPosition` is host-local (scene units, pre-rotation) — the caller resolves it
 * from the body geometry, OFFSET so it never coincides with the supply outlet
 * (see `buildBoilerConnectors`).
 */
export function buildBoilerDhwHotOutletConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: BOILER_DHW_HOT_CONNECTOR_ID,
    domain: 'pipe',
    flow: 'out',
    localPosition,
    pipe: { systemClassification: 'domestic-hot-water', diameterMm },
  };
}

/**
 * DHW cold-water inlet connector of a COMBI heating boiler (ADR-408 Εύρος Β — combi).
 * Mains cold water ENTERS the combi here (`flow:'in'`), `domain:'pipe'`, classification
 * FIXED to `domestic-cold-water` — making the combi a MEMBER of the cold-water network.
 * Paired with {@link buildBoilerDhwHotOutletConnector} it completes the DHW water path
 * (cold in → heated → hot out), exactly like the water heater's cold inlet
 * ({@link buildWaterHeaterColdInletConnector}). Only seeded when `producesDhw` is set.
 *
 * `localPosition` is host-local (scene units, pre-rotation) — the caller offsets it so
 * cold/hot/supply/return do not coincide (see `buildBoilerConnectors`).
 */
export function buildBoilerDhwColdInletConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: BOILER_DHW_COLD_CONNECTOR_ID,
    domain: 'pipe',
    flow: 'in',
    localPosition,
    pipe: { systemClassification: 'domestic-cold-water', diameterMm },
  };
}

/**
 * DHW recirculation return inlet connector of a COMBI heating boiler (ADR-408 Εύρος Β —
 * combi + recirculation, Revit "Domestic Hot Water + Recirculation"). In larger/multi-storey
 * buildings the domestic hot water is kept circulating so it reaches the taps without waiting
 * (recirculation loop): the cooled hot water RETURNS into the boiler here (`flow:'in'`) and is
 * re-heated. `domain:'pipe'`, classification REUSED as `domestic-hot-water` (NOT a new union
 * member) — the recirc inlet is therefore a MEMBER of the SAME DHW network the hot outlet
 * ({@link buildBoilerDhwHotOutletConnector}) sources, closing the loop. Only seeded when the
 * boiler is a combi AND `MepBoilerParams.dhwRecirculation` is set (a plain combi has no recirc).
 *
 * `localPosition` is host-local (scene units, pre-rotation) — the caller offsets it so it never
 * coincides with the supply/return/hot/cold ports (see `buildBoilerConnectors`).
 */
export function buildBoilerDhwRecircInletConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: BOILER_DHW_RECIRC_CONNECTOR_ID,
    domain: 'pipe',
    flow: 'in',
    localPosition,
    pipe: { systemClassification: 'domestic-hot-water', diameterMm },
  };
}

/**
 * Combustion flue/vent outlet connector of a gas/oil heating boiler (ADR-408 — duct
 * domain foundation, Revit "Mechanical Equipment → Flue/Vent connector", καπναγωγός).
 * A combustion boiler burns fuel and exhausts the flue gases here: the exhaust LEAVES
 * the boiler (`flow:'out'`), `domain:'duct'` (NOT pipe — this is a gas duct, not a water
 * line), classification FIXED to `exhaust`. `localDirection` points up (z+) toward the
 * chimney, the natural Revit flue orientation. This is the FIRST `duct`-domain connector
 * — it founds the duct domain (mirror of how the pipe slice founded the pipe domain).
 *
 * Only seeded when the boiler's `fuelType` is a combustion source (`gas`/`oil`); an
 * electric boiler / heat-pump has no combustion and therefore no flue (gated in
 * `buildBoilerConnectors`). Independent of the combi/DHW gate — a plain gas boiler with
 * no DHW still vents.
 *
 * `localPosition` is host-local (scene units, pre-rotation) — the caller places it at the
 * back-centre, distinct from the supply/return/DHW ports (see `buildBoilerConnectors`).
 */
export function buildBoilerFlueConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: BOILER_FLUE_CONNECTOR_ID,
    domain: 'duct',
    flow: 'out',
    localPosition,
    localDirection: { x: 0, y: 0, z: 1 },
    duct: { systemClassification: 'exhaust', diameterMm },
  };
}

/**
 * Combustion fuel SUPPLY inlet connector of a gas/oil heating boiler (ADR-408 — fuel
 * domain foundation, Revit "Mechanical Equipment → fuel connector", τροφοδοσία καυσίμου).
 * A combustion boiler is FED its fuel here: the gas/oil ENTERS the boiler (`flow:'in'`),
 * `domain:'fuel'` (NOT pipe — fuel is not water plumbing; this founds the fuel domain,
 * mirror of how the flue founded the duct domain). The classification is the supplied
 * medium (`'fuel-gas'`/`'fuel-oil'`), set by the boiler's fuel type — this makes the
 * boiler a MEMBER of the fuel supply line, the mirror of the flue exhaust outlet.
 *
 * Only seeded when the boiler's `fuelType` is a combustion source (`gas`/`oil`); an
 * electric boiler / heat-pump takes electricity, not a piped fuel line, so it has no
 * fuel inlet (gated in `buildBoilerConnectors`). Independent of the combi/DHW and flue
 * gates — a plain gas boiler with no DHW still has both a fuel inlet and a flue outlet.
 *
 * `localPosition` is host-local (scene units, pre-rotation) — the caller places it at the
 * front-centre, distinct from the supply/return/DHW ports and the back-centre flue (see
 * `buildBoilerConnectors`). `classification` is passed in (gas vs oil) so this builder
 * stays free of any boiler-catalog import.
 */
export function buildBoilerFuelConnector(
  localPosition: Point3D,
  diameterMm: number,
  classification: FuelSystemClassification,
): MepConnector {
  return {
    connectorId: BOILER_FUEL_CONNECTOR_ID,
    domain: 'fuel',
    flow: 'in',
    localPosition,
    fuel: { systemClassification: classification, diameterMm },
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

// ─── HVAC air-terminal + AHU connectors (ADR-432 — duct-network domain) ───────────

/** Connector id for the single supply-air duct connector of an air terminal (στόμιο). */
export const AIR_TERMINAL_SUPPLY_CONNECTOR_ID = 'at-supply';
/** Connector id for the supply-air duct OUTLET of an air handling unit (ΚΚΜ). */
export const AHU_SUPPLY_CONNECTOR_ID = 'ahu-supply';

/**
 * Supply-air duct connector of an air terminal (ADR-432, στόμιο προσαγωγής / supply
 * diffuser — Revit "Air Terminal"). An air terminal is an HVAC TERMINAL (it delivers
 * conditioned air to the room): supply air ENTERS the terminal from the duct network
 * (`flow: 'in'`) and is blown into the space — exactly the hydraulic role of the
 * radiator supply inlet ({@link buildRadiatorSupplyConnector}), but `domain: 'duct'`
 * (air, not water). Classification FIXED to `supply-air` (set by physics — a supply
 * diffuser delivers supply air, not user choice). A duct snapped here joins the
 * supply-air network for free. The return-air grille (a follow-up slice) mirrors this
 * with `flow: 'out'` + `return-air`.
 *
 * `localPosition` is host-local (scene units, pre-rotation) — the caller resolves it
 * from the terminal body geometry (see the air-terminal connector seed).
 */
export function buildAirTerminalSupplyConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: AIR_TERMINAL_SUPPLY_CONNECTOR_ID,
    domain: 'duct',
    flow: 'in',
    localPosition,
    duct: { systemClassification: 'supply-air', diameterMm },
  };
}

/**
 * Supply-air duct OUTLET connector of an air handling unit (ADR-432, ΚΚΜ / AHU —
 * Revit "Mechanical Equipment → duct connector"). An AHU is the HVAC SOURCE (opposite
 * of an air terminal): conditioned supply air LEAVES the unit here (`flow: 'out'`), so
 * this connector SOURCES the supply-air network — exactly the role of the boiler supply
 * outlet ({@link buildBoilerSupplyConnector}) but `domain: 'duct'`. Classification FIXED
 * to `supply-air`. The return-air inlet (a follow-up slice) mirrors this with
 * `flow: 'in'` + `return-air`, just as the boiler return inlet mirrors its supply outlet.
 *
 * `localPosition` is host-local (scene units, pre-rotation) — the caller resolves it
 * from the AHU body geometry (see the AHU connector seed).
 */
export function buildAhuSupplyAirConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: AHU_SUPPLY_CONNECTOR_ID,
    domain: 'duct',
    flow: 'out',
    localPosition,
    duct: { systemClassification: 'supply-air', diameterMm },
  };
}

// ─── Fire-protection sprinkler + riser connectors (ADR-433 — wet pipe) ─────────────

/** Connector id for the single fire-sprinkler supply connector of a sprinkler head. */
export const SPRINKLER_SUPPLY_CONNECTOR_ID = 'spk-supply';
/** Connector id for the fire-sprinkler supply OUTLET of a fire riser (στήλη πυρόσβεσης). */
export const FIRE_RISER_SUPPLY_CONNECTOR_ID = 'fire-riser-supply';

/**
 * Fire-sprinkler supply connector of a sprinkler head (ADR-433, κεφαλή καταιονητήρα —
 * Revit "Fire Protection Terminal" / `IfcFireSuppressionTerminal`). A sprinkler is a
 * fire-protection TERMINAL: pressurised fire water ENTERS the head from the wet-pipe
 * network (`flow: 'in'`) and is discharged onto the fire — exactly the hydraulic role
 * of the sanitary cold inlet ({@link buildSanitaryColdWaterConnector}) or the radiator
 * supply inlet, but classified `fire-sprinkler`. `domain: 'pipe'` (fire water is
 * pressurised plumbing, NOT a duct), classification FIXED to `fire-sprinkler` (set by
 * physics — a sprinkler is fed fire water, not user choice). A pipe snapped here joins
 * the fire-protection network for free.
 *
 * `localPosition` is host-local (scene units, pre-rotation) — the caller resolves it
 * from the head body geometry (the head centre, ceiling-mounted).
 */
export function buildSprinklerSupplyConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: SPRINKLER_SUPPLY_CONNECTOR_ID,
    domain: 'pipe',
    flow: 'in',
    localPosition,
    pipe: { systemClassification: 'fire-sprinkler', diameterMm },
  };
}

/**
 * Fire-sprinkler supply OUTLET connector of a fire riser (ADR-433, στήλη / wet riser —
 * Revit "Fire Protection Equipment"). A fire riser is the fire-protection SOURCE
 * (opposite of a sprinkler head): pressurised fire water LEAVES the riser here
 * (`flow: 'out'`), so this connector SOURCES the fire-sprinkler network — exactly the
 * role of the boiler supply outlet ({@link buildBoilerSupplyConnector}) or the manifold
 * inlet, but classified `fire-sprinkler`. `domain: 'pipe'`, classification FIXED to
 * `fire-sprinkler`. The connector-driven source resolver finds this outlet to root the
 * wet-pipe distribution; a future standalone fire-pump entity drops in for free as long
 * as it exposes a `fire-sprinkler` pipe outlet.
 *
 * `localPosition` is host-local (scene units, pre-rotation) — the caller resolves it
 * from the riser body geometry.
 */
export function buildFireRiserSupplyConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: FIRE_RISER_SUPPLY_CONNECTOR_ID,
    domain: 'pipe',
    flow: 'out',
    localPosition,
    pipe: { systemClassification: 'fire-sprinkler', diameterMm },
  };
}

// ─── Gas supply: meter source + cooker terminal (ADR-434 — fuel network) ───────────

/** Connector id for the fuel-gas supply OUTLET of a gas meter (μετρητής αερίου). */
export const GAS_METER_OUTLET_CONNECTOR_ID = 'gas-meter-out';
/** Connector id for the single fuel-gas supply inlet of a gas cooker (εστία αερίου). */
export const GAS_COOKER_SUPPLY_CONNECTOR_ID = 'gas-cooker-supply';

/**
 * Fuel-gas supply OUTLET connector of a gas meter (ADR-434, μετρητής αερίου — Revit
 * "Mechanical Equipment → fuel connector" / `IfcFlowMeter`). A gas meter is the gas
 * network SOURCE (opposite of a gas appliance): metered gas LEAVES the meter here
 * (`flow: 'out'`), so this connector SOURCES the fuel-gas supply network — exactly the
 * role of the AHU supply-air outlet ({@link buildAhuSupplyAirConnector}) but `domain:
 * 'fuel'` (combustion fuel, not air or water). Classification FIXED to `fuel-gas`. The
 * connector-driven source resolver finds this outlet to root the gas distribution; a
 * future standalone gas-meter entity drops in for free as long as it exposes a fuel-gas
 * outlet.
 *
 * `localPosition` is host-local (scene units, pre-rotation) — the caller resolves it
 * from the meter body geometry.
 */
export function buildGasMeterOutletConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: GAS_METER_OUTLET_CONNECTOR_ID,
    domain: 'fuel',
    flow: 'out',
    localPosition,
    fuel: { systemClassification: 'fuel-gas', diameterMm },
  };
}

/**
 * Fuel-gas supply connector of a gas cooker / hob (ADR-434, εστία αερίου — Revit "Gas
 * Appliance" / `IfcBurner`). A gas cooker is a gas TERMINAL (it burns the supplied gas):
 * gas ENTERS the appliance from the fuel network (`flow: 'in'`) — exactly the hydraulic
 * role of the air-terminal supply inlet ({@link buildAirTerminalSupplyConnector}) or the
 * boiler fuel inlet ({@link buildBoilerFuelConnector}), but a standalone appliance rather
 * than a heat source. `domain: 'fuel'`, classification FIXED to `fuel-gas` (set by physics —
 * a gas hob is fed gas, not user choice). A fuel line snapped here joins the gas network for
 * free. Together with the gas-fuelled boiler (already a gas terminal via its fuel inlet) it
 * gives the recognizer two terminal kinds to feed.
 *
 * `localPosition` is host-local (scene units, pre-rotation) — the caller resolves it from the
 * cooker body geometry.
 */
export function buildGasCookerSupplyConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: GAS_COOKER_SUPPLY_CONNECTOR_ID,
    domain: 'fuel',
    flow: 'in',
    localPosition,
    fuel: { systemClassification: 'fuel-gas', diameterMm },
  };
}
