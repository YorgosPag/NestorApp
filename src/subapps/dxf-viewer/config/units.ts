/**
 * ADR-357 Phase 2b: Display unit conversion SSoT.
 *
 * Internal scene coordinates are always in mm ($INSUNITS = 4, BIM/ISO/DXF standard).
 * This module converts mm ↔ the user-selected display unit for UI readouts.
 * The user's choice persists in localStorage (key: dxf:displayUnit).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-357-dxf-line-tool-google-level.md §5.5
 */

import type { SceneUnits } from '../utils/scene-units';
import { mmToSceneUnits } from '../utils/scene-units';

/** Display unit for UI readouts — reuses SceneUnits identifiers, different semantic role. */
export type DisplayUnit = SceneUnits;

export const DISPLAY_UNIT_OPTIONS: readonly DisplayUnit[] = ['mm', 'cm', 'm', 'in', 'ft'] as const;

/** Short symbol shown in the UI next to numeric values. */
export const DISPLAY_UNIT_LABELS: Record<DisplayUnit, string> = {
  mm: 'mm',
  cm: 'cm',
  m: 'm',
  in: '"',
  ft: "'",
};

/**
 * Default display unit — **metres** (ADR-677 Φάση 1, Giorgio 2026-07-18).
 *
 * Supersedes the earlier `'cm'` default of ADR-357 §5.5 (2026-05-16). This is the
 * ONE project unit: it drives both the readouts AND the interpretation of every
 * typed value (ring length/thickness/height, direct-distance entry) — Revit/AutoCAD
 * style, a single setting rather than split display-vs-input units.
 *
 * Paired with `DEFAULT_DISPLAY_PRECISION['m'] = 3`, so `0.895 m` still expresses a
 * whole millimetre — no precision is lost against the canonical-mm store (ADR-462).
 */
export const DEFAULT_DISPLAY_UNIT: DisplayUnit = 'm';

export const DISPLAY_UNIT_STORAGE_KEY = 'dxf:displayUnit';

/**
 * Default decimal places per unit. mm gets 0 (no sub-mm in construction).
 *
 * `m: 3` is load-bearing, not cosmetic (ADR-677 απόφαση #9): metres is the default
 * unit, so 3 decimals is what keeps a typed/displayed value millimetre-exact against
 * the canonical-mm store (`0.895 m` ≡ 895 mm). Lowering it to 2 would silently round
 * every readout to the centimetre. Anchored by `units-format.test.ts`.
 */
export const DEFAULT_DISPLAY_PRECISION: Record<DisplayUnit, number> = {
  mm: 0,
  cm: 2,
  m: 3,
  in: 3,
  ft: 3,
};

/**
 * Short symbol for AREA values — the linear unit squared. Not an i18n string
 * (same rationale as the "°" degree glyph): a physical unit symbol, locale-free.
 */
export const DISPLAY_AREA_LABELS: Record<DisplayUnit, string> = {
  mm: 'mm²',
  cm: 'cm²',
  m: 'm²',
  in: 'in²',
  ft: 'ft²',
};

/** Default decimal places for AREA per unit (mm² stays whole — sub-mm² is noise). */
export const DEFAULT_AREA_PRECISION: Record<DisplayUnit, number> = {
  mm: 0,
  cm: 2,
  m: 3,
  in: 2,
  ft: 3,
};

/** Default decimal places for X/Y COORDINATE readouts per unit (CAD status bar). */
export const DEFAULT_COORDINATE_PRECISION: Record<DisplayUnit, number> = {
  mm: 0,
  cm: 2,
  m: 3,
  in: 3,
  ft: 3,
};

export function isValidDisplayUnit(value: string | null | undefined): value is DisplayUnit {
  return value === 'mm' || value === 'cm' || value === 'm' || value === 'in' || value === 'ft';
}

/**
 * Convert a mm value to the display unit.
 * `toDisplay(5000, 'cm') → { value: 500, label: 'cm' }`
 */
export function toDisplay(mm: number, unit: DisplayUnit): { value: number; label: string } {
  return {
    value: mm * mmToSceneUnits(unit),
    label: DISPLAY_UNIT_LABELS[unit],
  };
}

/**
 * Convert a display-unit value back to mm.
 * `fromDisplay(500, 'cm') → 5000`
 */
export function fromDisplay(value: number, unit: DisplayUnit): number {
  return value / mmToSceneUnits(unit);
}

/**
 * Convert a mm² area to the display unit (the linear factor is SQUARED).
 * `toDisplayArea(1_000_000, 'm') → { value: 1, label: 'm²' }`  (1 m² = 1e6 mm²)
 */
export function toDisplayArea(mm2: number, unit: DisplayUnit): { value: number; label: string } {
  const linear = mmToSceneUnits(unit);
  return {
    value: mm2 * linear * linear,
    label: DISPLAY_AREA_LABELS[unit],
  };
}

/**
 * Format a mm value as a numeric string in the display unit.
 * `formatDisplayValue(5000, 'cm') → "500.00"`
 */
export function formatDisplayValue(mm: number, unit: DisplayUnit, precision?: number): string {
  const { value } = toDisplay(mm, unit);
  const p = precision ?? DEFAULT_DISPLAY_PRECISION[unit];
  return value.toFixed(p);
}

/**
 * Default decimal places for EDITABLE angle inputs (degrees) — AutoCAD AUPREC-style,
 * Revit/ArchiCAD/Figma-grade (2 decimals). Angles are unit-agnostic (always degrees),
 * so unlike length this is a single number, not a per-DisplayUnit map.
 */
export const DEFAULT_ANGLE_PRECISION = 2;

/**
 * Format a degree value for an EDITABLE angle input (dot separator, parseable so
 * `parseFloat` round-trips — mirror του {@link formatDisplayValue} για γωνίες). Rounds to
 * `DEFAULT_ANGLE_PRECISION` and snaps sub-precision magnitudes to 0 (never emits "-0.00").
 * `formatAngleValue(-0.7050491969792) → "-0.71"`
 */
export function formatAngleValue(deg: number, precision: number = DEFAULT_ANGLE_PRECISION): string {
  const snapped = Math.abs(deg) < Math.pow(10, -precision) ? 0 : deg;
  return snapped.toFixed(precision);
}
