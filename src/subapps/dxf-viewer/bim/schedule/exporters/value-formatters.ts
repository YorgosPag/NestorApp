/**
 * BIM Schedule Export — Value Formatters (ADR-363 §6 Phase 8).
 *
 * Pure formatters τα οποία μετατρέπουν raw `ScheduleCellValue` σε
 * presentation string ανά `ScheduleColumnValueType`. Shared SSoT για όλα
 * τα 3 exporters (CSV / xlsx / PDF) — εξασφαλίζει identical output
 * φορμά μεταξύ φορμάτ.
 *
 * Unit convention:
 *   - Raw dimensions stored σε mm (Nestor BIM convention)
 *   - `dimension-mm-to-m` → divide by 1000, 3 decimals (1.250 m)
 *   - `dimension-mm-to-cm` → divide by 10, 1 decimal (12.5 cm)
 *   - `area-m2` already σε m² → 2 decimals
 *   - `volume-m3` already σε m³ → 3 decimals
 *   - `count` → integer
 *   - `number` → 2 decimals (generic numeric)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
 */

import type { ScheduleCellValue, ScheduleColumnValueType } from '../types';

// ─── Numeric helpers ─────────────────────────────────────────────────────────

function isNumeric(value: ScheduleCellValue): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// ─── Format for display (string output) ──────────────────────────────────────

/**
 * Format a cell value for human-readable display (CSV/xlsx text, PDF cell).
 * Returns empty string for null/undefined (NOT the string "null") — exporters
 * decide rendering of empty cells.
 */
export function formatCellForDisplay(
  value: ScheduleCellValue,
  valueType: ScheduleColumnValueType,
): string {
  if (value === null || value === undefined) return '';

  switch (valueType) {
    case 'text':
      return String(value);
    case 'number':
      return isNumeric(value) ? roundTo(value, 2).toFixed(2) : '';
    case 'dimension-mm-to-m':
      return isNumeric(value) ? roundTo(value / 1000, 3).toFixed(3) : '';
    case 'dimension-mm-to-cm':
      return isNumeric(value) ? roundTo(value / 10, 1).toFixed(1) : '';
    case 'area-m2':
      return isNumeric(value) ? roundTo(value, 2).toFixed(2) : '';
    case 'volume-m3':
      return isNumeric(value) ? roundTo(value, 3).toFixed(3) : '';
    case 'count':
      return isNumeric(value) ? String(Math.round(value)) : '';
  }
}

/**
 * Format a cell value as a number for xlsx workbooks (preserves numeric
 * type — Excel can then format/sum the column). For non-numeric value
 * types, returns the display string.
 *
 * Output shape:
 *   - `text` → string
 *   - `number` / `area-m2` / `volume-m3` → number (raw value, no rounding)
 *   - `dimension-mm-to-m` → number σε m (divided by 1000)
 *   - `dimension-mm-to-cm` → number σε cm (divided by 10)
 *   - `count` → integer
 */
export function formatCellForXlsx(
  value: ScheduleCellValue,
  valueType: ScheduleColumnValueType,
): string | number | null {
  if (value === null || value === undefined) return null;

  switch (valueType) {
    case 'text':
      return String(value);
    case 'number':
    case 'area-m2':
    case 'volume-m3':
      return isNumeric(value) ? value : null;
    case 'dimension-mm-to-m':
      return isNumeric(value) ? value / 1000 : null;
    case 'dimension-mm-to-cm':
      return isNumeric(value) ? value / 10 : null;
    case 'count':
      return isNumeric(value) ? Math.round(value) : null;
  }
}

/**
 * Excel cell numFmt string per value type — applied μέσω
 * `cell.numFmt = ...` στο exceljs. Returns undefined για text columns
 * (no format).
 */
export function xlsxNumFmtFor(valueType: ScheduleColumnValueType): string | undefined {
  switch (valueType) {
    case 'text':
      return undefined;
    case 'number':
      return '0.00';
    case 'dimension-mm-to-m':
      return '0.000';
    case 'dimension-mm-to-cm':
      return '0.0';
    case 'area-m2':
      return '0.00';
    case 'volume-m3':
      return '0.000';
    case 'count':
      return '0';
  }
}
