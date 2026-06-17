/**
 * ADR-473 — Joint reinforcement BOQ quantities (Workstream B).
 *
 * Pure computation: OrganismContinuityResult → per-item rows + summary.
 * Each row = one `ReinforcementContinuityItem` (one edge/joint-type pair) with
 * its total length and weight in kg. Revit-grade: every dowel/lap/anchorage
 * is a DISCRETE steel item (BS 8666 / Rebar Schedule convention).
 *
 * **No double-counting**: joint items are separate from per-member development
 * lengths. Callers must NOT add joint weight on top of compute functions that
 * already include development (use `continuity` param in those functions instead).
 *
 * PURE — zero React / Firestore / store imports. Unit-testable in isolation.
 *
 * @see ./reinforcement-continuity.ts — the continuity model (math SSoT)
 * @see ../rebar-catalog.ts — barMassPerMeterKg (weight SSoT)
 */

import type { ContinuityKind, OrganismContinuityResult, ReinforcementContinuityItem } from './reinforcement-continuity';
import { barMassPerMeterKg } from '../rebar-catalog';

// ─── Output types ──────────────────────────────────────────────────────────────

/**
 * One joint reinforcement item for the BOQ schedule.
 * `totalLengthM` = count × lengthMm × 0.001.
 * `weightKg` = totalLengthM × barMassPerMeterKg(diameterMm).
 */
export interface JointReinforcementRow {
  /** Back-ref: stable edge id `${supportId}->${supportedId}:${kind}`. */
  readonly edgeId: string;
  readonly kind: ContinuityKind;
  /** «From» member entity id (column for dowels/laps, beam for anchorage). */
  readonly fromEntityId: string;
  /** «To» member entity id (footing for dowels, column for anchorage, upper-col for laps). */
  readonly toEntityId: string;
  readonly count: number;
  readonly diameterMm: number;
  /** Length per individual bar (mm). */
  readonly lengthMm: number;
  /** Total length of all bars in this joint item (m). */
  readonly totalLengthM: number;
  /** Total steel weight for this joint item (kg). */
  readonly weightKg: number;
}

/**
 * Aggregate BOQ summary across all joint items.
 * `byKind` lets the UI show separate subtotals for dowels / laps / anchorages.
 */
export interface JointReinforcementSummary {
  readonly totalWeightKg: number;
  /** Weight per continuity kind (dowel / lap / anchorage). */
  readonly byKind: ReadonlyMap<ContinuityKind, number>;
}

/** Full result: rows (one per edge) + aggregate summary. */
export interface JointReinforcementQuantities {
  readonly rows: readonly JointReinforcementRow[];
  readonly summary: JointReinforcementSummary;
}

// ─── Computation ───────────────────────────────────────────────────────────────

function rowFromItem(item: ReinforcementContinuityItem): JointReinforcementRow {
  const totalLengthM = item.count * item.lengthMm * 0.001;
  const weightKg = totalLengthM * barMassPerMeterKg(item.diameterMm);
  return {
    edgeId: item.edgeId,
    kind: item.kind,
    fromEntityId: item.fromMemberId,
    toEntityId: item.toMemberId,
    count: item.count,
    diameterMm: item.diameterMm,
    lengthMm: item.lengthMm,
    totalLengthM,
    weightKg,
  };
}

/**
 * Computes BOQ quantities for all joint reinforcement items in the organism.
 *
 * Input: `OrganismContinuityResult` from `computeOrganismReinforcementContinuity`.
 * Returns discrete rows (one per graph edge/joint-type) + aggregate summary.
 * Pure — call at any level (schedule builder, PDF export, UI panel).
 */
export function computeJointReinforcementQuantities(
  continuity: OrganismContinuityResult,
): JointReinforcementQuantities {
  const rows = continuity.items.map(rowFromItem);

  const byKind = new Map<ContinuityKind, number>();
  let totalWeightKg = 0;

  for (const row of rows) {
    byKind.set(row.kind, (byKind.get(row.kind) ?? 0) + row.weightKg);
    totalWeightKg += row.weightKg;
  }

  return { rows, summary: { totalWeightKg, byKind } };
}
