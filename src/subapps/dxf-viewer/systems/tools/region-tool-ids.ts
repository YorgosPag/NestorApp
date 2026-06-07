/**
 * ADR-419 — Region / perimeter BIM tool-id SSoT helpers.
 *
 * Το «σε περιοχή» (κολώνα + τοίχος) έσπασε από ΕΝΑ «έξυπνο» εργαλείο
 * (`column-in-region` / `wall-in-region`) σε ΤΡΕΙΣ διακριτές εντολές ανά τύπο:
 * «από 4 γραμμές» / «μέσα σε περιοχή» / «με πλαίσιο». Αυτό το module είναι η
 * μοναδική πηγή αλήθειας για:
 *   - τη χαρτογράφηση tool id → `RegionMethod` (ποιον τρόπο δέχεται το εργαλείο),
 *   - τα predicates που πριν ήταν σκορπισμένα ως `activeTool === 'wall-in-region' || …`
 *     σε mouse handlers / renderer / contextual config (N.0.2 boy-scout — μηδέν scatter).
 *
 * @see ../../ui/toolbar/types.ts (ToolType union)
 * @see ../../hooks/drawing/useColumnTool.ts / useWallTool.ts (regionMethod state)
 */

import type { ToolType } from '../../ui/toolbar/types';

/** Ποιον τρόπο επιλογής περιοχής δέχεται το εργαλείο. */
export type RegionMethod = 'lines' | 'inside' | 'box';

const COLUMN_REGION_METHODS: Readonly<Partial<Record<ToolType, RegionMethod>>> = {
  'column-region-lines': 'lines',
  'column-region-inside': 'inside',
  'column-region-box': 'box',
};

const WALL_REGION_METHODS: Readonly<Partial<Record<ToolType, RegionMethod>>> = {
  'wall-region-lines': 'lines',
  'wall-region-inside': 'inside',
  'wall-region-box': 'box',
};

/** «Κολώνα σε περιοχή» variant → method (ή null αν δεν είναι column-region tool). */
export function columnRegionMethod(tool: ToolType | null | undefined): RegionMethod | null {
  return tool ? COLUMN_REGION_METHODS[tool] ?? null : null;
}

/** «Τοίχος σε περιοχή» variant → method (ή null αν δεν είναι wall-region tool). */
export function wallRegionMethod(tool: ToolType | null | undefined): RegionMethod | null {
  return tool ? WALL_REGION_METHODS[tool] ?? null : null;
}

export function isColumnRegionTool(tool: ToolType | null | undefined): boolean {
  return columnRegionMethod(tool) !== null;
}

export function isWallRegionTool(tool: ToolType | null | undefined): boolean {
  return wallRegionMethod(tool) !== null;
}

/**
 * Εργαλεία που χρησιμοποιούν το box-select marquee pipeline (drag → emit
 * `bim:wall-region-box-select`): οι «με πλαίσιο» region variants + όλα τα
 * «από περίγραμμα» (outer/discrete, κολώνα/τοιχίο). Τα «4 γραμμές»/«μέσα σε
 * περιοχή» δουλεύουν ΜΟΝΟ με κλικ → ΕΚΤΟΣ marquee.
 */
export function isRegionBoxSelectTool(tool: ToolType | null | undefined): boolean {
  return (
    columnRegionMethod(tool) === 'box' ||
    wallRegionMethod(tool) === 'box' ||
    tool === 'wall-from-perimeter' ||
    tool === 'column-from-perimeter' ||
    tool === 'column-discrete-from-perimeter' ||
    tool === 'column-discrete-from-perimeter-walls'
  );
}

/**
 * Όλα τα BIM region/perimeter εργαλεία (region 3-way + outer/discrete perimeter).
 * Χρήση για contextual-tab visibility, gripsAllowed, click routing.
 */
export function isBimRegionOrPerimeterTool(tool: ToolType | null | undefined): boolean {
  return (
    isColumnRegionTool(tool) ||
    isWallRegionTool(tool) ||
    tool === 'wall-from-perimeter' ||
    tool === 'column-from-perimeter' ||
    tool === 'column-discrete-from-perimeter' ||
    tool === 'column-discrete-from-perimeter-walls'
  );
}
