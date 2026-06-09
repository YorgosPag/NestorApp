/**
 * ADR-432 — HVAC (ventilation) Auto-Design: types (SSoT).
 *
 * Slice 1 is HEADLESS: the pipeline (Demand → Source → Routing → Duct Sizing) consumes
 * the Stage 0 `RecognitionModel` (ADR-425) and produces a **`DuctNetworkProposal`** —
 * pure data describing the supply-air duct network that *would* be drawn. No canvas, no
 * commit, no persistence (Slice 2 turns the proposal into real `mep-segment`s (domain
 * `'duct'`) + a `duct-network` `MepSystem`).
 *
 * The air analogue of `water-design-types.ts`: the medium is air (m³/h), the segment is a
 * round duct (not a pipe), the classification is `'supply-air'` (a `DuctSystemClassification`,
 * not a plumbing one). v1 routes the supply network only; return-air is a follow-up slice
 * (mirror the cold/hot or supply/return pairing of water/heating).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-432-hvac-auto-design.md
 * @see ../water/water-design-types.ts (the pressurised-pipe analogue / template)
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { DuctSystemClassification } from '../../../bim/types/mep-connector-types';
import type { MepSystemMember } from '../../../bim/types/mep-system-types';

/** The HVAC air services the engine routes. v1: supply only (return is a follow-up). */
export type AirService = 'supply';

/** SSoT map service ↔ the duct system classification it carries. */
export const AIR_SERVICE_CLASSIFICATION: Readonly<Record<AirService, DuctSystemClassification>> = {
  supply: 'supply-air',
};

// ─── Stage 1 — Demand ─────────────────────────────────────────────────────────

/** One air terminal's draw on the supply network: its design air-flow + the duct inlet. */
export interface TerminalAirDemand {
  /** `RecognizedTerminal.elementId`. */
  readonly terminalId: string;
  readonly entityId: string;
  readonly service: AirService;
  /** Design air-flow (m³/h) the terminal supplies to its space. */
  readonly airflowCmh: number;
  /** The host supply-air duct connector id (`at-supply`). */
  readonly connectorId: string;
  /** World XY of that connector (routing target), scene units. */
  readonly point: Point2D;
}

/** All per-terminal supply-air demands for a storey. */
export interface HvacDemandModel {
  readonly demands: readonly TerminalAirDemand[];
}

// ─── Stage 3/4 — Proposed geometry (routed + sized) ──────────────────────────

/** One axis-aligned proposed duct run (a future round `mep-segment`, domain 'duct'). */
export interface ProposedDuctSegment {
  readonly start: Point2D;
  readonly end: Point2D;
  readonly service: AirService;
  readonly classification: DuctSystemClassification;
  /** Round duct diameter (mm), sized from cumulative downstream air-flow (Stage 4). */
  readonly diameterMm: number;
  /** Cumulative air-flow (m³/h) this run carries — for transparency / the calc report. */
  readonly cumulativeAirflowCmh: number;
  /** `'trunk'` (shared spine, diminishing Ø) vs `'branch'` (drop to one terminal). */
  readonly role: 'trunk' | 'branch';
}

/** A full proposed duct network for one service (AHU → terminals). */
export interface ProposedDuctNetwork {
  readonly service: AirService;
  readonly classification: DuctSystemClassification;
  readonly sourceEntityId: string;
  readonly sourceConnectorId: string;
  readonly sourcePoint: Point2D;
  /** The AHU outlet's world elevation (mm) — the flat plenum datum the ducts run at. */
  readonly sourceElevationMm: number;
  readonly segments: readonly ProposedDuctSegment[];
  readonly servedTerminalIds: readonly string[];
  /** The terminal duct-inlet members this network feeds (Slice 2 → `MepSystem` members). */
  readonly servedConnectors: readonly MepSystemMember[];
  readonly totalAirflowCmh: number;
}

/** The Slice-1 deliverable: the supply-air proposal + honest warnings. */
export interface DuctNetworkProposal {
  readonly networks: readonly ProposedDuctNetwork[];
  /** e.g. "no supply-air source (AHU) recognized — supply network skipped". */
  readonly warnings: readonly string[];
  readonly storeyId: string;
}
