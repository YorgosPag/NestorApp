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
}
