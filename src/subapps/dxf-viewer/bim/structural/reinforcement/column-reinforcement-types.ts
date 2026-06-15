/**
 * Column reinforcement data model (ADR-456 — Στατικά, Slice 1B).
 *
 * Pure type module — zero deps so it can be imported by `column-types.ts`
 * (ColumnParams), the code providers, AND the compute engine without cycles.
 *
 * The reinforcement is the user-editable / code-suggested INTENT. Derived
 * quantities (bar lengths, stirrup count, steel weight, ρ) are computed on the
 * fly by `column-reinforcement-compute.ts` — never stored (mirror of the
 * geometry-is-SSoT rule for volume/area).
 *
 * Units: όλα τα μήκη/διάμετροι σε mm (Nestor convention).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-456-structural-quantities-reinforcement.md
 */

/** Διαμήκης (κατακόρυφος) οπλισμός κολώνας — π.χ. 4Ø16. */
export interface ColumnLongitudinalRebar {
  /** Διάμετρος ράβδου (mm), π.χ. 16. */
  readonly diameterMm: number;
  /** Πλήθος ράβδων στη διατομή, π.χ. 4. */
  readonly count: number;
}

/**
 * Τύπος εγκάρσιου οπλισμού (μορφή συνδετήρα). Επηρεάζει ποσότητα χάλυβα, σχεδίαση
 * 2Δ/3Δ και τον συντελεστή περίσφιγξης (στατική):
 *   - `closed-hooked`  — κλειστός συνδετήρας με γάντζους 135° + μάτιση/επικάλυψη
 *                        (πρότυπο αντισεισμικό EC8 §5.4.3 / ΕΑΚ). DEFAULT.
 *   - `closed-welded`  — κλειστό συγκολλητό δαχτυλίδι (χωρίς γάντζους — λιγότερο
 *                        σίδερο· η συγκόλληση οπλισμού περιορίζεται αντισεισμικά).
 *   - `spiral`         — σπειροειδής/συνεχής (θώρακας) — ΜΙΑ ράβδος σαν έλικα·
 *                        διαφορετικό μήκος + καλύτερη περίσφιγξη.
 */
export type StirrupType = 'closed-hooked' | 'closed-welded' | 'spiral';

/** Όλοι οι τύποι, με τη σειρά εμφάνισης στο UI (default πρώτος). */
export const STIRRUP_TYPE_ORDER: readonly StirrupType[] = ['closed-hooked', 'closed-welded', 'spiral'];

/** Default τύπος όταν `type` απών (back-compat: standard αντισεισμικό). */
export const DEFAULT_STIRRUP_TYPE: StirrupType = 'closed-hooked';

/** Type guard για persisted/UI τιμές. */
export function isStirrupType(v: string): v is StirrupType {
  return v === 'closed-hooked' || v === 'closed-welded' || v === 'spiral';
}

/**
 * Μοτίβο εσωτερικών συνδετηρίων (cross-ties) για τις ενδιάμεσες διαμήκεις ράβδους
 * (EC8 §5.4.3.2.2(11)). Επηρεάζει ΜΟΝΟ τη σχεδίαση/ποσότητα του εγκάρσιου οπλισμού:
 *   - `auto`    — υβριδικό: διαμάντι όταν υπάρχει 1 ενδιάμεση ανά πλευρά, αλλιώς
 *                 πλέγμα ευθύγραμμων ties (default, Revit-grade).
 *   - `diamond` — εξαναγκασμένο εσωτερικό διαμαντοειδές στεφάνι (rotated square).
 *   - `grid`    — εξαναγκασμένο πλέγμα ευθύγραμμων cross-ties.
 */
export type CrossTiePattern = 'auto' | 'diamond' | 'grid';

/** Όλα τα μοτίβα, με τη σειρά εμφάνισης στο UI (default πρώτο). */
export const CROSS_TIE_PATTERN_ORDER: readonly CrossTiePattern[] = ['auto', 'diamond', 'grid'];

/** Default μοτίβο όταν `crossTiePattern` απών (back-compat: υβριδικό auto). */
export const DEFAULT_CROSS_TIE_PATTERN: CrossTiePattern = 'auto';

/** Type guard για persisted/UI τιμές. */
export function isCrossTiePattern(v: string): v is CrossTiePattern {
  return v === 'auto' || v === 'diamond' || v === 'grid';
}

/** Εγκάρσιος οπλισμός — συνδετήρες/στέφανα (Ø8/100-200). */
export interface ColumnStirrups {
  /** Διάμετρος συνδετήρα (mm), π.χ. 8. */
  readonly diameterMm: number;
  /** Βήμα στη μεσαία (μη-κρίσιμη) ζώνη (mm), π.χ. 200. */
  readonly spacingMm: number;
  /**
   * Βήμα πύκνωσης στις κρίσιμες περιοχές άκρων (mm), π.χ. 100 (EC8 §5.4.3.2.2).
   * Absent = χωρίς πύκνωση (μη-αντισεισμικός / απλός σχεδιασμός).
   */
  readonly spacingCriticalMm?: number;
  /**
   * Μορφή συνδετήρα. Absent ⇒ {@link DEFAULT_STIRRUP_TYPE} (`closed-hooked` —
   * back-compat: ο υπάρχων οπλισμός είναι το πρότυπο αντισεισμικό).
   */
  readonly type?: StirrupType;
}

/**
 * Πλήρης οπλισμός ορθογωνικής κολώνας. Optional/non-breaking στο `ColumnParams`
 * (absent = δεν έχει οριστεί οπλισμός ακόμα — μόνο ποσότητες σκυροδέματος).
 */
export interface ColumnReinforcement {
  readonly longitudinal: ColumnLongitudinalRebar;
  readonly stirrups: ColumnStirrups;
  /** Επικάλυψη οπλισμού cnom (mm), EN 1992-1-1 §4.4.1. Default 30. */
  readonly coverMm: number;
  /**
   * Μοτίβο εσωτερικών συνδετηρίων (cross-ties). Absent ⇒ {@link DEFAULT_CROSS_TIE_PATTERN}
   * (`auto` — υβριδικό). Καθαρά detailing/σχεδίαση — δεν αλλάζει διαμήκη/ρ.
   */
  readonly crossTiePattern?: CrossTiePattern;
}
