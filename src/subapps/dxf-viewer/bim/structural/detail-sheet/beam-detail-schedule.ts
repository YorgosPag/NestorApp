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
 * Στήλες: Στοιχείο | Οπλισμός | Μήκος | Βάρος.
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
import type { BeamScheduleLabels, DetailPrimitive, RectMm, TextAlign } from './detail-sheet-types';

const TOP_PAD_MM = 11;
const SIDE_PAD_MM = 4;
const ROW_H_MM = 7.5;
const TEXT_MM = 2.6;
const RULE_HEX = '#999999';
const TEXT_HEX = '#222222';
const RULE_WIDTH_MM = 0.15;

interface ColAnchors { item: number; description: number; length: number; weight: number; }
interface RowCells { item: string; description: string; length: string; weight: string; }

export interface BeamScheduleResult {
  readonly primitives: readonly DetailPrimitive[];
}

function fmt1(n: number): string {
  return n.toFixed(1);
}

function cell(x: number, rowTop: number, text: string, align: TextAlign, bold: boolean): DetailPrimitive {
  return { kind: 'text', position: { x, y: rowTop + TEXT_MM }, text, heightMm: TEXT_MM, colorHex: TEXT_HEX, align, bold };
}

function rule(x1: number, x2: number, y: number): DetailPrimitive {
  return { kind: 'line', a: { x: x1, y }, b: { x: x2, y }, stroke: { colorHex: RULE_HEX, widthMm: RULE_WIDTH_MM } };
}

function pushRow(out: DetailPrimitive[], cols: ColAnchors, rowTop: number, cells: RowCells, bold: boolean): void {
  if (cells.item) out.push(cell(cols.item, rowTop, cells.item, 'left', bold));
  if (cells.description) out.push(cell(cols.description, rowTop, cells.description, 'left', bold));
  if (cells.length) out.push(cell(cols.length, rowTop, cells.length, 'right', bold));
  if (cells.weight) out.push(cell(cols.weight, rowTop, cells.weight, 'right', bold));
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

  const cw = region.w - 2 * SIDE_PAD_MM;
  const x0 = region.x + SIDE_PAD_MM;
  const cols: ColAnchors = { item: x0, description: x0 + cw * 0.40, length: x0 + cw * 0.78, weight: x0 + cw };

  const out: DetailPrimitive[] = [];
  let y = region.y + TOP_PAD_MM;

  pushRow(out, cols, y, { item: labels.item, description: labels.description, length: labels.length, weight: labels.weight }, true);
  y += ROW_H_MM;
  out.push(rule(x0, cols.weight, y - ROW_H_MM * 0.2));

  if (q.bottomWeightKg > 0) {
    pushRow(out, cols, y, {
      item: labels.bottomLongitudinal, description: barLayerLabel(r.bottom),
      length: fmt1(q.bottomLengthM), weight: fmt1(q.bottomWeightKg),
    }, false);
    y += ROW_H_MM;
  }

  if (q.topWeightKg > 0) {
    pushRow(out, cols, y, {
      item: labels.topLongitudinal, description: barLayerLabel(r.top),
      length: fmt1(q.topLengthM), weight: fmt1(q.topWeightKg),
    }, false);
    y += ROW_H_MM;
  }

  if (q.stirrupCount > 0) {
    pushRow(out, cols, y, {
      item: labels.stirrups, description: formatBeamStirrupsLabel(r),
      length: fmt1(q.stirrupTotalLengthM), weight: fmt1(q.stirrupWeightKg),
    }, false);
    y += ROW_H_MM;
  }

  out.push(rule(x0, cols.weight, y - ROW_H_MM * 0.2));
  pushRow(out, cols, y, { item: labels.total, description: '', length: '', weight: fmt1(q.totalSteelWeightKg) }, true);
  y += ROW_H_MM * 1.5;

  out.push(cell(x0, y, `${labels.ratio} = ${(q.ratio * 100).toFixed(2)}%`, 'left', false));

  return { primitives: out };
}
