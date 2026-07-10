/**
 * ADR-471 — Beam reinforcement detail · SCHEDULE region builder (pure SSoT).
 *
 * Παράγει τον πίνακα ποσοτήτων χάλυβα (sheet-mm) της «ΣΤΟΙΧΕΙΑ ΟΠΛΙΣΜΟΥ» ζώνης:
 * header row + μία γραμμή ανά οικογένεια (κάτω διαμήκεις / άνω διαμήκεις / συνδετήρες),
 * γραμμή συνόλου βάρους και footer με τον λόγο εφελκυόμενου (κάτω) οπλισμού ρ. Mirror
 * του `footing-detail-schedule.ts`.
 *
 * Geometry-is-SSoT: οι ποσότητες προέρχονται από `computeBeamReinforcementQuantities`
 * (το ίδιο pure compute που τροφοδοτεί το live BOQ) — ΠΟΤΕ ξανα-υπολογισμένες εδώ.
 * Στήλες: Στοιχείο | Οπλισμός | Μήκος | Βάρος (ADR-622 shared table SSoT).
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/beam-detail-schedule
 * @see docs/centralized-systems/reference/adrs/ADR-471-unified-member-reinforcement.md §3
 */

import type { BeamEntity } from '../../types/beam-types';
import { buildBeamSectionContext } from '../section-context';
import {
  computeBeamReinforcementQuantities,
  formatBeamStirrupsLabel,
} from '../reinforcement/beam-reinforcement-compute';
import type { BeamReinforcement } from '../reinforcement/beam-reinforcement-types';
import type { BeamScheduleLabels, DetailPrimitive, RectMm } from './detail-sheet-types';
import { buildReinforcementSchedule, fmt1 } from './detail-sheet-schedule-table';

export interface BeamScheduleResult {
  readonly primitives: readonly DetailPrimitive[];
}

/** Ετικέτα διαμήκων μιας στρώσης («3Ø16»). */
function barLayerLabel(layer: BeamReinforcement['bottom']): string {
  return `${layer.count}Ø${layer.diameterMm}`;
}

/**
 * Builds the schedule-region primitives for a reinforced beam. Returns empty
 * primitives for missing reinforcement / degenerate geometry.
 */
export function buildBeamScheduleRegion(
  beam: BeamEntity,
  r: BeamReinforcement | undefined,
  region: RectMm,
  labels: BeamScheduleLabels,
): BeamScheduleResult {
  if (!r) return { primitives: [] };
  const ctx = buildBeamSectionContext(beam);
  const q = computeBeamReinforcementQuantities(ctx, r);

  const rows: string[][] = [];
  if (q.bottomWeightKg > 0) {
    rows.push([labels.bottomLongitudinal, barLayerLabel(r.bottom), fmt1(q.bottomLengthM), fmt1(q.bottomWeightKg)]);
  }
  if (q.topWeightKg > 0) {
    rows.push([labels.topLongitudinal, barLayerLabel(r.top), fmt1(q.topLengthM), fmt1(q.topWeightKg)]);
  }
  if (q.stirrupCount > 0) {
    rows.push([labels.stirrups, formatBeamStirrupsLabel(r), fmt1(q.stirrupTotalLengthM), fmt1(q.stirrupWeightKg)]);
  }

  return { primitives: buildReinforcementSchedule(region, labels, rows, fmt1(q.totalSteelWeightKg), q.ratio) };
}
