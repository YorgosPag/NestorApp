/**
 * ADR-375 Phase C.2 — BIM Pen Sets (ArchiCAD-style presets).
 *
 * Three built-in pen sets that swap the entire 16×6 table in one click:
 *   design        — thin lines for fine architectural/schematic drawings
 *   construction  — medium lines (equals PEN_TABLE_MM ISO defaults)
 *   presentation  — heavy lines for printed client output
 *
 * `penSetToOverrides(name)` computes the sparse diff vs PEN_TABLE_MM so only
 * changed cells are written to Firestore. For 'construction', this is always
 * an empty object (no overrides needed).
 */
import { LINEWEIGHT_ISO_VALUES, type ConcreteLineweightMm } from './lineweight-iso-catalog';
import { PEN_TABLE_MM, type PenIndex } from './bim-pen-table';
import type { PenTableOverrides } from './bim-pen-table-types';

export type PenSetName = 'design' | 'construction' | 'presentation';

export const PEN_SET_NAMES: ReadonlyArray<PenSetName> = [
  'design',
  'construction',
  'presentation',
];

function iso(mm: number): ConcreteLineweightMm {
  const found = LINEWEIGHT_ISO_VALUES.find((v) => Math.abs(v - mm) < 0.005);
  if (found === undefined) throw new Error(`Pen set: ${mm}mm not in ISO catalog`);
  return found as ConcreteLineweightMm;
}

/** Design — one ISO step thinner than defaults (fine architectural drawings). */
const DESIGN_TABLE: ReadonlyArray<ReadonlyArray<ConcreteLineweightMm>> = [
  [iso(0.05), iso(0.05), iso(0.05), iso(0.05), iso(0.05), iso(0.05)],
  [iso(0.09), iso(0.09), iso(0.09), iso(0.05), iso(0.05), iso(0.05)],
  [iso(0.09), iso(0.09), iso(0.09), iso(0.09), iso(0.05), iso(0.05)],
  [iso(0.13), iso(0.13), iso(0.13), iso(0.09), iso(0.09), iso(0.05)],
  [iso(0.18), iso(0.18), iso(0.18), iso(0.13), iso(0.09), iso(0.09)],
  [iso(0.25), iso(0.25), iso(0.25), iso(0.18), iso(0.13), iso(0.09)],
  [iso(0.35), iso(0.30), iso(0.25), iso(0.25), iso(0.18), iso(0.13)],
  [iso(0.50), iso(0.40), iso(0.40), iso(0.30), iso(0.25), iso(0.18)],
  [iso(0.60), iso(0.50), iso(0.50), iso(0.40), iso(0.30), iso(0.25)],
  [iso(0.70), iso(0.60), iso(0.60), iso(0.50), iso(0.40), iso(0.30)],
  [iso(0.80), iso(0.80), iso(0.70), iso(0.60), iso(0.40), iso(0.30)],
  [iso(1.0),  iso(0.90), iso(0.80), iso(0.60), iso(0.50), iso(0.40)],
  [iso(1.2),  iso(1.0),  iso(0.90), iso(0.80), iso(0.60), iso(0.40)],
  [iso(1.4),  iso(1.2),  iso(1.0),  iso(0.90), iso(0.70), iso(0.50)],
  [iso(1.58), iso(1.4),  iso(1.2),  iso(1.0),  iso(0.80), iso(0.60)],
  [iso(2.0),  iso(1.58), iso(1.4),  iso(1.2),  iso(1.0),  iso(0.70)],
];

/** Construction — equals PEN_TABLE_MM (ISO defaults). Overrides will be empty. */
const CONSTRUCTION_TABLE = PEN_TABLE_MM;

/** Presentation — one ISO step heavier than defaults (bold printed output). */
const PRESENTATION_TABLE: ReadonlyArray<ReadonlyArray<ConcreteLineweightMm>> = [
  [iso(0.09), iso(0.09), iso(0.09), iso(0.09), iso(0.09), iso(0.09)],
  [iso(0.13), iso(0.13), iso(0.13), iso(0.09), iso(0.09), iso(0.09)],
  [iso(0.18), iso(0.18), iso(0.18), iso(0.18), iso(0.13), iso(0.13)],
  [iso(0.25), iso(0.25), iso(0.25), iso(0.18), iso(0.18), iso(0.13)],
  [iso(0.35), iso(0.35), iso(0.35), iso(0.25), iso(0.18), iso(0.18)],
  [iso(0.50), iso(0.50), iso(0.40), iso(0.35), iso(0.25), iso(0.18)],
  [iso(0.70), iso(0.60), iso(0.50), iso(0.50), iso(0.35), iso(0.25)],
  [iso(0.80), iso(0.70), iso(0.70), iso(0.60), iso(0.50), iso(0.35)],
  [iso(1.0),  iso(0.90), iso(0.90), iso(0.70), iso(0.60), iso(0.50)],
  [iso(1.2),  iso(1.0),  iso(1.0),  iso(0.80), iso(0.70), iso(0.60)],
  [iso(1.4),  iso(1.2),  iso(1.2),  iso(0.90), iso(0.70), iso(0.60)],
  [iso(1.58), iso(1.4),  iso(1.2),  iso(1.0),  iso(0.80), iso(0.70)],
  [iso(2.0),  iso(1.58), iso(1.4),  iso(1.2),  iso(0.90), iso(0.70)],
  [iso(2.11), iso(2.0),  iso(1.58), iso(1.4),  iso(1.0),  iso(0.80)],
  [iso(2.11), iso(2.11), iso(2.0),  iso(1.58), iso(1.2),  iso(0.90)],
  [iso(2.11), iso(2.11), iso(2.11), iso(2.0),  iso(1.58), iso(1.0)],
];

export const BIM_PEN_SETS: Readonly<Record<PenSetName, ReadonlyArray<ReadonlyArray<ConcreteLineweightMm>>>> = {
  design: DESIGN_TABLE,
  construction: CONSTRUCTION_TABLE,
  presentation: PRESENTATION_TABLE,
};

/**
 * Compute the sparse diff between a preset table and PEN_TABLE_MM defaults.
 * For 'construction' this always returns {} (preset IS the default).
 */
export function penSetToOverrides(name: PenSetName): PenTableOverrides {
  const preset = BIM_PEN_SETS[name];
  const overrides: PenTableOverrides = {};
  preset.forEach((row, i) => {
    const penIdx = (i + 1) as PenIndex;
    const defaultRow = PEN_TABLE_MM[i];
    const penOverrides: Partial<Record<number, ConcreteLineweightMm>> = {};
    row.forEach((val, colIdx) => {
      if (Math.abs(val - defaultRow[colIdx]) > 0.005) {
        penOverrides[colIdx] = val;
      }
    });
    if (Object.keys(penOverrides).length > 0) {
      overrides[penIdx] = penOverrides;
    }
  });
  return overrides;
}
