/**
 * ADR-457 — Column reinforcement detail · SCHEDULE region builder (pure SSoT).
 *
 * Produces the steel take-off table primitives (sheet-mm) for the «ΣΤΟΙΧΕΙΑ
 * ΟΠΛΙΣΜΟΥ» region: a Revit/Tekla-style schedule with a header row, one row per
 * reinforcement family (longitudinal + stirrups/spiral), a total-weight row and
 * a footer with the longitudinal ratio ρ and the confinement factor α.
 *
 * Geometry-is-SSoT: the quantities come straight from
 * `computeColumnReinforcementQuantities` / `computeColumnConfinement` (the same
 * pure compute that drives the live BOQ) — never re-derived here. The table is
 * laid out purely with `text` + `line` primitives (no new primitive kind).
 *
 * v1: rectangular column with `reinforcement`. Other kinds → empty.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/column-detail-schedule
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import type { ColumnParams } from '../../types/column-types';
import type { ColumnSectionContext } from '../codes/structural-code-types';
import { computeColumnReinforcementQuantities } from '../reinforcement/column-reinforcement-compute';
import { computeColumnConfinement } from '../reinforcement/column-confinement';
import { DEFAULT_STIRRUP_TYPE } from '../reinforcement/column-reinforcement-types';
import type { DetailPrimitive, DetailScheduleLabels, RectMm, TextAlign } from './detail-sheet-types';

const TOP_PAD_MM = 11;       // clears the region heading
const SIDE_PAD_MM = 4;
const ROW_H_MM = 7.5;
const TEXT_MM = 2.6;
const RULE_HEX = '#999999';
const TEXT_HEX = '#222222';
const RULE_WIDTH_MM = 0.15;

/** Column anchor x-positions (sheet-mm): mark is left-aligned, the rest right. */
interface ColAnchors { mark: number; diameter: number; count: number; length: number; weight: number; }

/** One schedule row's five cell strings (empty cells are skipped). */
interface RowCells { mark: string; diameter: string; count: string; length: string; weight: string; }

export interface ColumnScheduleResult {
  readonly primitives: readonly DetailPrimitive[];
}

/** One decimal place — lengths (m) and weights (kg) on the steel schedule. */
function fmt1(n: number): string {
  return n.toFixed(1);
}

/** A text primitive whose baseline sits `TEXT_MM` below the row top. */
function cell(x: number, rowTop: number, text: string, align: TextAlign, bold: boolean): DetailPrimitive {
  return {
    kind: 'text',
    position: { x, y: rowTop + TEXT_MM },
    text, heightMm: TEXT_MM, colorHex: TEXT_HEX, align, bold,
  };
}

/** A faint horizontal rule spanning the table width. */
function rule(x1: number, x2: number, y: number): DetailPrimitive {
  return { kind: 'line', a: { x: x1, y }, b: { x: x2, y }, stroke: { colorHex: RULE_HEX, widthMm: RULE_WIDTH_MM } };
}

/** Appends a full table row (mark left, the four numeric cells right-aligned). */
function pushRow(out: DetailPrimitive[], cols: ColAnchors, rowTop: number, cells: RowCells, bold: boolean): void {
  if (cells.mark) out.push(cell(cols.mark, rowTop, cells.mark, 'left', bold));
  if (cells.diameter) out.push(cell(cols.diameter, rowTop, cells.diameter, 'right', bold));
  if (cells.count) out.push(cell(cols.count, rowTop, cells.count, 'right', bold));
  if (cells.length) out.push(cell(cols.length, rowTop, cells.length, 'right', bold));
  if (cells.weight) out.push(cell(cols.weight, rowTop, cells.weight, 'right', bold));
}

/**
 * Builds the schedule-region primitives for a rectangular reinforced column.
 * Returns empty primitives for unsupported kinds / missing reinforcement.
 */
export function buildColumnScheduleRegion(
  params: ColumnParams,
  region: RectMm,
  labels: DetailScheduleLabels,
): ColumnScheduleResult {
  const r = params.reinforcement;
  if (params.kind !== 'rectangular' || !r) return { primitives: [] };
  if (params.width <= 0 || params.depth <= 0 || params.height <= 0) return { primitives: [] };

  const ctx: ColumnSectionContext = {
    widthMm: params.width, depthMm: params.depth, heightMm: params.height,
    grossAreaMm2: params.width * params.depth,
  };
  const q = computeColumnReinforcementQuantities(ctx, r);
  const conf = computeColumnConfinement(ctx, r);
  const isSpiral = (r.stirrups.type ?? DEFAULT_STIRRUP_TYPE) === 'spiral';

  const cw = region.w - 2 * SIDE_PAD_MM;
  const x0 = region.x + SIDE_PAD_MM;
  const cols: ColAnchors = {
    mark: x0,
    diameter: x0 + cw * 0.52,
    count: x0 + cw * 0.68,
    length: x0 + cw * 0.84,
    weight: x0 + cw,
  };

  const out: DetailPrimitive[] = [];
  let y = region.y + TOP_PAD_MM;

  pushRow(out, cols, y, {
    mark: labels.mark, diameter: labels.diameter, count: labels.count,
    length: labels.length, weight: labels.weight,
  }, true);
  y += ROW_H_MM;
  out.push(rule(x0, cols.weight, y - ROW_H_MM * 0.2));

  pushRow(out, cols, y, {
    mark: labels.longitudinal, diameter: `Ø${r.longitudinal.diameterMm}`, count: String(r.longitudinal.count),
    length: fmt1(q.longitudinalLengthM), weight: fmt1(q.longitudinalWeightKg),
  }, false);
  y += ROW_H_MM;

  pushRow(out, cols, y, {
    mark: isSpiral ? labels.spiral : labels.stirrups, diameter: `Ø${r.stirrups.diameterMm}`,
    count: String(q.stirrupCount), length: fmt1(q.stirrupTotalLengthM), weight: fmt1(q.stirrupWeightKg),
  }, false);
  y += ROW_H_MM;
  out.push(rule(x0, cols.weight, y - ROW_H_MM * 0.2));

  pushRow(out, cols, y, {
    mark: labels.total, diameter: '', count: '', length: '', weight: fmt1(q.totalSteelWeightKg),
  }, true);
  y += ROW_H_MM * 1.5;

  out.push(cell(x0, y, `${labels.ratio} = ${(q.ratio * 100).toFixed(2)}%`, 'left', false));
  y += ROW_H_MM;
  out.push(cell(x0, y, `${labels.confinement} = ${conf.alpha.toFixed(2)}`, 'left', false));

  return { primitives: out };
}
