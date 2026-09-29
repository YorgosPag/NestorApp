/**
 * @fileoverview **ΤΙ ΖΗΤΑ ΚΑΙ ΤΙ ΑΠΑΝΤΑ Ο ΑΝΙΧΝΕΥΤΗΣ ΧΩΡΩΝ** (ADR-884 §4.14 Γ3 · §12 Δ8.1–Δ8.2). Καθαροί τύποι.
 * @module lib/spatial-tour/space-detect/space-detect-types
 *
 * 📏 Όλες οι συντεταγμένες είναι **pixel της εικόνας που αναλύεται** (αρχή πάνω-αριστερά, `y` προς τα κάτω). Ο καλών
 * μεταφράζει σε μέτρα κάτοψης με το `imagePixelToPlan` και τα μέτρα/pixel **εκείνης** της εικόνας (όχι του πρωτοτύπου
 * — βλ. ADR-884 Β1 σφάλμα (ε), 17% λάθος από παράγωγο 1024 έναντι πρωτοτύπου 1200).
 */

import type { PixelPoint } from '@/lib/geometry/scale-calibration';

/** Νοητή διαχωριστική γραμμή (Revit «Room Separation Line», Δ8.2) — ο ανιχνευτής τη βλέπει ως τοίχο. */
export interface SeparationSegment {
  readonly a: PixelPoint;
  readonly b: PixelPoint;
}

/** Η εικόνα όπως τη δίνει το `getImageData` (RGBA, γραμμή-προς-γραμμή). */
export interface PlanRaster {
  readonly rgba: Uint8ClampedArray | Uint8Array;
  readonly width: number;
  readonly height: number;
}

export interface SpaceDetectOptions {
  /**
   * Φαρδύτερο άνοιγμα που «σφραγίζεται» ως πόρτα (m). Ρυθμιστικό του επεξεργαστή. Προεπιλογή **1,0**, όχι 0,9: μια
   * πόρτα 0,9 m ακριβώς στο κατώφλι κρίνεται στο μισό pixel — οι συνήθεις πόρτες (0,7–0,9) πρέπει να κλείνουν με
   * περιθώριο. Ανοίγματα πάνω από αυτό = ενιαίος χώρος (Δ8.2).
   */
  readonly doorWidthM: number;
  /** Ελάχιστο πάχος τοίχου (m): γραμμές λεπτότερες (κείμενα, διαστάσεις, έπιπλα) δεν μετρούν ως τοίχος. */
  readonly minWallThicknessM: number;
  /** Ανοχή Douglas–Peucker (m). */
  readonly simplifyToleranceM: number;
  /** Χώρος κάτω από αυτό το εμβαδόν (m²) δεν είναι χώρος (γράμμα, σύμβολο). */
  readonly minAreaM2: number;
  /** Πόσο μακριά (m) ψάχνεται ελεύθερο pixel όταν το κλικ πέσει πάνω σε γραμμή. */
  readonly seedSearchM: number;
}

export const DEFAULT_SPACE_DETECT: SpaceDetectOptions = {
  doorWidthM: 1.0,
  minWallThicknessM: 0.06,
  simplifyToleranceM: 0.05,
  minAreaM2: 0.5,
  seedSearchM: 0.3,
};

export interface SpaceDetectInput {
  readonly raster: PlanRaster;
  /** Μέτρα ανά pixel **αυτής** της εικόνας. */
  readonly metresPerPixel: number;
  /** Πού πάτησε ο άνθρωπος (ή η θέση του σημείου λήψης). */
  readonly seed: PixelPoint;
  /** Υπάρχουσες νοητές γραμμές του ορόφου. */
  readonly separations: readonly SeparationSegment[];
  /** Οι θέσεις **των άλλων** σημείων λήψης του ορόφου — για την πρόταση διαχωρισμού (Δ8.2). */
  readonly otherStops: readonly PixelPoint[];
  readonly options?: Partial<SpaceDetectOptions>;
}

/** Η ερώτηση **χωρίς** την εικόνα — ό,τι αλλάζει από κλικ σε κλικ πάνω στην **ίδια** προετοιμασμένη κάτοψη. */
export type SpaceDetectQuery = Omit<SpaceDetectInput, 'raster'>;

/**
 * Η κάτοψη **έτοιμη** για ανίχνευση: το μελάνι (Otsu) υπολογίζεται **μία** φορά ανά εικόνα — κάθε κλικ, κάθε βήμα του
 * ρυθμιστικού πόρτας ξαναχρησιμοποιεί την ίδια (Γ3γ-2α, Worker με κρυφή μνήμη).
 */
export interface PreparedPlanRaster {
  readonly ink: Uint8Array;
  readonly width: number;
  readonly height: number;
}

/** Γιατί δεν βγήκε περίγραμμα — κλειστό λεξιλόγιο, ο επεξεργαστής το μεταφράζει. */
export type SpaceDetectRefusal =
  | 'uncalibrated'      // χωρίς μέτρα/pixel δεν ξέρουμε πόσο είναι μια πόρτα
  | 'seed-outside'      // κλικ εκτός εικόνας
  | 'seed-on-wall'      // κλικ πάνω σε τοίχο, χωρίς ελεύθερο pixel κοντά
  | 'leak'              // ο χώρος ακουμπά το κάδρο της εικόνας (βγήκε έξω από το σπίτι)
  | 'too-small';        // γράμμα, σύμβολο, κουτί επίπλου

/** Πρόταση νοητής γραμμής: το **στενότερο σημείο** ανάμεσα σε δύο σημεία λήψης του ίδιου ενιαίου χώρου. */
export interface SeparationSuggestion {
  readonly segment: SeparationSegment;
  /** Πλάτος του ανοίγματος (pixel) — ο επεξεργαστής το δείχνει σε μέτρα («άνοιγμα 2,1 m»). */
  readonly widthPx: number;
  /** Ποιο από τα `otherStops` μοιράζεται τον χώρο. */
  readonly otherStopIndex: number;
}

export type SpaceDetectResult =
  | {
      readonly ok: true;
      /** Περίγραμμα (pixel, ανοιχτός δακτύλιος, ≥ 3 κορυφές). */
      readonly outline: readonly PixelPoint[];
      /** `true` όταν πέρασε η ορθογώνια έλξη· `false` = απλοποιημένο περίγραμμα (λοξοί τοίχοι, καμπύλες). */
      readonly orthogonal: boolean;
      readonly areaPx: number;
      /** Δ8.2 — μόνο όταν ο ενιαίος χώρος περιέχει κι άλλο σημείο λήψης. */
      readonly separation: SeparationSuggestion | null;
    }
  | { readonly ok: false; readonly refusal: SpaceDetectRefusal };
