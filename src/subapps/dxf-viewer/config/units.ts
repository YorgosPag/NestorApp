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

/** Default display unit per ADR-357 §5.5 (confirmed Giorgio 2026-05-16). */
export const DEFAULT_DISPLAY_UNIT: DisplayUnit = 'cm';

export const DISPLAY_UNIT_STORAGE_KEY = 'dxf:displayUnit';

/** Default decimal places per unit. mm gets 0 (no sub-mm in construction). */
export const DEFAULT_DISPLAY_PRECISION: Record<DisplayUnit, number> = {
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
 * Format a mm value as a numeric string in the display unit.
 * `formatDisplayValue(5000, 'cm') → "500.00"`
 */
export function formatDisplayValue(mm: number, unit: DisplayUnit, precision?: number): string {
  const { value } = toDisplay(mm, unit);
  const p = precision ?? DEFAULT_DISPLAY_PRECISION[unit];
  return value.toFixed(p);
}
