/**
 * ADR-434 — Gas (φυσικό αέριο) Auto-Design: types (SSoT).
 *
 * Slice 1 is HEADLESS: the pipeline (Demand → Source → Routing → Sizing) consumes the
 * Stage 0 `RecognitionModel` (ADR-425) and produces a **`GasNetworkProposal`** — pure data
 * describing the fuel-gas supply network that *would* be drawn. No canvas, no commit, no
 * persistence (Slice 2 turns the proposal into real `mep-segment`s (domain `'fuel'`) + a
 * `fuel-network` `MepSystem`).
 *
 * The fuel analogue of `hvac-design-types.ts`: the medium is gas (m³/h), the segment is a
 * round fuel pipe (`domain: 'fuel'`), the classification is `'fuel-gas'` (a
 * `FuelSystemClassification`, not a plumbing/duct one). Like the duct network (and unlike a
 * pipe network) the `'fuel'` segment carries NO classification — the `fuel-network` System
 * owns it.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-434-gas-auto-design.md
 * @see ../hvac/hvac-design-types.ts (the new-system-family analogue / template)
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { FuelSystemClassification } from '../../../bim/types/mep-connector-types';
import type { MepSystemMember } from '../../../bim/types/mep-system-types';

/** The gas services the engine routes. v1: gas only (no LPG/oil distribution split yet). */
export type GasService = 'gas';

/** SSoT map service ↔ the fuel system classification it carries. */
export const GAS_SERVICE_CLASSIFICATION: Readonly<Record<GasService, FuelSystemClassification>> = {
  gas: 'fuel-gas',
};

// ─── Stage 1 — Demand ─────────────────────────────────────────────────────────

/** One gas appliance's draw on the network: its design gas flow + the fuel inlet. */
export interface TerminalGasDemand {
  /** `RecognizedTerminal.elementId`. */
  readonly terminalId: string;
  readonly entityId: string;
  readonly service: GasService;
  /** Design gas flow (m³/h) the appliance burns. */
  readonly flowCmh: number;
  /** The host fuel-gas connector id (boiler fuel inlet / cooker supply). */
  readonly connectorId: string;
  /** World XY of that connector (routing target), scene units. */
  readonly point: Point2D;
}

/** All per-appliance gas demands for a storey. */
export interface GasDemandModel {
  readonly demands: readonly TerminalGasDemand[];
}

// ─── Stage 3/4 — Proposed geometry (routed + sized) ──────────────────────────

/** One axis-aligned proposed gas run (a future round `mep-segment`, domain 'fuel'). */
export interface ProposedFuelSegment {
  readonly start: Point2D;
  readonly end: Point2D;
  readonly service: GasService;
  readonly classification: FuelSystemClassification;
  /** Round fuel-pipe diameter (mm), sized from cumulative downstream flow (Stage 4). */
  readonly diameterMm: number;
  /** Cumulative gas flow (m³/h) this run carries — for transparency / the calc report. */
  readonly cumulativeFlowCmh: number;
  /** `'trunk'` (shared spine, diminishing Ø) vs `'branch'` (drop to one appliance). */
  readonly role: 'trunk' | 'branch';
}

/** A full proposed fuel network for one service (meter → appliances). */
export interface ProposedFuelNetwork {
  readonly service: GasService;
  readonly classification: FuelSystemClassification;
  readonly sourceEntityId: string;
  readonly sourceConnectorId: string;
  readonly sourcePoint: Point2D;
  /** The meter outlet's world elevation (mm) — the flat datum the gas lines run at. */
  readonly sourceElevationMm: number;
  readonly segments: readonly ProposedFuelSegment[];
  readonly servedTerminalIds: readonly string[];
  /** The appliance fuel-inlet members this network feeds (Slice 2 → `MepSystem` members). */
  readonly servedConnectors: readonly MepSystemMember[];
  readonly totalFlowCmh: number;
}

/** The Slice-1 deliverable: the fuel-gas proposal + honest warnings. */
export interface GasNetworkProposal {
  readonly networks: readonly ProposedFuelNetwork[];
  /** e.g. "no fuel-gas source (gas meter) recognized — gas network skipped". */
  readonly warnings: readonly string[];
  readonly storeyId: string;
}
