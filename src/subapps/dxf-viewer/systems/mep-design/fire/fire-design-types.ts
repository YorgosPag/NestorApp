/**
 * ADR-433 — Fire-protection (sprinkler) Auto-Design: types (SSoT).
 *
 * Slice 1 is HEADLESS: the pipeline (Demand → Source → Routing → Sizing) consumes the
 * Stage 0 `RecognitionModel` (ADR-425) and produces a **`FireNetworkProposal`** — pure
 * data describing the wet-pipe sprinkler network that *would* be drawn. No canvas, no
 * commit, no persistence (Slice 2 turns the proposal into real `mep-segment`s (domain
 * `'pipe'`) + a `pipe-network` `MepSystem`).
 *
 * A faithful pressurised-pipe mirror of `water-design-types.ts` (NOT the HVAC duct): the
 * medium is pressurised water (L/min), the segment is a round PIPE, the classification is
 * `'fire-sprinkler'` (a `PlumbingSystemClassification`) carried ON the segment — unlike a
 * duct, a fire pipe keeps its classification. v1 routes the single sprinkler service; a
 * standpipe / hose-reel service is a future addition (another service entry, never a new
 * engine).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-433-fire-protection-auto-design.md
 * @see ../water/water-design-types.ts (the pressurised-pipe analogue / template)
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { PlumbingSystemClassification } from '../../../bim/types/mep-connector-types';
import type { MepSystemMember } from '../../../bim/types/mep-system-types';

/** The fire-protection services the engine routes. v1: sprinkler (wet pipe) only. */
export type FireService = 'sprinkler';

/** SSoT map service ↔ the pipe system classification it carries. */
export const FIRE_SERVICE_CLASSIFICATION: Readonly<Record<FireService, PlumbingSystemClassification>> = {
  sprinkler: 'fire-sprinkler',
};

// ─── Stage 1 — Demand ─────────────────────────────────────────────────────────

/** One sprinkler head's draw on the wet-pipe network: its design flow + the pipe inlet. */
export interface SprinklerDemand {
  /** `RecognizedTerminal.elementId`. */
  readonly terminalId: string;
  readonly entityId: string;
  readonly service: FireService;
  /** Design discharge flow (L/min) the head delivers (NFPA 13 / EN 12845 density × area). */
  readonly flowLpm: number;
  /** The host fire-sprinkler pipe connector id (`spk-supply`). */
  readonly connectorId: string;
  /** World XY of that connector (routing target), scene units. */
  readonly point: Point2D;
}

/** All per-head sprinkler demands for a storey. */
export interface FireDemandModel {
  readonly demands: readonly SprinklerDemand[];
}

// ─── Stage 3/4 — Proposed geometry (routed + sized) ──────────────────────────

/** One axis-aligned proposed pipe run (a future round `mep-segment`, domain 'pipe'). */
export interface ProposedSegment {
  readonly start: Point2D;
  readonly end: Point2D;
  readonly service: FireService;
  readonly classification: PlumbingSystemClassification;
  /** Round pipe DN (mm), sized from cumulative downstream flow (Stage 4). */
  readonly diameterMm: number;
  /** Cumulative flow (L/min) this run carries — for transparency / the calc report. */
  readonly cumulativeFlowLpm: number;
  /** `'trunk'` (shared spine, diminishing Ø) vs `'branch'` (drop to one head). */
  readonly role: 'trunk' | 'branch';
}

/** A full proposed wet-pipe network for one service (riser → heads). */
export interface ProposedNetwork {
  readonly service: FireService;
  readonly classification: PlumbingSystemClassification;
  readonly sourceEntityId: string;
  readonly sourceConnectorId: string;
  readonly sourcePoint: Point2D;
  /** The riser outlet's world elevation (mm) — the flat datum the whole network runs at. */
  readonly sourceElevationMm: number;
  readonly segments: readonly ProposedSegment[];
  readonly servedTerminalIds: readonly string[];
  /** The head pipe-inlet members this network feeds (Slice 2 → `MepSystem` members). */
  readonly servedConnectors: readonly MepSystemMember[];
  readonly totalFlowLpm: number;
}

/** The Slice-1 deliverable: the sprinkler proposal + honest warnings. */
export interface FireNetworkProposal {
  readonly networks: readonly ProposedNetwork[];
  /** e.g. "no fire-sprinkler source (riser) recognized — sprinkler network skipped". */
  readonly warnings: readonly string[];
  readonly storeyId: string;
}
