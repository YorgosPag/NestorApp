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
 * live BOQ) — ΠΟΤΕ ξανα-υπολογισμένες εδώ. Στήλες: Στοιχείο | Οπλισμός | Μήκος | Βάρος.
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
import type { DetailPrimitive, FootingScheduleLabels, RectMm, TextAlign } from './detail-sheet-types';

const TOP_PAD_MM = 11;
const SIDE_PAD_MM = 4;
const ROW_H_MM = 7.5;
const TEXT_MM = 2.6;
const RULE_HEX = '#999999';
const TEXT_HEX = '#222222';
const RULE_WIDTH_MM = 0.15;

interface ColAnchors { item: number; description: number; length: number; weight: number; }
interface RowCells { item: string; description: string; length: string; weight: string; }

export interface FootingScheduleResult {
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

  const cw = region.w - 2 * SIDE_PAD_MM;
  const x0 = region.x + SIDE_PAD_MM;
  const cols: ColAnchors = { item: x0, description: x0 + cw * 0.40, length: x0 + cw * 0.78, weight: x0 + cw };

  const out: DetailPrimitive[] = [];
  let y = region.y + TOP_PAD_MM;

  pushRow(out, cols, y, { item: labels.item, description: labels.description, length: labels.length, weight: labels.weight }, true);
  y += ROW_H_MM;
  out.push(rule(x0, cols.weight, y - ROW_H_MM * 0.2));

  pushRow(out, cols, y, {
    item: labels.main, description: mainDescription(r),
    length: fmt1(q.mainLengthM), weight: fmt1(q.mainWeightKg),
  }, false);
  y += ROW_H_MM;

  const secondary = secondaryDescription(r);
  if (secondary && q.secondaryWeightKg > 0) {
    pushRow(out, cols, y, {
      item: labels.secondary, description: secondary,
      length: fmt1(q.secondaryLengthM), weight: fmt1(q.secondaryWeightKg),
    }, false);
    y += ROW_H_MM;
  }

  const stirrups = stirrupDescription(r);
  if (stirrups && q.stirrupCount > 0) {
    pushRow(out, cols, y, {
      item: labels.stirrups, description: stirrups,
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
