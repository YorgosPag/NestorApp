/**
 * SSoT των scalar πεδίων μιας σκάλας Τέκτονα, σε **μονάδες Τέκτονα** (μέτρα, χωρίς μετατροπή).
 *
 * Κοινό και για το import (`TekStairRecord`, read-side) και για το export (`TekStair`, write-side):
 * και οι δύο πλευρές περιγράφουν ΤΑ ΙΔΙΑ `<stair>` πεδία (`<start_elevation>` … `<steps_numbering>`).
 * Extract-to-one (ADR-584 / N.18): αντί για δίδυμα interfaces, οι δύο πλευρές κάνουν `extends`
 * αυτού και προσθέτουν μόνο τα δικά τους πεδία (rawXml/polylines στο import· id/geometry στο export).
 */
export interface TekStairScalars {
  /** `<start_elevation>` — στάθμη βάσης (μέτρα). */
  readonly startElevationM: number;
  /** `<end_elevation>` — στάθμη κορυφής/άφιξης (= βάση + συνολικό ύψος) (μέτρα). */
  readonly endElevationM: number;
  /** `<steps>` — πλήθος πατημάτων όπως τα μετρά ο Τέκτων (= ρίχτια − 1). */
  readonly steps: number;
  /** `<landings>` — πλήθος πλατύσκαλων. */
  readonly landings: number;
  /** `<stair_width>` — καθαρό πλάτος σκάλας (μέτρα). */
  readonly stairWidthM: number;
  /** `<horiz_b>` — πάτημα/going ανά βαθμίδα (μέτρα). */
  readonly treadGoingM: number;
  /** `<vert_b>` — ρίχτι/riser ανά βαθμίδα (μέτρα). */
  readonly riserHeightM: number;
  /** `<slope_h>` — πάχος πλάκας/μηρού της κλίσης (μέτρα). */
  readonly waistThicknessM: number;
  /** `<wlength>` — ανάπτυγμα γραμμής πορείας (μέτρα). */
  readonly walklineLengthM: number;
  /** `<min_step_width>` — ελάχιστο πλάτος ελικοειδούς βαθμίδας (μέτρα). > 0 ⇒ winders. */
  readonly minStepWidthM: number;
  /** `<steps_numbering>` — αν ο Τέκτων αριθμεί τις βαθμίδες. */
  readonly stepsNumbering: boolean;
}
