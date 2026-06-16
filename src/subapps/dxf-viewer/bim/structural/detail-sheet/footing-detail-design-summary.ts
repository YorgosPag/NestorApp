/**
 * ADR-464 Slice 5 — Footing detail · DESIGN-SUMMARY region builder (pure SSoT).
 *
 * Παράγει τον πίνακα «ΕΛΕΓΧΟΙ ΣΧΕΔΙΑΣΜΟΥ» (sheet-mm): μία γραμμή ανά έλεγχο
 * (έδραση / διάτρηση / τέμνουσα) με απαίτηση, αντοχή, αξιοποίηση και ένδειξη
 * επάρκειας· footer για κάμψη (αν απαιτείται άνω σχάρα — hogging). Mirror του
 * `footing-detail-schedule.ts` (ίδια στοιχειοθεσία/primitives). Geometry-is-SSoT:
 * οι τιμές προέρχονται από το ίδιο `FootingDesignResult` (DERIVED) που τροφοδοτεί
 * τα live διαγνωστικά — ΠΟΤΕ ξανα-υπολογισμένες εδώ.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/footing-detail-design-summary
 * @see ./footing-detail-schedule.ts — το mirror layout
 * @see ../footing-design/footing-design-types.ts — FootingDesignResult
 * @see docs/centralized-systems/reference/adrs/ADR-464-advanced-footing-reinforcement.md
 */

import type { FootingDesignResult } from '../footing-design/footing-design-types';
import type {
  DetailPrimitive,
  FootingDesignSummaryLabels,
  RectMm,
  TextAlign,
} from './detail-sheet-types';

const TOP_PAD_MM = 11;
const SIDE_PAD_MM = 4;
const ROW_H_MM = 7.5;
const TEXT_MM = 2.6;
const RULE_HEX = '#999999';
const TEXT_HEX = '#222222';
const FAIL_HEX = '#b00020';
const OK_HEX = '#2e7d32';
const RULE_WIDTH_MM = 0.15;

interface ColAnchors { check: number; demand: number; capacity: number; util: number; }
interface SummaryRow {
  readonly label: string;
  readonly demand: string;
  readonly capacity: string;
  readonly utilization: number;
  readonly adequate: boolean;
}

export interface FootingDesignSummaryResult {
  readonly primitives: readonly DetailPrimitive[];
}

const round = (x: number): string => (Number.isFinite(x) ? x.toFixed(0) : '∞');
const mpa = (x: number): string => (Number.isFinite(x) ? x.toFixed(2) : '∞');
const pct = (x: number): string => (Number.isFinite(x) ? `${(x * 100).toFixed(0)}%` : '∞');

function cell(x: number, rowTop: number, text: string, align: TextAlign, bold: boolean, colorHex: string): DetailPrimitive {
  return { kind: 'text', position: { x, y: rowTop + TEXT_MM }, text, heightMm: TEXT_MM, colorHex, align, bold };
}

function rule(x1: number, x2: number, y: number): DetailPrimitive {
  return { kind: 'line', a: { x: x1, y }, b: { x: x2, y }, stroke: { colorHex: RULE_HEX, widthMm: RULE_WIDTH_MM } };
}

/** Μία γραμμή ελέγχου — η αξιοποίηση/ένδειξη χρωματίζεται κατά την επάρκεια. */
function pushRow(out: DetailPrimitive[], cols: ColAnchors, rowTop: number, row: SummaryRow, fail: string, ok: string): void {
  const statusHex = row.adequate ? OK_HEX : FAIL_HEX;
  out.push(cell(cols.check, rowTop, row.label, 'left', false, TEXT_HEX));
  out.push(cell(cols.demand, rowTop, row.demand, 'right', false, TEXT_HEX));
  out.push(cell(cols.capacity, rowTop, row.capacity, 'right', false, TEXT_HEX));
  out.push(cell(cols.util, rowTop, `${pct(row.utilization)} ${row.adequate ? ok : fail}`, 'right', !row.adequate, statusHex));
}

/** Build the design-summary primitives for a footing design result. */
export function buildFootingDesignSummaryRegion(
  design: FootingDesignResult,
  region: RectMm,
  labels: FootingDesignSummaryLabels,
): FootingDesignSummaryResult {
  const cw = region.w - 2 * SIDE_PAD_MM;
  const x0 = region.x + SIDE_PAD_MM;
  const cols: ColAnchors = { check: x0, demand: x0 + cw * 0.52, capacity: x0 + cw * 0.74, util: x0 + cw };

  const out: DetailPrimitive[] = [];
  let y = region.y + TOP_PAD_MM;

  out.push(cell(cols.check, y, labels.check, 'left', true, TEXT_HEX));
  out.push(cell(cols.demand, y, labels.demand, 'right', true, TEXT_HEX));
  out.push(cell(cols.capacity, y, labels.capacity, 'right', true, TEXT_HEX));
  out.push(cell(cols.util, y, labels.utilization, 'right', true, TEXT_HEX));
  y += ROW_H_MM;
  out.push(rule(x0, cols.util, y - ROW_H_MM * 0.2));

  const rows: SummaryRow[] = [
    { label: labels.bearing, demand: round(design.bearing.pMaxKpa), capacity: round(design.bearing.check.capacity), utilization: design.bearing.check.utilization, adequate: design.bearing.check.adequate },
    { label: labels.punching, demand: mpa(design.punching.vEdMpa), capacity: mpa(design.punching.vRdcMpa), utilization: design.punching.check.utilization, adequate: design.punching.check.adequate },
    { label: labels.oneWayShear, demand: mpa(design.oneWayShear.check.demand), capacity: mpa(design.oneWayShear.vRdcMpa), utilization: design.oneWayShear.check.utilization, adequate: design.oneWayShear.check.adequate },
  ];
  for (const row of rows) {
    pushRow(out, cols, y, row, labels.fail, labels.ok);
    y += ROW_H_MM;
  }

  if (design.flexure.hoggingGoverns) {
    out.push(rule(x0, cols.util, y - ROW_H_MM * 0.2));
    out.push(cell(x0, y, labels.topMeshNote, 'left', false, FAIL_HEX));
  }
  return { primitives: out };
}
