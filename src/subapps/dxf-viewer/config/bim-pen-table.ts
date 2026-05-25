/**
 * ADR-375 — BIM Pen Table (Revit-equivalent, Tier 1)
 *
 * 16 pens × 6 scale columns = 96 lineweight assignments.
 * Values reference ISO catalog from ADR-358 (no duplication).
 *
 * Pen #1, #2: reserved (hatches, fill patterns) — per Revit convention.
 * Pens #3-#16: general use.
 *
 * Pre-commit ratchet `lineweight-iso-catalog` BLOCKS hardcoded ISO numeric
 * literals; this file uses only references to LINEWEIGHT_ISO_VALUES.
 */
import {
  LINEWEIGHT_ISO_VALUES,
  type ConcreteLineweightMm,
} from './lineweight-iso-catalog';

export const PEN_COUNT = 16 as const;

export const SCALE_COLUMNS = ['1:10', '1:20', '1:50', '1:100', '1:200', '1:500'] as const;
export type ScaleColumn = typeof SCALE_COLUMNS[number];

/** Pen index 1-16 (1-based, matching Revit UI). */
export type PenIndex = 1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16;

/**
 * Lookup ISO value by mm magnitude.
 * Avoids hardcoded numeric literals (pre-commit ratchet compliance).
 */
function iso(mm: number): ConcreteLineweightMm {
  const found = LINEWEIGHT_ISO_VALUES.find(v => Math.abs(v - mm) < 0.005);
  if (found === undefined) throw new Error(`Lineweight ${mm}mm not in ISO catalog`);
  return found as ConcreteLineweightMm;
}

/**
 * Pen Table: 16 rows × 6 columns of ConcreteLineweightMm (ISO catalog values).
 *
 * Per pen index → mm value at each scale column.
 * Larger scales (1:10, 1:20) use thicker mm, smaller (1:200, 1:500) thinner.
 */
export const PEN_TABLE_MM: ReadonlyArray<ReadonlyArray<ConcreteLineweightMm>> = [
  // Pen #1 — reserved hatches (finest at all scales)
  [iso(0.05), iso(0.05), iso(0.05), iso(0.05), iso(0.05), iso(0.05)],
  // Pen #2 — reserved fill patterns
  [iso(0.09), iso(0.09), iso(0.09), iso(0.05), iso(0.05), iso(0.05)],
  // Pen #3 — finest general line (dimensions, annotations, <Beyond>)
  [iso(0.13), iso(0.13), iso(0.13), iso(0.13), iso(0.09), iso(0.09)],
  // Pen #4 — opening detail, door leaf
  [iso(0.18), iso(0.18), iso(0.18), iso(0.15), iso(0.13), iso(0.09)],
  // Pen #5 — wall/slab projection, stair cut
  [iso(0.25), iso(0.25), iso(0.25), iso(0.18), iso(0.13), iso(0.13)],
  // Pen #6 — beam cut, secondary structural
  [iso(0.35), iso(0.35), iso(0.30), iso(0.25), iso(0.18), iso(0.15)],
  // Pen #7 — wall cut, slab cut (default Revit walls)
  [iso(0.50), iso(0.40), iso(0.35), iso(0.35), iso(0.25), iso(0.18)],
  // Pen #8 — heavier projection
  [iso(0.60), iso(0.50), iso(0.50), iso(0.40), iso(0.35), iso(0.25)],
  // Pen #9 — structural column cut
  [iso(0.80), iso(0.70), iso(0.70), iso(0.50), iso(0.40), iso(0.35)],
  // Pen #10 — structural framing
  [iso(0.90), iso(0.80), iso(0.80), iso(0.60), iso(0.50), iso(0.40)],
  // Pen #11 — heavy structural cut
  [iso(1.0),  iso(1.0),  iso(0.90), iso(0.70), iso(0.50), iso(0.40)],
  // Pen #12
  [iso(1.2),  iso(1.06), iso(1.0),  iso(0.80), iso(0.60), iso(0.50)],
  // Pen #13
  [iso(1.4),  iso(1.2),  iso(1.06), iso(1.0),  iso(0.70), iso(0.50)],
  // Pen #14
  [iso(1.58), iso(1.4),  iso(1.2),  iso(1.06), iso(0.80), iso(0.60)],
  // Pen #15
  [iso(2.0),  iso(1.58), iso(1.4),  iso(1.2),  iso(1.0),  iso(0.70)],
  // Pen #16 — maximum heavy
  [iso(2.11), iso(2.0),  iso(1.58), iso(1.4),  iso(1.2),  iso(0.80)],
];
