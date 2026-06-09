/**
 * ADR-430 — Electrical-strong (ισχυρά) Auto-Design: types (SSoT).
 *
 * The electrical discipline is fundamentally different from the three pipe disciplines
 * (water / drainage / heating): its output is NOT physical `mep-segment` geometry but a
 * set of LOGICAL **circuits** (`MepSystem`s). Wiring is derived — `computeCircuitWirePaths`
 * renders the home-run polyline for free from a circuit's `source + members`, nothing is
 * persisted as geometry. So the auto-design engine produces an **`ElectricalNetworkProposal`**
 * of N `ProposedCircuit`s, and Slice 2's commit turns each into one `MepSystem` entity.
 *
 * The real "brain" here is **circuit grouping + sizing** (ΕΛΟΤ HD 384 / IEC 60364): split
 * loads by service (lighting vs sockets), bin-pack them into circuits under breaker + point
 * limits per zone, balance the circuits across phases, then size the conductor / breaker and
 * check the voltage drop. The A* router + supply/return pairing core (the pipe engine) are
 * NOT involved — they model physical conduit/cable-tray, deferred to a later slice.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-430-electrical-strong-auto-design.md
 * @see ../heating/heating-design-types.ts (the closed-loop pipe counterpart / structure template)
 */

import type { ElectricalSystemClassification } from '../../../bim/types/mep-connector-types';
import type { MepSystemMember } from '../../../bim/types/mep-system-types';
import type { PhaseLabel, TerminalDemand } from './circuit-grouping-core';

export type { PhaseLabel };

/** The two electrical-strong services auto-designed at v1 (Revit "circuit type"). */
export type ElectricalCircuitService = 'lighting' | 'power';

/** SSoT map service ↔ the electrical system classification its circuit carries. */
export const ELECTRICAL_SERVICE_CLASSIFICATION: Readonly<
  Record<ElectricalCircuitService, ElectricalSystemClassification>
> = {
  lighting: 'lighting',
  power: 'power',
};

/**
 * SSoT display colour per circuit classification — the System "colour" applied to a
 * committed circuit and its ghost wire preview (lighting amber, sockets blue), so the two
 * services read apart at a glance (Revit "System Colour").
 */
export const ELECTRICAL_CLASSIFICATION_COLOR: Readonly<
  Record<ElectricalSystemClassification, string>
> = {
  lighting: '#f59e0b',
  power: '#3b82f6',
  data: '#10b981',
  controls: '#a855f7',
};

// ─── Stage 1 — Demand ─────────────────────────────────────────────────────────

/**
 * One terminal's electrical-strong draw — the shared {@link TerminalDemand} core
 * narrowed to the strong service union. Its `load` is the design apparent power (VA).
 */
export type TerminalElectricalDemand = TerminalDemand<ElectricalCircuitService>;

/** All per-terminal electrical demands for a storey. */
export interface ElectricalDemandModel {
  readonly demands: readonly TerminalElectricalDemand[];
}

// ─── Stage 2/3 — Proposed circuit (grouped + sized) ──────────────────────────

/**
 * A proposed circuit (a future `MepSystem`): a set of member terminals fed from the
 * panel, with its grouped service, balanced phase, sized conductor/breaker and advisory
 * voltage drop. NO geometry — the wire is derived at render from `source + members`.
 */
export interface ProposedCircuit {
  readonly service: ElectricalCircuitService;
  readonly classification: ElectricalSystemClassification;
  /** The panel that sources this circuit (Revit "Power Source"). */
  readonly sourceEntityId: string;
  readonly sourceConnectorId: string;
  /** Member terminal connectors `(entityId, connectorId)` — the circuit membership truth. */
  readonly members: readonly MepSystemMember[];
  readonly memberCount: number;
  /** Σ of the members' VA — the connected load. */
  readonly connectedLoadVa: number;
  /** Protective device rating (A) from the grouping rule (lighting 10A / sockets 16A). */
  readonly breakerAmp: number;
  /** Conductor cross-section (mm²) from the grouping rule (1.5 / 2.5). */
  readonly conductorMm2: number;
  /** Balanced phase assignment (L1/L2/L3, least-loaded greedy). */
  readonly phase: PhaseLabel;
  /** Advisory voltage drop (%) at the worst member — checked against the standard's limit. */
  readonly voltageDropPercent: number;
  /** `true` when the voltage drop exceeds the service's limit (advisory warning, not a block). */
  readonly voltageDropExceeded: boolean;
  /** The Stage-0 space this circuit serves (for naming); absent ⇒ unzoned. */
  readonly spaceId?: string;
}

/** The Slice-1 deliverable: the proposed circuits + honest warnings. */
export interface ElectricalNetworkProposal {
  readonly circuits: readonly ProposedCircuit[];
  /** e.g. "no electrical panel recognized — no circuits generated". */
  readonly warnings: readonly string[];
  readonly storeyId: string;
  /** Terminals left untouched because already wired to a circuit (non-destructive). */
  readonly skippedAlreadyCircuited: number;
}
