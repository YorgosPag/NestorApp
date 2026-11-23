/**
 * @fileoverview **Π5 — a topographic diagram's PDF → the plot outline from its ΕΓΣΑ'87 coordinate table** (ADR-920 §14.11).
 * @related ./pdf-coordinate-rows (the rows) · ./plot-area-statement («Ε = …») · ./plot-outline-ranking (the ONE ranking)
 *
 * The coordinate table IS the georeference: no calibration, no click-two-points, no guessed scale — the ring is exact
 * in ΕΓΣΑ'87, the same system as the relief. What this file adds over «read the rows»:
 *
 * 🔑 **Tables are found, not assumed.** Rows group into COLUMNS by the x of their label; a column breaks where the rows
 *    stop (a gap ≫ the row spacing ⇒ another table). A long table printed in two columns side by side is joined when
 *    the right column's labels continue the left one's (no label in common) — and the parts stay candidates too, so a
 *    wrong join can never be the only option.
 * 🔑 **Two independent corroborations**, both computed from the printed coordinates and compared with what the
 *    surveyor printed: the AREA («Ε = …», tolerance from coordinate rounding) and the SIDE LENGTHS (per row, either
 *    printing convention: the side to the next corner, or from the previous one).
 * 🔑 **No table ⇒ a named answer, never a guess**: `unreadable` (scanned / broken font — nothing to read) or
 *    `no-coordinate-table` (readable, but no corner coordinates — it can still be SHOWN, it just gives no outline).
 */

import { closedRingWithArcs } from '@/lib/geometry/closed-polyline-ring';
import { isPolygonSelfIntersecting, type PlanarPoint } from '@/lib/geometry/planar-polygon';
import { hasReadableText, type PdfPositionedPage } from '@/lib/pdf/pdf-page-text';
import { normalizeGreekHomoglyphs } from '@/utils/greek-text';

import { coordinateRowsOf, pageLinesText, type CoordinateRow } from './pdf-coordinate-rows';
import { plotAreaStatementsIn } from './plot-area-statement';
import { ringAreaM2 } from './plot-outline-area';
import {
  COORDINATE_AREA_TOLERANCE_M2_PER_M,
  COORDINATE_COLUMN_X_TOLERANCE,
  COORDINATE_SIDE_TOLERANCE_M,
  COORDINATE_TABLE_GAP_FACTOR,
  COORDINATE_TABLE_MIN_ROWS,
} from './plot-outline-config';
import type { PlotOutlineCandidate, RejectedPlotOutline } from './plot-outline-types';

const MM_PER_M = 1000;

/** What the printed numbers say about the ring built from them. */
export interface CoordinateTableCorroboration {
  /** The written area closest to the ring's, m² (`null` = the page writes none). */
  readonly writtenAreaM2: number | null;
  readonly area: 'agrees' | 'disagrees' | 'absent';
  /** Sides that print a length, and how many of those agree with the coordinates. */
  readonly sidesPrinted: number;
  readonly sidesAgreeing: number;
}

export interface PdfCoordinateTable {
  readonly candidate: PlotOutlineCandidate;
  readonly corroboration: CoordinateTableCorroboration;
}

export type PdfPlotOutlineReading =
  | { readonly status: 'unreadable' }
  | { readonly status: 'no-coordinate-table' }
  | {
      readonly status: 'tables';
      readonly tables: readonly PdfCoordinateTable[];
      readonly rejected: readonly RejectedPlotOutline[];
      /** Every area the document writes, m² — feeds the ranking's `drawingAreasM2`. */
      readonly areaStatementsM2: readonly number[];
    };

// ── Tables from rows ───────────────────────────────────────────────────────────

const labelKey = (label: string): string => normalizeGreekHomoglyphs(label).trim().toUpperCase();

/** Rows grouped by the x of their label, left to right; each column top to bottom. */
function columnsOf(rows: readonly CoordinateRow[]): CoordinateRow[][] {
  const columns: { x: number; rows: CoordinateRow[] }[] = [];
  for (const row of [...rows].sort((a, b) => a.labelX - b.labelX)) {
    const column = columns.find((c) => Math.abs(c.x - row.labelX) <= COORDINATE_COLUMN_X_TOLERANCE);
    if (column) column.rows.push(row);
    else columns.push({ x: row.labelX, rows: [row] });
  }
  return columns.map((c) => c.rows.sort((a, b) => a.y - b.y));
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)];
}

/** A column split where the vertical gap is much larger than its usual row spacing (another table below). */
function segmentsOf(column: readonly CoordinateRow[]): CoordinateRow[][] {
  const gaps = column.slice(1).map((row, i) => row.y - column[i].y);
  const limit = COORDINATE_TABLE_GAP_FACTOR * median(gaps);
  const segments: CoordinateRow[][] = [[]];
  column.forEach((row, i) => {
    if (i > 0 && limit > 0 && gaps[i - 1] > limit) segments.push([]);
    segments[segments.length - 1].push(row);
  });
  return segments.filter((s) => s.length >= COORDINATE_TABLE_MIN_ROWS);
}

/** Left part + right part of one table printed in two columns: side by side, no label in common. */
function continues(left: readonly CoordinateRow[], right: readonly CoordinateRow[]): boolean {
  if (right[0].labelX <= left[0].labelX) return false;
  const overlapY = Math.min(left[left.length - 1].y, right[right.length - 1].y) >= Math.max(left[0].y, right[0].y);
  const leftLabels = new Set(left.map((r) => labelKey(r.label)));
  return overlapY && right.every((r) => !leftLabels.has(labelKey(r.label)) || labelKey(r.label) === labelKey(left[0].label));
}

/** Every table on a page: each column segment, plus joins of side-by-side segments that continue each other. */
function tablesOfRows(rows: readonly CoordinateRow[]): CoordinateRow[][] {
  const segments = columnsOf(rows).flatMap(segmentsOf);
  const joined: CoordinateRow[][] = [];
  for (let i = 0; i + 1 < segments.length; i++) {
    if (continues(segments[i], segments[i + 1])) joined.push([...segments[i], ...segments[i + 1]]);
  }
  return [...segments, ...joined];
}

// ── Corroboration ──────────────────────────────────────────────────────────────

const distanceM = (a: CoordinateRow, b: CoordinateRow): number => Math.hypot(b.eastingM - a.eastingM, b.northingM - a.northingM);

/** The printed sides that agree, under the better of the two printing conventions (to next / from previous). */
function sideAgreement(corners: readonly CoordinateRow[]): { printed: number; agreeing: number } {
  const n = corners.length;
  const printed = corners.filter((c) => c.sideM !== null).length;
  const agreeingWith = (neighbour: (i: number) => CoordinateRow): number => corners.filter((c, i) =>
    c.sideM !== null && Math.abs(distanceM(c, neighbour(i)) - c.sideM) <= COORDINATE_SIDE_TOLERANCE_M).length;
  const toNext = agreeingWith((i) => corners[(i + 1) % n]);
  const fromPrevious = agreeingWith((i) => corners[(i - 1 + n) % n]);
  return { printed, agreeing: Math.max(toNext, fromPrevious) };
}

function areaAgreement(areaM2: number, perimeterM: number, written: readonly number[]): Pick<CoordinateTableCorroboration, 'writtenAreaM2' | 'area'> {
  if (written.length === 0) return { writtenAreaM2: null, area: 'absent' };
  const closest = written.reduce((best, m2) => (Math.abs(m2 - areaM2) < Math.abs(best - areaM2) ? m2 : best));
  const agrees = Math.abs(closest - areaM2) <= perimeterM * COORDINATE_AREA_TOLERANCE_M2_PER_M;
  return { writtenAreaM2: closest, area: agrees ? 'agrees' : 'disagrees' };
}

// ── Rows → candidate ───────────────────────────────────────────────────────────

/** The corners of a table: a closing repeat of the first label/point is dropped (tables often print «Α» twice). */
function cornersOf(table: readonly CoordinateRow[]): CoordinateRow[] {
  const first = table[0];
  const last = table[table.length - 1];
  const closesOnFirst = table.length > 1
    && (labelKey(last.label) === labelKey(first.label) || (last.eastingM === first.eastingM && last.northingM === first.northingM));
  return closesOnFirst ? table.slice(0, -1) : [...table];
}

function perimeterM(corners: readonly CoordinateRow[]): number {
  return corners.reduce((sum, c, i) => sum + distanceM(c, corners[(i + 1) % corners.length]), 0);
}

type TableOutcome = { readonly table: PdfCoordinateTable } | { readonly rejected: RejectedPlotOutline };

function tableOutcome(rows: readonly CoordinateRow[], page: number, n: number, written: readonly number[]): TableOutcome | null {
  const corners = cornersOf(rows);
  const id = `pdf:${page}:${n}`;
  const origin = { source: 'pdf-table', page } as const;
  const worldCorners: PlanarPoint[] = corners.map((c) => ({ x: c.eastingM * MM_PER_M, y: c.northingM * MM_PER_M }));
  const ring = closedRingWithArcs(worldCorners, undefined);
  if (ring === null) return null; // fewer than three distinct corners — not a table of a plot
  // Self-intersection FIRST: a bow-tie's signed lobes cancel to area 0, and «zero area» would name the wrong fault.
  if (isPolygonSelfIntersecting(ring)) return { rejected: { id, origin, reason: 'self-intersecting' } };
  const areaM2 = ringAreaM2(ring);
  if (!(areaM2 > 0)) return { rejected: { id, origin, reason: 'zero-area' } };
  const candidate: PlotOutlineCandidate = {
    id, origin, ringWorldMm: ring, areaM2,
    corners: corners.map((c, i) => ({ at: worldCorners[i], label: c.label })),
  };
  const sides = sideAgreement(corners);
  const corroboration = { ...areaAgreement(areaM2, perimeterM(corners), written), sidesPrinted: sides.printed, sidesAgreeing: sides.agreeing };
  return { table: { candidate, corroboration } };
}

/**
 * Read the plot outline(s) a diagram PDF prints as coordinate tables. The pages come from `pdf-page-text` (server or
 * device — the same model). Never throws.
 */
export function readPdfPlotOutline(pages: readonly PdfPositionedPage[]): PdfPlotOutlineReading {
  const texts = pages.map(pageLinesText);
  if (!hasReadableText(texts)) return { status: 'unreadable' };
  const areaStatementsM2 = [...new Set(texts.flatMap(plotAreaStatementsIn))];
  const tables: PdfCoordinateTable[] = [];
  const rejected: RejectedPlotOutline[] = [];
  for (const page of pages) {
    tablesOfRows(coordinateRowsOf(page)).forEach((rows, n) => {
      const outcome = tableOutcome(rows, page.page, n, areaStatementsM2);
      if (outcome === null) return;
      if ('table' in outcome) tables.push(outcome.table);
      else rejected.push(outcome.rejected);
    });
  }
  if (tables.length === 0 && rejected.length === 0) return { status: 'no-coordinate-table' };
  return { status: 'tables', tables, rejected, areaStatementsM2 };
}
