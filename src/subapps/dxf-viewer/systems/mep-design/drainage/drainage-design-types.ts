/**
 * ADR-427 — Sanitary Drainage Auto-Design: types (SSoT).
 *
 * Slice 1 is HEADLESS: the pipeline (Demand → Outfall → Routing → Sizing → Slope)
 * consumes the Stage 0 `RecognitionModel` (ADR-425) and produces a
 * **`DrainageNetworkProposal`** — pure data describing the gravity drainage network
 * that *would* be drawn. No canvas, no commit, no persistence (Slice 2 turns the
 * proposal into real `mep-segment`s with `classification:'sanitary-drainage'` + slope).
 *
 * Mirrors the water proposal types (ADR-426) but for gravity flow: there is ONE service
 * (`sanitary-drainage`), the network is rooted at the **collector** (φρεάτιο, the sink —
 * not a pressurised source), diameters **grow** toward that root, and every run carries a
 * **slope** + per-endpoint elevations so flow descends to the collector.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-427-sanitary-drainage-auto-design.md
 * @see ../water/water-design-types.ts (pressurised counterpart)
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { PlumbingSystemClassification } from '../../../bim/types/mep-connector-types';
import type { MepSystemMember } from '../../../bim/types/mep-system-types';

/** Drainage is a single-classification discipline (the fixtures' sanitary-drainage outlet). */
export const DRAINAGE_CLASSIFICATION: PlumbingSystemClassification = 'sanitary-drainage';

// ─── Stage 1 — Demand ─────────────────────────────────────────────────────────

/** One fixture's discharge: its Discharge Units + the drain connector + min branch Ø. */
export interface FixtureDischarge {
  /** `RecognizedTerminal.elementId`. */
  readonly terminalId: string;
  readonly entityId: string;
  /** Host kind (`'wc'`, `'washbasin'`, …) — drives DU + min branch DN. */
  readonly terminalKind: string;
  /** EN 12056-2 Discharge Units (DU) for this fixture. */
  readonly dischargeUnits: number;
  /** The minimum nominal DN this fixture's branch must not go below (WC = 100). */
  readonly minBranchDiameterMm: number;
  /** The host drain connector id (`san-drain` / `fd-drain`). */
  readonly connectorId: string;
  /** World XY of that connector (routing target), scene units. */
  readonly point: Point2D;
}

/** All per-fixture discharges for a storey. */
export interface DrainageDemandModel {
  readonly discharges: readonly FixtureDischarge[];
}

// ─── Stage 3/4/5 — Proposed geometry (routed + sized + sloped) ───────────────

/** One axis-aligned proposed drainage run (a future sloped `mep-segment`). */
export interface ProposedDrainageSegment {
  readonly start: Point2D;
  readonly end: Point2D;
  readonly classification: PlumbingSystemClassification;
  /** Sized from cumulative downstream DU (and min branch DN); grows toward the collector. */
  readonly diameterMm: number;
  /** Cumulative DU this run carries — for transparency / the calc report. */
  readonly cumulativeDU: number;
  /** `'trunk'` (shared collector run, growing Ø) vs `'branch'` (drop from one fixture). */
  readonly role: 'trunk' | 'branch';
  /** Gravity fall (%) applied to this run (≥ the standard's min slope for its DN). */
  readonly slopePercent: number;
  /**
   * Per-endpoint world elevations (mm). `start` is the end CLOSER to the collector (lower);
   * `end` is farther (higher) — flow runs end→start, descending. Slice 2 passes these as
   * the segment's start/end z so the whole network drops monotonically into the collector.
   */
  readonly startElevationMm: number;
  readonly endElevationMm: number;
}

/** A full proposed drainage network for one collector (fixtures → collector). */
export interface ProposedDrainageNetwork {
  readonly classification: PlumbingSystemClassification;
  /** The collector (φρεάτιο, `drainage-collector` manifold) — the gravity root / sink. */
  readonly outfallEntityId: string;
  readonly outfallConnectorId: string;
  readonly outfallPoint: Point2D;
  /** The collector inlet invert (mm) — the LOWEST elevation; the whole net rises from it. */
  readonly outfallInvertElevationMm: number;
  readonly segments: readonly ProposedDrainageSegment[];
  readonly servedTerminalIds: readonly string[];
  /**
   * The fixture drain-connector members this network collects — the `(entityId,
   * connectorId)` tuples of every served terminal's sanitary-drainage outlet. Slice 2
   * turns these directly into `MepSystem` members alongside the emitted segments'
   * endpoint members (no scene re-derivation).
   */
  readonly servedConnectors: readonly MepSystemMember[];
  readonly totalDU: number;
}

/** The Slice-1 deliverable: the drainage network(s) + honest warnings. */
export interface DrainageNetworkProposal {
  readonly networks: readonly ProposedDrainageNetwork[];
  /** e.g. "no drainage-collector recognized — drainage network skipped". */
  readonly warnings: readonly string[];
  readonly storeyId: string;
}
