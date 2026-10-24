/**
 * @fileoverview **`$INSUNITS` — what one drawing unit is in millimetres, and what the file declares** (SSoT).
 * @related ADR-920 Β4.1β · ADR-462 (canonical mm) · ./dxf-section-scan (the HEADER is found there)
 *
 * Moved from `dxf-viewer/utils/dxf-parser-types.ts` (which re-exports the table) so the owner's plot-listing survey
 * import can read a DXF without importing the subapp (CHECK 3.62).
 *
 * 🔴 **TWO CORRECTIONS ON THE MOVE (ADR-920 §13.2), checked against the AutoCAD + BricsCAD `INSUNITS` references:**
 *   • `17` is **Gigameters** (10¹² mm). The table said `1852000` with the comment «nautical mile» — a unit `INSUNITS`
 *     does not have.
 *   • `21`–`24` (US Survey Feet / Inch / Yard / Mile) were **missing**, so `getUnitScale` fell back to «1 mm per unit»
 *     and a US survey in survey feet shrank 304.8× — silently. The survey foot is 1200/3937 m.
 * The only caller of the table is the topography point extractor, so no drawing import changes scale.
 */

import { findDxfSectionRange } from './dxf-section-scan';

/** The US survey foot in mm (1200/3937 m) — the base of codes 21–24. */
const US_SURVEY_FOOT_MM = 1_200_000 / 3937;

/** Converts a DXF `$INSUNITS` code to millimetres per drawing unit. */
export const INSUNITS_TO_MM: Record<number, number> = {
  0: 1,       // Unitless - assume mm
  1: 25.4,    // Inches → mm
  2: 304.8,   // Feet → mm
  3: 1609344, // Miles → mm
  4: 1,       // Millimeters → mm (base)
  5: 10,      // Centimeters → mm
  6: 1000,    // Meters → mm
  7: 1000000, // Kilometers → mm
  8: 0.0000254, // Microinches → mm
  9: 0.0254,  // Mils → mm
  10: 914.4,  // Yards → mm
  11: 1e-7,   // Angstroms → mm
  12: 1e-6,   // Nanometers → mm
  13: 0.001,  // Microns → mm
  14: 100,    // Decimeters → mm
  15: 10000,  // Decameters → mm
  16: 100000, // Hectometers → mm
  17: 1e12,   // Gigameters → mm
  18: 1.496e14, // Astronomical units → mm
  19: 9.461e18, // Light years → mm
  20: 3.086e19, // Parsecs → mm
  21: US_SURVEY_FOOT_MM,        // US Survey Feet → mm
  22: US_SURVEY_FOOT_MM / 12,   // US Survey Inch → mm
  23: US_SURVEY_FOOT_MM * 3,    // US Survey Yard → mm
  24: US_SURVEY_FOOT_MM * 5280, // US Survey Mile → mm
};

/**
 * The `$INSUNITS` code the file **declares**, or `null` when the HEADER does not carry it (or carries no integer).
 *
 * ⚠️ `0` is a VALUE («unitless»), never «absent» — the same rule `DxfEntityParser.parseHeader` keeps
 * (`parseIntSysvar(value) ?? 4`). What a caller does with `null` or `0` is ITS policy: the viewer's import keeps its
 * historic defaults; the owner's form asks the human (ADR-920 §13.2).
 */
export function readDxfInsunits(lines: readonly string[]): number | null {
  const header = findDxfSectionRange(lines, 'HEADER');
  if (header === null) return null;

  let variable = '';
  for (let i = header.start; i < header.end - 1; i += 2) {
    const code = lines[i]?.trim();
    const value = lines[i + 1]?.trim() ?? '';
    if (code === '9') variable = value;
    else if (variable === '$INSUNITS' && code === '70') {
      const parsed = parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }
  }
  return null;
}
