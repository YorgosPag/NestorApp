/**
 * ADR-463 — Footing reinforcement detail · SCHEDULE region builder (pure SSoT).
 *
 * Παράγει τον πίνακα ποσοτήτων χάλυβα (sheet-mm) της «ΣΤΟΙΧΕΙΑ ΟΠΛΙΣΜΟΥ» ζώνης:
 * header row + μία γραμμή ανά οικογένεια (κύριος / δευτερεύων / συνδετήρες),
 * γραμμή συνόλου βάρους και footer με τον λόγο κύριου οπλισμού ρ. Mirror του
 * `column-detail-schedule.ts`, kind-neutral (pad/strip/tie-beam).
 *
 * Geometry-is-SSoT: οι ποσότητες προέρχονται από
 * `computeFootingReinforcementQuantities` (το ίδιο pure compute που τροφοδοτεί το
 * live BOQ) — ΠΟΤΕ ξανα-υπολογισμένες εδώ. Στήλες: Στοιχείο | Οπλισμός | Μήκος |
 * Βάρος (ADR-622 shared table SSoT).
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/footing-detail-schedule
 * @see docs/centralized-systems/reference/adrs/ADR-463-foundation-reinforcement-ux.md
 */

import type { FoundationEntity } from '../../types/foundation-types';
import { buildFootingSectionContext } from '../section-context';
import { resolveActiveFootingReinforcementForParams } from '../active-footing-reinforcement';
import {
  computeFootingReinforcementQuantities,
} from '../reinforcement/footing-reinforcement-compute';
import {
  formatMeshLabel,
  type FootingReinforcement,
} from '../reinforcement/footing-reinforcement-types';
import type { DetailPrimitive, FootingScheduleLabels, RectMm } from './detail-sheet-types';
import { buildReinforcementSchedule, fmt1 } from './detail-sheet-schedule-table';

export interface FootingScheduleResult {
  readonly primitives: readonly DetailPrimitive[];
}

/** Σύντομη ετικέτα κύριου οπλισμού ανά kind (Ø/βήμα σχάρας ή nØd ράβδων). */
function mainDescription(r: FootingReinforcement): string {
  if (r.kind === 'pad') return formatMeshLabel(r.bottomMeshX);
  if (r.kind === 'strip') return formatMeshLabel(r.transverse);
  return `${r.bottom.count}Ø${r.bottom.diameterMm}`;
}

/** Ετικέτα δευτερεύοντος οπλισμού (άνω σχάρα / διαμήκεις διανομής / άνω ράβδοι) ή null. */
function secondaryDescription(r: FootingReinforcement): string | null {
  if (r.kind === 'pad') return r.topMesh ? formatMeshLabel(r.topMesh) : null;
  if (r.kind === 'strip') return `${r.longitudinal.count}Ø${r.longitudinal.diameterMm}`;
  return `${r.top.count}Ø${r.top.diameterMm}`;
}

/** Ετικέτα συνδετήρων (strip προαιρετικοί / tie-beam πάντα) ή null. */
function stirrupDescription(r: FootingReinforcement): string | null {
  if (r.kind === 'strip') return r.stirrups ? `Ø${r.stirrups.diameterMm}/${r.stirrups.spacingMm}` : null;
  if (r.kind === 'tie-beam') return `Ø${r.stirrups.diameterMm}/${r.stirrups.spacingMm}`;
  return null;
}

/**
 * Builds the schedule-region primitives for a reinforced footing. Returns empty
 * primitives for missing reinforcement / degenerate geometry.
 */
export function buildFootingScheduleRegion(
  foundation: FoundationEntity,
  region: RectMm,
  labels: FootingScheduleLabels,
): FootingScheduleResult {
  const r = resolveActiveFootingReinforcementForParams(foundation.params);
  if (!r) return { primitives: [] };
  const ctx = buildFootingSectionContext(foundation);
  const q = computeFootingReinforcementQuantities(ctx, r);

  const rows: string[][] = [
    [labels.main, mainDescription(r), fmt1(q.mainLengthM), fmt1(q.mainWeightKg)],
  ];

  const secondary = secondaryDescription(r);
  if (secondary && q.secondaryWeightKg > 0) {
    rows.push([labels.secondary, secondary, fmt1(q.secondaryLengthM), fmt1(q.secondaryWeightKg)]);
  }

  const stirrups = stirrupDescription(r);
  if (stirrups && q.stirrupCount > 0) {
    rows.push([labels.stirrups, stirrups, fmt1(q.stirrupTotalLengthM), fmt1(q.stirrupWeightKg)]);
  }

  return { primitives: buildReinforcementSchedule(region, labels, rows, fmt1(q.totalSteelWeightKg), q.ratio) };
}
