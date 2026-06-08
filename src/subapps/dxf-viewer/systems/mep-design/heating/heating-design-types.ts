/**
 * ADR-428 — Heating (Hydronic) Auto-Design: types (SSoT).
 *
 * Slice 1 is HEADLESS: the pipeline (Demand → Source/Sink → Routing → Sizing) consumes
 * the Stage 0 `RecognitionModel` (ADR-425) and produces a **`HeatingNetworkProposal`** —
 * pure data describing the two-pipe closed loop that *would* be drawn. No canvas, no
 * commit, no persistence (Slice 2 turns the proposal into real `mep-segment`s + two
 * `MepSystem`s — one `hydronic-supply`, one `hydronic-return`).
 *
 * The big SSoT idea: heating is a closed loop but needs NO new routing/sizing engine.
 * Both networks reuse the shared orthogonal trunk-branch router (ADR-426/§A), which emits
 * runs ROOT-OUTWARD with cumulative loading — so the root run carries Σ-of-all (large DN)
 * and a branch carries one terminal (small DN), identically for supply and return. The
 * only genuinely new things are: demand from thermal load (W → l/s), a heating terminal
 * recognizer, and a velocity-based flow → DN sizing. There is NO slope (the loop is
 * pressurised, not gravity — unlike drainage).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-428-heating-auto-design.md
 * @see ../water/water-design-types.ts (the pressurised single-source counterpart)
 * @see ../drainage/drainage-design-types.ts (the converge-to-root counterpart)
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { PlumbingSystemClassification } from '../../../bim/types/mep-connector-types';
import type { MepSystemMember } from '../../../bim/types/mep-system-types';

/** The two hydronic services of a two-pipe heating loop. */
export type HeatingNetworkRole = 'supply' | 'return';

/** SSoT map role ↔ the pipe system classification it carries. */
export const HEATING_ROLE_CLASSIFICATION: Readonly<
  Record<HeatingNetworkRole, PlumbingSystemClassification>
> = {
  supply: 'hydronic-supply',
  return: 'hydronic-return',
};

// ─── Stage 1 — Demand ─────────────────────────────────────────────────────────

/**
 * One heating terminal's draw on the loop: its design mass-flow (l/s, derived from the
 * thermal output and the design ΔΤ) plus BOTH connector endpoints — the supply inlet (the
 * routing target of the supply network) and the return outlet (the target of the return
 * network). The flow is identical on supply and return (closed-loop mass conservation).
 */
export interface TerminalHeatDemand {
  /** `RecognizedTerminal.elementId`. */
  readonly terminalId: string;
  readonly entityId: string;
  /** Host kind (`'panel-radiator'`, `'hydronic-loop'`). */
  readonly terminalKind: string;
  /** Nominal thermal output (W) used for the flow — from the host or the standard default. */
  readonly thermalOutputW: number;
  /** Design mass-flow (l/s) = Q / (ρ·c·ΔΤ). Drives the cumulative-flow sizing. */
  readonly flowLps: number;
  /** The host supply inlet connector id (`rad-supply` / `uf-supply`) + its world XY. */
  readonly supplyConnectorId: string;
  readonly supplyPoint: Point2D;
  /** The host return outlet connector id (`rad-return` / `uf-return`) + its world XY. */
  readonly returnConnectorId: string;
  readonly returnPoint: Point2D;
}

/** All per-terminal heat demands for a storey. */
export interface HeatingDemandModel {
  readonly demands: readonly TerminalHeatDemand[];
}

// ─── Stage 3/4 — Proposed geometry (routed + sized) ──────────────────────────

/** One axis-aligned proposed hydronic run (a future `mep-segment`). NO slope (closed loop). */
export interface ProposedHeatingSegment {
  readonly start: Point2D;
  readonly end: Point2D;
  /** Which side of the loop this run belongs to (supply / return). */
  readonly networkRole: HeatingNetworkRole;
  readonly classification: PlumbingSystemClassification;
  /** Sized from cumulative flow (Stage 4): large near the boiler, small at the terminal. */
  readonly diameterMm: number;
  /** Cumulative design flow (l/s) this run carries — for transparency / the calc report. */
  readonly cumulativeFlowLps: number;
  /** `'trunk'` (shared spine) vs `'branch'` (drop to one terminal). */
  readonly role: 'trunk' | 'branch';
}

/** A full proposed network for one role (boiler endpoint ⇄ terminals). */
export interface ProposedHeatingNetwork {
  readonly role: HeatingNetworkRole;
  readonly classification: PlumbingSystemClassification;
  /** The boiler endpoint that roots this network (supply outlet / return inlet). */
  readonly sourceEntityId: string;
  readonly sourceConnectorId: string;
  readonly sourcePoint: Point2D;
  /**
   * The boiler endpoint's world elevation (mm) — the flat datum the whole network is built
   * at (Revit "Connect To"). Slice 2 passes this as each segment's start/end elevation so
   * the run sits at the boiler tapping height, not the default ceiling centreline.
   */
  readonly sourceElevationMm: number;
  readonly segments: readonly ProposedHeatingSegment[];
  readonly servedTerminalIds: readonly string[];
  /**
   * The terminal connector members this network feeds/collects — the `(entityId,
   * connectorId)` tuples of every served terminal's supply inlet (supply network) or
   * return outlet (return network). Slice 2 turns these directly into `MepSystem` members
   * alongside the emitted segments' endpoint members (no scene re-derivation).
   */
  readonly servedConnectors: readonly MepSystemMember[];
  readonly totalFlowLps: number;
}

/** The Slice-1 deliverable: the supply + return networks + honest warnings. */
export interface HeatingNetworkProposal {
  readonly networks: readonly ProposedHeatingNetwork[];
  /** e.g. "no hydronic-supply source recognized — supply network skipped". */
  readonly warnings: readonly string[];
  readonly storeyId: string;
}
