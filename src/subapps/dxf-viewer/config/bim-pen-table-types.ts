/**
 * ADR-375 Phase C.1 — BIM Pen Table override types.
 *
 * Sparse override map: only changed cells are stored.
 * `buildEffectivePenTable` merges overrides onto `PEN_TABLE_MM` defaults.
 */
import { LINEWEIGHT_ISO_VALUES, type ConcreteLineweightMm } from './lineweight-iso-catalog';
import { PEN_TABLE_MM, type PenIndex } from './bim-pen-table';

/**
 * Sparse overrides: penIndex (1-based) → scale column index (0-based) → mm value.
 * Only changed cells need to be stored — absent cells fall back to PEN_TABLE_MM.
 */
export type PenTableOverrides = Partial<Record<PenIndex, Partial<Record<number, ConcreteLineweightMm>>>>;

/** Full resolved 16×6 table — every cell has a concrete value. */
export type EffectivePenTable = ReadonlyArray<ReadonlyArray<ConcreteLineweightMm>>;

/** Returns true when mm is a valid ISO 128-20 lineweight value. */
export function isValidPenMm(mm: number): mm is ConcreteLineweightMm {
  return LINEWEIGHT_ISO_VALUES.some((v) => Math.abs(v - mm) < 0.005);
}

/** Merge sparse overrides onto PEN_TABLE_MM defaults → full 16×6 table. */
export function buildEffectivePenTable(overrides?: PenTableOverrides | null): EffectivePenTable {
  if (!overrides) return PEN_TABLE_MM;
  return PEN_TABLE_MM.map((row, i) => {
    const penIdx = (i + 1) as PenIndex;
    const penOverrides = overrides[penIdx];
    if (!penOverrides) return row;
    return row.map((val, colIdx) => penOverrides[colIdx] ?? val);
  }) as EffectivePenTable;
}

/** Check if any cell in the overrides for the given pen/col differs from default. */
export function isOverridden(
  overrides: PenTableOverrides | null,
  penIdx: PenIndex,
  colIdx: number,
): boolean {
  return overrides?.[penIdx]?.[colIdx] !== undefined;
}
