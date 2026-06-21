/**
 * Material → Hatch mapping (ADR-507 Φ7 / §5γ.8) — Revit-style material automation.
 *
 * **SSoT υλικού→μοτίβου** για ΟΛΑ τα BIM structural poché (κολώνα/δοκάρι/τοίχος/
 * θεμέλιο). Κάθε υλικό → ένα PAT catalog pattern για **cut** (τομή — ό,τι «κόβεται»
 * στο cut plane) και ένα για **surface** (projection/κάτοψη). Ο renderer επιλέγει
 * βάσει του `CutState` που ήδη υπολογίζει (`resolveCutState`).
 *
 * **FULL SSoT — ενοποίηση (ADR-363 → ADR-507):** αντικαθιστά τις 4 ξεχωριστές
 * ταξινομίες υλικών (`ColumnMaterialKey`/`BeamMaterialKey`/`WallMaterialKey`/…) ΚΑΙ
 * τους 4 bespoke geometry engines — όλα περνούν τώρα από τον PAT catalog
 * (`buildPredefinedHatchLines`). Μηδέν δεύτερο pattern-geometry σύστημα.
 *
 * Φιλοσοφία mapping: **Revit/AutoCAD-faithful** (Giorgio 2026-06-22). Τα ονόματα
 * αναφέρονται στον `HATCH_PATTERN_CATALOG` (case-insensitive lookup).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md §5γ.8
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md (καταργηθέντα poché)
 */

import type { CutState } from '../../config/bim-view-range';

/** Κανονικά υλικά (μετά από normalize των aliases των παλιών ταξινομιών). */
export type CanonicalMaterial =
  | 'concrete'
  | 'steel'
  | 'masonry'
  | 'wood'
  | 'aerated-concrete'
  | 'gypsum'
  | 'insulation'
  | 'earth'
  | 'glass';

/** cut = τομή (cut plane)· surface = projection/κάτοψη. `null` = κανένα pattern (solid/none). */
interface MaterialHatchDefinition {
  readonly cut: string | null;
  readonly surface: string | null;
}

/**
 * Revit/AutoCAD-faithful αντιστοίχιση. Τα ονόματα = κλειδιά του `HATCH_PATTERN_CATALOG`.
 * `null` → χωρίς γραμμές μοτίβου (π.χ. surface σκυροδέματος = solid/none).
 */
export const MATERIAL_HATCH_MAP: Readonly<Record<CanonicalMaterial, MaterialHatchDefinition>> = {
  'concrete':         { cut: 'AR-CONC', surface: null },
  'steel':            { cut: 'STEEL',   surface: 'ANSI31' },
  'masonry':          { cut: 'BRICK',   surface: 'AR-BRSTD' },
  'wood':             { cut: 'WOOD',    surface: 'WOOD' },
  'aerated-concrete': { cut: 'ANSI37',  surface: 'ANSI37' },
  'gypsum':           { cut: 'ANSI31',  surface: null },
  'insulation':       { cut: 'INSUL',   surface: 'INSUL' },
  'earth':            { cut: 'EARTH',   surface: 'EARTH' },
  'glass':            { cut: null,      surface: null },
};

/**
 * Aliases των παλιών ανά-στοιχείο ταξινομιών (ADR-363) → canonical. Ό,τι δεν
 * αναγνωρίζεται → `'concrete'` (RC = το συνηθέστερο, ίδιο fallback με το παλιό `'rc'`).
 */
const MATERIAL_ALIASES: Readonly<Record<string, CanonicalMaterial>> = {
  // concrete family
  'rc': 'concrete',
  'reinforced-concrete': 'concrete',
  'concrete': 'concrete',
  // steel
  'steel': 'steel',
  // masonry / brick
  'masonry': 'masonry',
  'brick': 'masonry',
  // wood / timber / glulam
  'wood': 'wood',
  'timber': 'wood',
  'glulam': 'wood',
  // aerated concrete
  'aerated-concrete': 'aerated-concrete',
  'aircrete': 'aerated-concrete',
  'ytong': 'aerated-concrete',
  // gypsum
  'gypsum': 'gypsum',
  'plasterboard': 'gypsum',
  // others
  'insulation': 'insulation',
  'earth': 'earth',
  'soil': 'earth',
  'glass': 'glass',
};

/** Free-string υλικό → canonical (lowercase/trim, alias resolve, fallback `'concrete'`). */
export function normalizeMaterial(raw: string | undefined): CanonicalMaterial {
  if (!raw) return 'concrete';
  return MATERIAL_ALIASES[raw.trim().toLowerCase()] ?? 'concrete';
}

/**
 * Το PAT pattern name που πρέπει να εμφανίσει ένα BIM υλικό στην τρέχουσα προβολή.
 * `'cut'` → cut pattern· οτιδήποτε άλλο (projection/beyond) → surface pattern.
 * `null` → κανένα pattern (ο renderer δεν σχεδιάζει γραμμές poché).
 */
export function resolveAutoHatch(
  material: string | undefined,
  cutState: CutState,
): string | null {
  const def = MATERIAL_HATCH_MAP[normalizeMaterial(material)];
  return cutState === 'cut' ? def.cut : def.surface;
}
