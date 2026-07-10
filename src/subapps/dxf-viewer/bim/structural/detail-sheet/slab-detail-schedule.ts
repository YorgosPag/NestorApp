/**
 * ADR-476 — Slab reinforcement detail · SCHEDULE region builder (pure SSoT).
 *
 * Παράγει τον πίνακα ποσοτήτων χάλυβα (sheet-mm) της «ΣΤΟΙΧΕΙΑ ΟΠΛΙΣΜΟΥ» ζώνης:
 * header row + μία γραμμή ανά σχάρα (κάτω / άνω), γραμμή συνόλου βάρους και footer με
 * τον λόγο κύριου (κάτω) οπλισμού ρ. Mirror του `footing-detail-schedule.ts`, αλλά
 * mesh-only (η πλάκα οπλίζεται με σχάρες — μηδέν συνδετήρες).
 *
 * Geometry-is-SSoT: οι ποσότητες προέρχονται από
 * `computeSlabFoundationReinforcementQuantities` (το ίδιο pure compute που τροφοδοτεί
 * το Properties panel) — ΠΟΤΕ ξανα-υπολογισμένες εδώ. Στήλες: Στοιχείο | Οπλισμός |
 * Μήκος | Βάρος (ADR-622 shared table SSoT).
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/slab-detail-schedule
 * @see docs/centralized-systems/reference/adrs/ADR-476-unified-slab-reinforcement.md
 */

import type { SlabEntity } from '../../types/slab-types';
import { buildSlabFoundationSectionContext } from '../section-context';
import { resolveActiveSlabReinforcementForEntity } from '../active-reinforcement';
import { computeSlabFoundationReinforcementQuantities } from '../reinforcement/slab-foundation-reinforcement-compute';
import {
  formatSlabFoundationMainLabel,
  formatSlabFoundationTopLabel,
} from '../reinforcement/slab-foundation-reinforcement-types';
import type { DetailPrimitive, RectMm, SlabScheduleLabels } from './detail-sheet-types';
import { buildReinforcementSchedule, fmt1 } from './detail-sheet-schedule-table';

export interface SlabScheduleResult {
  readonly primitives: readonly DetailPrimitive[];
}

/**
 * Builds the schedule-region primitives for a reinforced slab. Returns empty
 * primitives for missing reinforcement / degenerate geometry.
 */
export function buildSlabScheduleRegion(
  slab: SlabEntity,
  region: RectMm,
  labels: SlabScheduleLabels,
): SlabScheduleResult {
  const r = resolveActiveSlabReinforcementForEntity(slab);
  if (!r) return { primitives: [] };
  const ctx = buildSlabFoundationSectionContext(slab);
  const q = computeSlabFoundationReinforcementQuantities(ctx, r);

  const rows: string[][] = [
    [labels.bottomMesh, formatSlabFoundationMainLabel(r), fmt1(q.bottomLengthM), fmt1(q.bottomWeightKg)],
  ];
  if (q.topWeightKg > 0) {
    rows.push([labels.topMesh, formatSlabFoundationTopLabel(r), fmt1(q.topLengthM), fmt1(q.topWeightKg)]);
  }

  return { primitives: buildReinforcementSchedule(region, labels, rows, fmt1(q.totalSteelWeightKg), q.ratio) };
}
