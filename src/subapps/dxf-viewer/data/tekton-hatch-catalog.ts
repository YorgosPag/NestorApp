/**
 * ADR-512 (Tekton .TEK export/import) — αντιστοίχιση μοτίβων γραμμοσκίασης
 * (hatch) **δικό μας όνομα ↔ αριθμός μοτίβου Τέκτονα** — bidirectional SSoT (data file).
 *
 * Ο Τέκτων (FESPA) αριθμεί τα μοτίβα του στο master κατάλογο `pattern.inf` της
 * εγκατάστασης (`<type>N` σε κάθε `<hatch>` record δείχνει ΕΚΕΙ). Οι αριθμοί εδώ
 * είναι **decoded από τα πραγματικά** `pattern.inf` + `dxfpat.inf` του Τέκτονα:
 *   22 = solid (raster) · 72–79 = ANSI-31…38 · 80–89 = AR-* · 23/24 = BRICK/BRSTONE
 *   31 = EARTH · 55 = MUDST · 26 = CORK · 39 = INSUL · 30 = DOTS · 58/59 = PLAST/PLASTI
 *   68 = BOX · 56 = NET · 37 = HONEY · 10 = STEEL(native) · 8 = CROSS · 7 = GRASS
 *   108 = WOOD(native wood_grains) · 109 = GRAVEL(native gravel).
 *
 * ⚠️ NATIVE-SAFE: όπου το `dxfpat.inf` δίνει αριθμό που **δεν υπάρχει** στο master
 * `pattern.inf` (π.χ. `STEEL→63`), προτιμούμε τον master αριθμό (`STEEL→10`) ώστε ο
 * Τέκτων να ζωγραφίζει το μοτίβο και σε native `.tek` (verified: το δείγμα χρησιμοποιεί 10).
 *
 * Bidirectional: το ίδιο catalog τρέφει export (name→num) ΚΑΙ import (num→name, ADR-512 Φ2).
 * @see docs/centralized-systems/reference/adrs/ADR-512-tekton-tek-export.md
 */

/** Ο αριθμός μοτίβου Τέκτονα για συμπαγές (solid) γέμισμα — `*:Raster:solid` στο pattern.inf. */
export const TEKTON_SOLID_HATCH_NUM = 22;

/** Ο default αριθμός για μοτίβα χωρίς native αντίστοιχο (ANSI-31 — το πιο κοινό/ασφαλές). */
export const TEKTON_DEFAULT_HATCH_NUM = 72;

/**
 * Το ΕΝΑ SSoT map: **δικό μας `patternName` (κεφαλαία) → αριθμός μοτίβου Τέκτονα** (master
 * `pattern.inf` index). Κλειδιά = τα ονόματα του `data/hatch-pattern-catalog.ts` (AutoCAD-derived).
 * Απόντα κλειδιά → `TEKTON_DEFAULT_HATCH_NUM` (βλ. `resolveTektonHatchNumber`).
 */
export const TEKTON_HATCH_PATTERN_NUMBERS: Readonly<Record<string, number>> = {
  // AutoCAD ANSI — άμεση 1:1 ταύτιση (pattern.inf 72–79).
  ANSI31: 72, ANSI32: 73, ANSI33: 74, ANSI34: 75,
  ANSI35: 76, ANSI36: 77, ANSI37: 78, ANSI38: 79,
  // Architectural AR-* (pattern.inf 70/80–89).
  'AR-CONC': 85, 'AR-BRSTD': 84, 'AR-B816': 70, 'AR-B88': 82, 'AR-HBONE': 86, 'AR-SAND': 80,
  // Δομικά / υλικά (pattern.inf).
  BRICK: 23, BRSTONE: 24, EARTH: 31, MUDST: 55, CORK: 26, INSUL: 39, DOTS: 30,
  PLAST: 58, PLASTI: 59, BOX: 68, NET: 56, HONEY: 37,
  // Native-only ταυτίσεις (master pattern.inf indices — native-safe).
  STEEL: 10,   // native χάλυβας (dxfpat.inf 63 λείπει από το master → 10)
  CROSS: 8,    // native σταυρωτό
  GRASS: 7,    // native γρασίδι
  WOOD: 108,   // native wood_grains
  GRAVEL: 109, // native gravel/χαλίκι
  // GOST_GLASS → χωρίς native αντίστοιχο → default (72).
};

/**
 * Επιλύει τον αριθμό μοτίβου Τέκτονα από το `patternName` μας. Άγνωστο/κενό → default.
 * Case-insensitive (τα κλειδιά είναι κεφαλαία, όπως τα ονόματα AutoCAD PAT).
 */
export function resolveTektonHatchNumber(patternName: string | undefined): number {
  if (!patternName) return TEKTON_DEFAULT_HATCH_NUM;
  return TEKTON_HATCH_PATTERN_NUMBERS[patternName.toUpperCase()] ?? TEKTON_DEFAULT_HATCH_NUM;
}

/**
 * ADR-512 Φ2 (import) — αντίστροφος χάρτης **αριθμός Τέκτονα → δικό μας `patternName`**.
 * Πρώτο-wins όταν δύο ονόματα δείχνουν στον ίδιο αριθμό (δεν συμβαίνει εδώ). Ο import loader
 * θα το καταναλώσει ώστε `.tek` hatch → `HatchEntity.patternName` (μηδέν 2η πηγή).
 */
export const TEKTON_HATCH_NUMBER_TO_NAME: Readonly<Record<number, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(TEKTON_HATCH_PATTERN_NUMBERS).map(([name, num]) => [num, name]),
  ),
);
