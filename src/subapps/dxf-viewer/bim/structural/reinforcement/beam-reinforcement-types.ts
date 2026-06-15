/**
 * Beam reinforcement data model (ADR-459 Phase 4a — auto-reinforcement οργανισμού).
 *
 * Mirror του `column-reinforcement-types.ts` για **δοκάρια**. Σε αντίθεση με την
 * κολόνα (συμμετρικός περιμετρικός οπλισμός), το δοκάρι έχει **δύο στρώσεις**
 * διαμήκων: κάτω (εφελκυσμός μέσου ανοίγματος) + άνω (στηρίξεις / αναρτήρες) +
 * συνδετήρες διάτμησης. Pure type module — zero deps (importable από `beam-types`).
 *
 * Η οπλισμός = user-editable / code-suggested INTENT (persisted, optional). Οι
 * derived ποσότητες (μήκη/βάρος/ρ) υπολογίζονται on-demand από
 * `beam-reinforcement-compute.ts` — ΠΟΤΕ αποθηκεύονται (geometry-is-SSoT).
 *
 * Units: όλα τα μήκη/διάμετροι σε mm (Nestor convention).
 *
 * @see ./column-reinforcement-types.ts — ο δίδυμος της κολόνας
 * @see ./beam-reinforcement-compute.ts — οι derived ποσότητες
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 4
 */

import { DEFAULT_STIRRUP_TYPE, type StirrupType } from './column-reinforcement-types';

export { DEFAULT_STIRRUP_TYPE };
export type { StirrupType };

/** Μία στρώση διαμήκων ράβδων δοκαριού — π.χ. 3Ø16. */
export interface BeamRebarLayer {
  /** Διάμετρος ράβδου (mm), π.χ. 16. */
  readonly diameterMm: number;
  /** Πλήθος ράβδων στη στρώση, π.χ. 3. */
  readonly count: number;
}

/** Εγκάρσιος οπλισμός δοκαριού — συνδετήρες διάτμησης (Ø8/100-200, δίτμητοι). */
export interface BeamStirrups {
  /** Διάμετρος συνδετήρα (mm), π.χ. 8. */
  readonly diameterMm: number;
  /** Βήμα στη μεσαία (μη-κρίσιμη) ζώνη ανοίγματος (mm), π.χ. 200. */
  readonly spacingMm: number;
  /**
   * Βήμα πύκνωσης στις κρίσιμες περιοχές άκρων (mm), π.χ. 100 (EC8 §5.4.3.1.2).
   * Absent = χωρίς πύκνωση (μη-αντισεισμικός / απλός σχεδιασμός).
   */
  readonly spacingCriticalMm?: number;
  /** Πλήθος σκελών συνδετήρα (default {@link DEFAULT_BEAM_STIRRUP_LEGS} = 2). */
  readonly legs?: number;
  /** Μορφή συνδετήρα. Absent ⇒ {@link DEFAULT_STIRRUP_TYPE} (`closed-hooked`). */
  readonly type?: StirrupType;
}

/**
 * Πλήρης οπλισμός ορθογωνικής δοκού. Optional/non-breaking στο `BeamParams`
 * (absent = δεν έχει οριστεί οπλισμός ακόμα — μόνο ποσότητες σκυροδέματος).
 */
export interface BeamReinforcement {
  /** Κάτω διαμήκης (κύριος εφελκυσμός μέσου ανοίγματος). */
  readonly bottom: BeamRebarLayer;
  /** Άνω διαμήκης (στηρίξεις / αναρτήρες συνδετήρων). */
  readonly top: BeamRebarLayer;
  /** Συνδετήρες διάτμησης. */
  readonly stirrups: BeamStirrups;
  /** Επικάλυψη οπλισμού cnom (mm), EN 1992-1-1 §4.4.1. */
  readonly coverMm: number;
}

/** Default σκέλη συνδετήρα δοκού όταν `legs` απών (δίτμητος — back-compat). */
export const DEFAULT_BEAM_STIRRUP_LEGS = 2;

/** Σύντομη ετικέτα στρώσης — π.χ. «3Ø16» (μελετητική σύμβαση). */
export function formatBeamLayerLabel(layer: BeamRebarLayer): string {
  return `${layer.count}Ø${layer.diameterMm}`;
}
