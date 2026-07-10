/**
 * detail-sheet-schedule-table — SSoT for the reinforcement steel take-off table
 * ("ΣΤΟΙΧΕΙΑ ΟΠΛΙΣΜΟΥ" region) shared by every structural detail sheet.
 *
 * ADR-622 — the beam / column / footing / slab schedule builders all hand-rolled
 * the SAME table skeleton (padding/row/text/rule constants, the `cell` / `rule` /
 * `pushRow` primitives, and the header-rule → data rows → total-rule → total →
 * footer layout), differing ONLY in the column set and which formatted rows they
 * emit. This module owns the layout; each `build*ScheduleRegion` now resolves its
 * reinforcement + quantities (unchanged), formats its rows, and calls
 * {@link buildScheduleTable}. All `build*ScheduleRegion` signatures + Result types
 * are preserved.
 *
 * @see ADR-457/463/471/476 — the per-member reinforcement detail sheets
 */

import type { DetailPrimitive, RectMm, TextAlign } from './detail-sheet-types';

const TOP_PAD_MM = 11; // clears the region heading
const SIDE_PAD_MM = 4;
const ROW_H_MM = 7.5;
const TEXT_MM = 2.6;
const RULE_HEX = '#999999';
const TEXT_HEX = '#222222';
const RULE_WIDTH_MM = 0.15;

/** One decimal place — shared number format for schedule lengths (m) and weights (kg). */
export function fmt1(n: number): string {
  return n.toFixed(1);
}

/** A schedule column: x-anchor as a fraction of the content width (0 = left, 1 = right) + text alignment. */
export interface ScheduleColumn {
  readonly frac: number;
  readonly align: TextAlign;
}

/**
 * Στοιχείο | Οπλισμός | Μήκος | Βάρος — the shared 4-column reinforcement schedule
 * layout (beam / footing / slab). Description is left-aligned, the two numeric
 * columns right-aligned. Columns roll their own set (5-column mark/Ø/n/L/W).
 */
export const REINFORCEMENT_SCHEDULE_COLUMNS: readonly ScheduleColumn[] = [
  { frac: 0, align: 'left' },
  { frac: 0.4, align: 'left' },
  { frac: 0.78, align: 'right' },
  { frac: 1, align: 'right' },
];

/** A fully-specified schedule table (all cells already formatted; empty strings are skipped). */
export interface ScheduleTableSpec {
  readonly region: RectMm;
  readonly columns: readonly ScheduleColumn[];
  /** Bold header cells (one per column). */
  readonly header: readonly string[];
  /** Data rows (each a cell array per column) — callers filter zero-weight families out. */
  readonly rows: readonly (readonly string[])[];
  /** Bold total row (one per column; empty cells omitted). */
  readonly total: readonly string[];
  /** Left-aligned footer lines below the total (ratio ρ, confinement α, …). */
  readonly footers?: readonly string[];
}

/** A text primitive whose baseline sits `TEXT_MM` below the row top. */
function cell(x: number, rowTop: number, text: string, align: TextAlign, bold: boolean): DetailPrimitive {
  return { kind: 'text', position: { x, y: rowTop + TEXT_MM }, text, heightMm: TEXT_MM, colorHex: TEXT_HEX, align, bold };
}

/** A faint horizontal rule spanning the table width. */
function rule(x1: number, x2: number, y: number): DetailPrimitive {
  return { kind: 'line', a: { x: x1, y }, b: { x: x2, y }, stroke: { colorHex: RULE_HEX, widthMm: RULE_WIDTH_MM } };
}

/** Append one table row — a cell per non-empty string at its column anchor + alignment. */
function pushRow(
  out: DetailPrimitive[],
  xs: readonly number[],
  columns: readonly ScheduleColumn[],
  rowTop: number,
  cells: readonly string[],
  bold: boolean,
): void {
  for (let i = 0; i < columns.length; i++) {
    const text = cells[i];
    if (text) out.push(cell(xs[i], rowTop, text, columns[i].align, bold));
  }
}

/**
 * Emit the steel-schedule primitives (sheet-mm): header row + underline, one line
 * per data row, a pre-total rule + total row, then the footer lines. The layout is
 * identical across members; only `columns` / `rows` / `footers` vary.
 */
export function buildScheduleTable(spec: ScheduleTableSpec): DetailPrimitive[] {
  const { region, columns } = spec;
  const cw = region.w - 2 * SIDE_PAD_MM;
  const x0 = region.x + SIDE_PAD_MM;
  const xs = columns.map((c) => x0 + cw * c.frac);
  const ruleRight = xs[xs.length - 1];

  const out: DetailPrimitive[] = [];
  let y = region.y + TOP_PAD_MM;

  pushRow(out, xs, columns, y, spec.header, true);
  y += ROW_H_MM;
  out.push(rule(x0, ruleRight, y - ROW_H_MM * 0.2));

  for (const row of spec.rows) {
    pushRow(out, xs, columns, y, row, false);
    y += ROW_H_MM;
  }

  out.push(rule(x0, ruleRight, y - ROW_H_MM * 0.2));
  pushRow(out, xs, columns, y, spec.total, true);
  y += ROW_H_MM * 1.5;

  for (const footer of spec.footers ?? []) {
    out.push(cell(x0, y, footer, 'left', false));
    y += ROW_H_MM;
  }

  return out;
}

/** The six header/total/ratio labels shared by the 4-column reinforcement schedules. */
export interface ReinforcementScheduleLabels {
  readonly item: string;
  readonly description: string;
  readonly length: string;
  readonly weight: string;
  readonly total: string;
  readonly ratio: string;
}

/**
 * Convenience wrapper for the 4-column «Στοιχείο | Οπλισμός | Μήκος | Βάρος»
 * reinforcement schedule (beam / footing / slab): header from `labels`, the given
 * pre-formatted data `rows`, a bold total-weight row, and the ratio ρ footer. Only
 * the rows vary per member; column keeps the 5-column {@link buildScheduleTable}.
 */
export function buildReinforcementSchedule(
  region: RectMm,
  labels: ReinforcementScheduleLabels,
  rows: readonly (readonly string[])[],
  totalWeight: string,
  ratio: number,
): DetailPrimitive[] {
  return buildScheduleTable({
    region,
    columns: REINFORCEMENT_SCHEDULE_COLUMNS,
    header: [labels.item, labels.description, labels.length, labels.weight],
    rows,
    total: [labels.total, '', '', totalWeight],
    footers: [`${labels.ratio} = ${(ratio * 100).toFixed(2)}%`],
  });
}
