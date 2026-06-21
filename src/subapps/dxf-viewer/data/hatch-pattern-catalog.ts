/**
 * Hatch predefined pattern catalog (ADR-507 Φ2) — τα «στυλ γραμμοσκίασης».
 *
 * Κατάλογος 30+ έτοιμων μοτίβων βιβλιοθήκης (όπως AutoCAD `acad.pat` / Revit fill
 * patterns): `ANSI31-38`, `AR-*`, `BRICK`, `EARTH`, `STEEL`, `CORK`… Κάθε μοτίβο =
 * μία ή περισσότερες **pattern lines** σε μορφή PAT (ADR-507 §2.2):
 *
 *   angle, x-origin, y-origin, delta-x, delta-y [, dash1, dash2, …]
 *
 *   - `angle`  — γωνία οικογένειας παράλληλων γραμμών (μοίρες, CCW από +X).
 *   - `origin` — σημείο αναφοράς (phase) μιας γραμμής της οικογένειας.
 *   - `delta`  — `[delta-x, delta-y]`: `delta-x` = μετατόπιση ΚΑΤΑ ΜΗΚΟΣ της γραμμής
 *                ανά διαδοχική παράλληλη (stagger — π.χ. brick courses)· `delta-y` =
 *                ΚΑΘΕΤΗ απόσταση μεταξύ παράλληλων γραμμών («πόσο πυκνά»).
 *   - `dashes` — μοτίβο dash κατά μήκος: `>0` γραμμή, `<0` κενό, `0` κουκκίδα.
 *                Κενός πίνακας = συνεχής γραμμή.
 *
 * **Μονάδες: mm** (world coords). Οι τιμές προέρχονται από `acad.pat` × 25.4
 * (inch→mm) ώστε να είναι ΚΑΙ AutoCAD-meaningful ΚΑΙ ορατές σε αρχιτεκτονικό mm
 * σχέδιο — π.χ. `ANSI31` delta-y = 0.125″ × 25.4 = **3.175 mm** (ταιριάζει με το
 * παράδειγμα του ADR-507 §2.2). Ο χρήστης κλιμακώνει live μέσω `patternScale`.
 *
 * ⚠️ ΔΕΝ είναι το ίδιο με τα `bim/{beams,columns,…}/*-hatch-patterns.ts` — εκείνα
 * είναι BIM material poché (άλλο σύστημα). Αυτός είναι ο PAT catalog.
 *
 * 💡 Πιστότητα: η οικογένεια ANSI + τα γεωμετρικά μοτίβα (BRICK/CROSS/NET/BOX/INSUL)
 * είναι ακριβή PAT conversions. Τα «τυχαία» υλικά (AR-CONC, GRAVEL, AR-SAND, MUDST)
 * χρησιμοποιούν λογική stipple/dotted προσέγγιση — το `acad.pat` τα ορίζει με δεκάδες
 * ψευδο-τυχαίες γραμμές· εδώ δίνουμε καθαρή, refinable απόδοση (HONESTY).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md §2.2, §5
 * @see bim/geometry/shared/hatch-pattern-geometry.ts (buildPredefinedHatchLines — consumer)
 */

/** Μία γραμμή ορισμού μοτίβου (PAT pattern definition line). Όλα σε mm / μοίρες. */
export interface PatternLine {
  /** Γωνία οικογένειας γραμμών (μοίρες, CCW από +X). */
  readonly angle: number;
  /** Σημείο αναφοράς (phase) `[x, y]` (mm). */
  readonly origin: readonly [number, number];
  /** `[delta-x (stagger κατά μήκος), delta-y (κάθετη απόσταση)]` (mm). */
  readonly delta: readonly [number, number];
  /** Μοτίβο dash κατά μήκος (mm): `>0` γραμμή, `<0` κενό, `0` κουκκίδα. Κενό = συνεχής. */
  readonly dashes: readonly number[];
}

/** Κατηγορία μοτίβου (για ομαδοποίηση στο UI). */
export type HatchPatternCategory =
  | 'general'      // ANSI / γενικής χρήσης
  | 'construction' // δομικά υλικά (σκυρόδεμα, τούβλο, ξύλο)
  | 'ground'       // έδαφος (χώμα, χαλίκι, γρασίδι)
  | 'metal'        // μέταλλα
  | 'insulation'   // μόνωση
  | 'special';     // ειδικά (γυαλί, κουκκίδες, κουτιά)

/** Ένα predefined μοτίβο: όνομα (AutoCAD), i18n label key, κατηγορία, γραμμές. */
export interface HatchPattern {
  /** Κανονικό όνομα (AutoCAD/DXF group 2) — π.χ. `'ANSI31'`. */
  readonly name: string;
  /** i18n key (N.11) — `ribbon.commands.hatchEditor.patterns.<key>` στο `dxf-viewer-shell`. */
  readonly labelKey: string;
  /** Κατηγορία (UI grouping). */
  readonly category: HatchPatternCategory;
  /** Μία ή περισσότερες γραμμές ορισμού. */
  readonly lines: readonly PatternLine[];
}

// ─── Helpers σύνταξης (αναγνωσιμότητα) ──────────────────────────────────────────

/** Σύντομος constructor μιας PatternLine. */
function line(
  angle: number, origin: readonly [number, number],
  delta: readonly [number, number], dashes: readonly number[] = [],
): PatternLine {
  return { angle, origin, delta, dashes };
}

// PAT inch→mm. Οι ANSI τιμές παρακάτω είναι ήδη σε mm (acad.pat × 25.4).
const INCH = 25.4;

// ─── Ο κατάλογος ────────────────────────────────────────────────────────────────

/**
 * SSoT κατάλογος predefined μοτίβων. Κλειδί = κανονικό AutoCAD όνομα (ίδιο με DXF
 * group 2 + `HatchEntity.patternName`).
 */
export const HATCH_PATTERN_CATALOG: Readonly<Record<string, HatchPattern>> = {
  // ── ANSI (γενικά) — ακριβή acad.pat conversions ───────────────────────────────
  ANSI31: {
    name: 'ANSI31', labelKey: 'ribbon.commands.hatchEditor.patterns.ansi31', category: 'general',
    lines: [line(45, [0, 0], [0, 3.175])],
  },
  ANSI32: {
    name: 'ANSI32', labelKey: 'ribbon.commands.hatchEditor.patterns.ansi32', category: 'general',
    lines: [
      line(45, [0, 0], [0, 9.525]),
      line(45, [4.49, 0], [0, 9.525]),
    ],
  },
  ANSI33: {
    name: 'ANSI33', labelKey: 'ribbon.commands.hatchEditor.patterns.ansi33', category: 'general',
    lines: [
      line(45, [0, 0], [0, 6.35]),
      line(45, [4.49, 0], [0, 6.35], [3.175, -1.5875]),
    ],
  },
  ANSI34: {
    name: 'ANSI34', labelKey: 'ribbon.commands.hatchEditor.patterns.ansi34', category: 'general',
    lines: [
      line(45, [0, 0], [0, 12.7]),
      line(45, [4.49, 0], [0, 12.7]),
      line(45, [8.98, 0], [0, 12.7]),
      line(45, [13.47, 0], [0, 12.7]),
    ],
  },
  ANSI35: {
    name: 'ANSI35', labelKey: 'ribbon.commands.hatchEditor.patterns.ansi35', category: 'general',
    lines: [
      line(45, [0, 0], [0, 6.35]),
      line(45, [4.49, 0], [0, 6.35], [7.9375, -1.5875, 0, -1.5875]),
    ],
  },
  ANSI36: {
    name: 'ANSI36', labelKey: 'ribbon.commands.hatchEditor.patterns.ansi36', category: 'general',
    lines: [line(45, [0, 0], [5.5563, 3.175], [7.9375, -1.5875, 0, -1.5875])],
  },
  ANSI37: {
    name: 'ANSI37', labelKey: 'ribbon.commands.hatchEditor.patterns.ansi37', category: 'general',
    lines: [
      line(45, [0, 0], [0, 3.175]),
      line(135, [0, 0], [0, 3.175]),
    ],
  },
  ANSI38: {
    name: 'ANSI38', labelKey: 'ribbon.commands.hatchEditor.patterns.ansi38', category: 'general',
    lines: [
      line(45, [0, 0], [0, 3.175]),
      line(135, [0, 0], [6.35, 3.175], [7.9375, -4.7625]),
    ],
  },

  // ── Construction (δομικά) ─────────────────────────────────────────────────────
  'AR-CONC': {
    // Σκυρόδεμα: αραιές διαγώνιες + στικτό «αδρανές» (stipple approximation).
    name: 'AR-CONC', labelKey: 'ribbon.commands.hatchEditor.patterns.arConc', category: 'construction',
    lines: [
      line(45, [0, 0], [0, 25.4]),
      line(0, [0, 0], [38.1, 38.1], [0, -38.1]),
      line(0, [12.7, 19.05], [38.1, 38.1], [0, -38.1]),
    ],
  },
  'AR-BRSTD': {
    // Πρότυπο τούβλο (running bond): οριζόντιες σειρές + κάθετοι σταυρωτοί αρμοί.
    name: 'AR-BRSTD', labelKey: 'ribbon.commands.hatchEditor.patterns.arBrstd', category: 'construction',
    lines: [
      line(0, [0, 0], [0, 76.2]),
      line(90, [0, 0], [76.2, 228.6], [76.2, -76.2]),
    ],
  },
  'AR-B816': {
    name: 'AR-B816', labelKey: 'ribbon.commands.hatchEditor.patterns.arB816', category: 'construction',
    lines: [
      line(0, [0, 0], [0, 8 * INCH]),
      line(90, [0, 0], [8 * INCH, 16 * INCH], [8 * INCH, -8 * INCH]),
    ],
  },
  'AR-B88': {
    name: 'AR-B88', labelKey: 'ribbon.commands.hatchEditor.patterns.arB88', category: 'construction',
    lines: [
      line(0, [0, 0], [0, 8 * INCH]),
      line(90, [0, 0], [8 * INCH, 8 * INCH], [8 * INCH, -8 * INCH]),
    ],
  },
  'AR-HBONE': {
    // Ψαροκόκαλο (herringbone): δύο κάθετες οικογένειες με stagger + dash.
    name: 'AR-HBONE', labelKey: 'ribbon.commands.hatchEditor.patterns.arHbone', category: 'construction',
    lines: [
      line(45, [0, 0], [101.6, 25.4], [101.6, -101.6]),
      line(135, [0, 0], [101.6, 25.4], [101.6, -101.6]),
    ],
  },
  'AR-SAND': {
    // Άμμος (stipple): πυκνές κουκκίδες σε δύο μετατοπισμένες οικογένειες.
    name: 'AR-SAND', labelKey: 'ribbon.commands.hatchEditor.patterns.arSand', category: 'construction',
    lines: [
      line(0, [0, 0], [19.05, 19.05], [0, -19.05]),
      line(0, [9.525, 9.525], [19.05, 19.05], [0, -19.05]),
    ],
  },
  BRICK: {
    name: 'BRICK', labelKey: 'ribbon.commands.hatchEditor.patterns.brick', category: 'construction',
    lines: [
      line(0, [0, 0], [0, 76.2]),
      line(90, [0, 0], [76.2, 228.6], [76.2, -152.4]),
    ],
  },
  BRSTONE: {
    name: 'BRSTONE', labelKey: 'ribbon.commands.hatchEditor.patterns.brstone', category: 'construction',
    lines: [
      line(0, [0, 0], [0, 76.2]),
      line(90, [0, 0], [76.2, 152.4], [76.2, -76.2]),
      line(45, [0, 0], [0, 152.4], [25.4, -127]),
    ],
  },
  WOOD: {
    // Ξύλο: παράλληλες ίνες + αραιά «νερά».
    name: 'WOOD', labelKey: 'ribbon.commands.hatchEditor.patterns.wood', category: 'construction',
    lines: [
      line(0, [0, 0], [0, 12.7]),
      line(0, [0, 6.35], [0, 50.8], [38.1, -12.7, 12.7, -12.7]),
    ],
  },

  // ── Ground (έδαφος) ───────────────────────────────────────────────────────────
  EARTH: {
    name: 'EARTH', labelKey: 'ribbon.commands.hatchEditor.patterns.earth', category: 'ground',
    lines: [
      line(45, [0, 0], [6.35, 6.35], [6.35, -6.35]),
      line(135, [0, 0], [6.35, 6.35], [6.35, -6.35]),
    ],
  },
  GRAVEL: {
    name: 'GRAVEL', labelKey: 'ribbon.commands.hatchEditor.patterns.gravel', category: 'ground',
    lines: [
      line(0, [0, 0], [25.4, 25.4], [0, -25.4]),
      line(0, [12.7, 12.7], [25.4, 25.4], [0, -25.4]),
      line(0, [6.35, 19.05], [25.4, 25.4], [0, -25.4]),
    ],
  },
  GRASS: {
    name: 'GRASS', labelKey: 'ribbon.commands.hatchEditor.patterns.grass', category: 'ground',
    lines: [
      line(90, [0, 0], [50.8, 50.8], [25.4, -76.2]),
      line(60, [0, 0], [50.8, 50.8], [25.4, -76.2]),
      line(120, [0, 0], [50.8, 50.8], [25.4, -76.2]),
    ],
  },
  MUDST: {
    name: 'MUDST', labelKey: 'ribbon.commands.hatchEditor.patterns.mudst', category: 'ground',
    lines: [
      line(0, [0, 0], [0, 19.05], [38.1, -19.05]),
      line(0, [0, 9.525], [0, 19.05], [19.05, -38.1]),
    ],
  },

  // ── Metal (μέταλλα) ───────────────────────────────────────────────────────────
  STEEL: {
    name: 'STEEL', labelKey: 'ribbon.commands.hatchEditor.patterns.steel', category: 'metal',
    lines: [
      line(45, [0, 0], [0, 9.525]),
      line(45, [4.49, 0], [0, 9.525]),
    ],
  },
  CROSS: {
    name: 'CROSS', labelKey: 'ribbon.commands.hatchEditor.patterns.cross', category: 'metal',
    lines: [
      line(0, [0, 0], [0, 6.35]),
      line(90, [0, 0], [0, 6.35]),
    ],
  },

  // ── Insulation (μόνωση) ───────────────────────────────────────────────────────
  CORK: {
    name: 'CORK', labelKey: 'ribbon.commands.hatchEditor.patterns.cork', category: 'insulation',
    lines: [
      line(0, [0, 0], [0, 9.525]),
      line(45, [0, 0], [0, 12.7], [6.35, -6.35]),
      line(135, [0, 0], [0, 12.7], [6.35, -6.35]),
    ],
  },
  INSUL: {
    name: 'INSUL', labelKey: 'ribbon.commands.hatchEditor.patterns.insul', category: 'insulation',
    lines: [
      line(0, [0, 0], [0, 9.525]),
      line(0, [0, 4.7625], [9.525, 4.7625], [4.7625, -4.7625]),
    ],
  },

  // ── Special (ειδικά) ──────────────────────────────────────────────────────────
  DOTS: {
    name: 'DOTS', labelKey: 'ribbon.commands.hatchEditor.patterns.dots', category: 'special',
    lines: [line(0, [0, 0], [12.7, 12.7], [0, -12.7])],
  },
  PLAST: {
    name: 'PLAST', labelKey: 'ribbon.commands.hatchEditor.patterns.plast', category: 'special',
    lines: [line(0, [0, 0], [0, 6.35])],
  },
  PLASTI: {
    name: 'PLASTI', labelKey: 'ribbon.commands.hatchEditor.patterns.plasti', category: 'special',
    lines: [
      line(0, [0, 0], [0, 6.35]),
      line(0, [0, 3.175], [0, 6.35], [3.175, -3.175]),
    ],
  },
  BOX: {
    name: 'BOX', labelKey: 'ribbon.commands.hatchEditor.patterns.box', category: 'special',
    lines: [
      line(0, [0, 0], [0, 25.4]),
      line(90, [0, 0], [0, 25.4]),
      line(0, [0, 6.35], [0, 25.4]),
      line(90, [6.35, 0], [0, 25.4]),
    ],
  },
  NET: {
    name: 'NET', labelKey: 'ribbon.commands.hatchEditor.patterns.net', category: 'special',
    lines: [
      line(0, [0, 0], [0, 3.175]),
      line(90, [0, 0], [0, 3.175]),
    ],
  },
  HONEY: {
    // Κηρήθρα (honeycomb approximation): τρεις οικογένειες 60°.
    name: 'HONEY', labelKey: 'ribbon.commands.hatchEditor.patterns.honey', category: 'special',
    lines: [
      line(0, [0, 0], [0, 22], [6.35, -6.35]),
      line(60, [0, 0], [0, 22], [6.35, -6.35]),
      line(120, [0, 0], [0, 22], [6.35, -6.35]),
    ],
  },
  GOST_GLASS: {
    name: 'GOST_GLASS', labelKey: 'ribbon.commands.hatchEditor.patterns.gostGlass', category: 'special',
    lines: [
      line(45, [0, 0], [0, 25.4], [12.7, -12.7]),
      line(45, [0, 6.35], [0, 25.4], [12.7, -12.7]),
    ],
  },
};

// ─── Public API (SSoT accessors) ────────────────────────────────────────────────

/** Επιστρέφει το μοτίβο με το δοθέν όνομα (case-insensitive), ή `undefined`. */
export function getHatchPattern(name: string | undefined): HatchPattern | undefined {
  if (!name) return undefined;
  return HATCH_PATTERN_CATALOG[name] ?? HATCH_PATTERN_CATALOG[name.toUpperCase()];
}

/** Λίστα όλων των μοτίβων (σταθερή σειρά εισαγωγής) — για το UI dropdown. */
export function listHatchPatterns(): readonly HatchPattern[] {
  return Object.values(HATCH_PATTERN_CATALOG);
}

/** Το προεπιλεγμένο όνομα μοτίβου όταν ο χρήστης διαλέξει «Predefined». */
export const DEFAULT_HATCH_PATTERN_NAME = 'ANSI31';
