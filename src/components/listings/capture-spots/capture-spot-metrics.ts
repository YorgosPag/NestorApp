/**
 * @fileoverview **Τα μεγέθη των συμβόλων πάνω στην κάτοψη** — σε μονάδες της **εικόνας** (ADR-897).
 * @related CaptureSpotLayer.tsx · CaptureSpotEditSurface.tsx
 * @module components/listings/capture-spots/capture-spot-metrics
 *
 * 🔑 **Ανάλογα με την εικόνα, όχι σταθερά pixel οθόνης** — όπως τα τετράγωνα της Zillow: μεγαλώνουν μαζί με την κάτοψη,
 * άρα στέκονται σωστά ως προς τους τοίχους σε κάθε μέγεθος πάνελ, χωρίς μέτρηση επιφάνειας (`ResizeObserver`) και
 * χωρίς επανασχεδίαση στο resize. Η βάση είναι η **μεγάλη** πλευρά, ώστε μια στενόμακρη κάτοψη να μη βγάζει σημεία-σκόνη.
 */

import { radToDeg } from '@/lib/geometry/angle';

export interface CaptureSpotMetrics {
  /** Ακτίνα του σημείου που δεν είναι τρέχον. */
  readonly dot: number;
  /** Ακτίνα του τρέχοντος — μεγαλύτερο, ώστε η διάκριση να μην είναι μόνο χρώμα (CHECK 3.41). */
  readonly current: number;
  /** Μήκος του κώνου του τρέχοντος. */
  readonly cone: number;
  /** Μήκος της μικρής «μύτης» κατεύθυνσης των υπόλοιπων — βλέπεις προς τα πού κοιτάζει κάθε φωτογραφία. */
  readonly notch: number;
  /** Πάχος γραμμής. */
  readonly stroke: number;
  /** Ακτίνα των λαβών του επεξεργαστή (στόχος, όρια πεδίου). */
  readonly handle: number;
}

const DOT_FRACTION = 0.011;
const CURRENT_FRACTION = 0.016;
const CONE_FRACTION = 0.11;
const NOTCH_FRACTION = 0.03;
const STROKE_FRACTION = 0.0035;
const HANDLE_FRACTION = 0.012;

export function captureSpotMetrics(image: { readonly width: number; readonly height: number }): CaptureSpotMetrics {
  const base = Math.max(image.width, image.height, 1);
  return {
    dot: base * DOT_FRACTION,
    current: base * CURRENT_FRACTION,
    cone: base * CONE_FRACTION,
    notch: base * NOTCH_FRACTION,
    stroke: base * STROKE_FRACTION,
    handle: base * HANDLE_FRACTION,
  };
}

/** `transform` του SVG για σύμβολο στο `(x, y)` εικόνας, στραμμένο κατά `headingRad` (0 = πάνω, δεξιόστροφα). */
export function spotTransform(x: number, y: number, headingRad: number): string {
  return `translate(${x} ${y}) rotate(${radToDeg(headingRad)})`;
}
