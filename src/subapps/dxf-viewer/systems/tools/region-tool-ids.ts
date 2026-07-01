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

/** Ποιον τρόπο επιλογής περιοχής δέχεται το εργαλείο. */
export type RegionMethod = 'lines' | 'inside' | 'box';

// Plain string keys (όχι exhaustive Record<ToolType>) ώστε τα predicates να
// δέχονται και `string | undefined` activeTool refs χωρίς casts στα call sites.
const COLUMN_REGION_METHODS: Readonly<Record<string, RegionMethod>> = {
  'column-region-lines': 'lines',
  'column-region-inside': 'inside',
  'column-region-box': 'box',
};

const WALL_REGION_METHODS: Readonly<Record<string, RegionMethod>> = {
  'wall-region-lines': 'lines',
  'wall-region-inside': 'inside',
  'wall-region-box': 'box',
};

/** «Κολώνα σε περιοχή» variant → method (ή null αν δεν είναι column-region tool). */
export function columnRegionMethod(tool: string | null | undefined): RegionMethod | null {
  return tool ? COLUMN_REGION_METHODS[tool] ?? null : null;
}

/** «Τοίχος σε περιοχή» variant → method (ή null αν δεν είναι wall-region tool). */
export function wallRegionMethod(tool: string | null | undefined): RegionMethod | null {
  return tool ? WALL_REGION_METHODS[tool] ?? null : null;
}

export function isColumnRegionTool(tool: string | null | undefined): boolean {
  return columnRegionMethod(tool) !== null;
}

export function isWallRegionTool(tool: string | null | undefined): boolean {
  return wallRegionMethod(tool) !== null;
}

/**
 * Όλα τα εργαλεία ΣΧΕΔΙΑΣΗΣ τοίχου που μοιράζονται το ίδιο contextual tab + τις
 * ίδιες draw-defaults (`wallToolBridgeStore`): ευθύς/καμπύλος/πολυγραμμή τοίχος
 * (`'wall'`), region 3-way (`isWallRegionTool`) και «από περίγραμμα». SSoT — το
 * inline check ζούσε διπλό σε `ribbon-contextual-config` + θα ζητηθεί και από το
 * αριστερό draft panel (`BimPropertiesRouter`) + το auto-switch (N.0.2).
 */
export function isWallDrawingTool(tool: string | null | undefined): boolean {
  return tool === 'wall' || isWallRegionTool(tool) || tool === 'wall-from-perimeter';
}

/**
 * Εργαλεία που χρησιμοποιούν το box-select marquee pipeline (drag → emit
 * `bim:wall-region-box-select`): οι «με πλαίσιο» region variants + όλα τα
 * «από περίγραμμα» (outer/discrete, κολώνα/τοιχίο). Τα «4 γραμμές»/«μέσα σε
 * περιοχή» δουλεύουν ΜΟΝΟ με κλικ → ΕΚΤΟΣ marquee.
 */
export function isRegionBoxSelectTool(tool: string | null | undefined): boolean {
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
export function isBimRegionOrPerimeterTool(tool: string | null | undefined): boolean {
  return (
    isColumnRegionTool(tool) ||
    isWallRegionTool(tool) ||
    tool === 'wall-from-perimeter' ||
    tool === 'column-from-perimeter' ||
    tool === 'column-discrete-from-perimeter' ||
    tool === 'column-discrete-from-perimeter-walls'
  );
}

/**
 * Β (Giorgio 2026-07-01) — εργαλεία που δείχνουν τη διακεκομμένη «region/perimeter
 * hover preview» (`useRegionPerimeterMouseMove`). Επιπλέον των region/perimeter
 * εργαλείων, ΚΑΙ ο σκέτος «Τοίχος» (`'wall'`): hover πάνω σε εντοπισμένο DXF
 * παραλληλόγραμμο → διακεκομμένη → κλικ γεμίζει τοίχο. ΣΤΕΝΟ predicate ΜΟΝΟ για το
 * hover — δεν επεκτείνει το `isBimRegionOrPerimeterTool` (που οδηγεί grips /
 * contextual-tab / click-routing και δεν πρέπει να αλλάξει για τον σκέτο τοίχο).
 * Η τελική ορατότητα για τον σκέτο τοίχο κρίνεται επιπλέον από το `isRegionFillEligible`
 * (awaitingStart) ώστε preview ≡ commit.
 */
export function isRegionHoverPreviewTool(tool: string | null | undefined): boolean {
  return isBimRegionOrPerimeterTool(tool) || tool === 'wall';
}
