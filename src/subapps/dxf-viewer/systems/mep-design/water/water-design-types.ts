/**
 * ADR-426 — Water-Supply Auto-Design (pilot): types (SSoT).
 *
 * Slice 1 is HEADLESS: the pipeline (Demand → Routing → Sizing) consumes the Stage 0
 * `RecognitionModel` (ADR-425) and produces a **`WaterNetworkProposal`** — pure data
 * describing the cold/hot networks that *would* be drawn. No canvas, no commit, no
 * persistence (Slice 2 turns the proposal into real `mep-segment`s + a `MepSystem`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-426-water-supply-auto-design.md
 * @see ../../recognition/index.ts (RecognitionModel input)
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { PlumbingSystemClassification } from '../../../bim/types/mep-connector-types';
import type { MepSystemMember } from '../../../bim/types/mep-system-types';

/** The two domestic-water services the pilot routes. */
export type WaterService = 'cold' | 'hot';

/** SSoT map service ↔ the pipe system classification it carries. */
export const WATER_SERVICE_CLASSIFICATION: Readonly<Record<WaterService, PlumbingSystemClassification>> = {
  cold: 'domestic-cold-water',
  hot: 'domestic-hot-water',
};

// ─── Stage 1 — Demand ─────────────────────────────────────────────────────────

/** One fixture's draw on one service: its loading units + the supply connector. */
export interface FixtureDemand {
  /** `RecognizedTerminal.elementId`. */
  readonly terminalId: string;
  readonly entityId: string;
  readonly service: WaterService;
  /** EN 806 / DIN 1988 Loading Units (Belastungswert). */
  readonly loadingUnits: number;
  /** The host supply connector id (`san-cold` / `san-hot`). */
  readonly connectorId: string;
  /** World XY of that connector (routing target), scene units. */
  readonly point: Point2D;
}

/** All per-(fixture, service) demands for a storey. */
export interface WaterDemandModel {
  readonly demands: readonly FixtureDemand[];
}

// ─── Stage 3/4 — Proposed geometry (routed + sized) ──────────────────────────

/** One axis-aligned proposed pipe run (a future `mep-segment`). */
export interface ProposedSegment {
  readonly start: Point2D;
  readonly end: Point2D;
  readonly service: WaterService;
  readonly classification: PlumbingSystemClassification;
  /** Sized from cumulative downstream LU (Stage 4). */
  readonly diameterMm: number;
  /** Cumulative LU this run carries — for transparency / the calc report. */
  readonly cumulativeLU: number;
  /** `'trunk'` (shared spine, diminishing Ø) vs `'branch'` (drop to one fixture). */
  readonly role: 'trunk' | 'branch';
}

/** A full proposed network for one service (source → fixtures). */
export interface ProposedNetwork {
  readonly service: WaterService;
  readonly classification: PlumbingSystemClassification;
  readonly sourceEntityId: string;
  readonly sourceConnectorId: string;
  readonly sourcePoint: Point2D;
  /**
   * The source outlet's world elevation (mm) — the flat datum the whole network is
   * built at (ADR-426 Slice 2). Slice 2 passes this as each segment's start/end
   * elevation so the run sits at the manifold/boiler height (Revit "Connect To"),
   * not at the default ceiling centreline.
   */
  readonly sourceElevationMm: number;
  readonly segments: readonly ProposedSegment[];
  readonly servedTerminalIds: readonly string[];
  /**
   * The fixture supply-connector members this network feeds — the `(entityId,
   * connectorId)` tuples of every served terminal's cold/hot inlet. Slice 2 turns
   * these directly into `MepSystem` members (Revit: a fixture's Cold connector is
   * on the Cold system), alongside the emitted segments' endpoint members. Carried
   * on the proposal so the commit layer needs no re-derivation from the scene.
   */
  readonly servedConnectors: readonly MepSystemMember[];
  readonly totalLU: number;
}

/** The Slice-1 deliverable: cold + hot proposals + honest warnings. */
export interface WaterNetworkProposal {
  readonly networks: readonly ProposedNetwork[];
  /** e.g. "no domestic-hot-water source recognized — hot network skipped". */
  readonly warnings: readonly string[];
  readonly storeyId: string;
}
