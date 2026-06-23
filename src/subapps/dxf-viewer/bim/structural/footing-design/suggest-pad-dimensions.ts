/**
 * suggest-pad-dimensions — SSoT πρότασης διαστάσεων pad πεδίλου κάτω από κολόνα
 * (ADR-459 Phase 2 — proactive «βάλε πέδιλο»).
 *
 * Revit-grade απλοποιημένο sizing (allowable-stress, EC7 service):
 *   1. Ελάχιστο γεωμετρικό: όψη κολόνας + προεξοχή ανά παρειά (detailing).
 *   2. Έδραση (όταν υπάρχουν φορτίο + σ_allow): A_req = N_service / σ_allow →
 *      τετράγωνη πλευρά √A_req (συγκεντρικό φορτίο, μηδέν ροπή — v1).
 *   3. Τελική πλευρά = max(γεωμετρικό, έδρασης, απόλυτο ελάχιστο), στρογγυλεμένη
 *      προς τα πάνω σε module detailing (50 mm).
 *
 * Όταν λείπει φορτίο/σ_allow → πέφτει στο γεωμετρικό ελάχιστο (κολόνα + προεξοχή)
 * ώστε το πέδιλο να υπάρχει πάντα ως αφετηρία (ο μηχανικός το διαστασιολογεί μετά
 * μέσω ADR-464). Pure module — zero deps.
 *
 * @see ./footing-bearing.ts — ο πλήρης EC7 bearing έλεγχος (επαλήθευση μετά)
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 2
 * @see ../sizing/module-rounding.ts — roundUpToModule SSoT (tolerant-ceil)
 */

import { roundUpToModule } from '../sizing/module-rounding';

/** Προεξοχή πεδίλου πέρα από κάθε παρειά κολόνας (mm). */
export const PAD_FACE_OVERHANG_MM = 150;
/** Module στρογγυλοποίησης διαστάσεων (mm). */
export const PAD_SIZE_MODULE_MM = 50;
/** Απόλυτο ελάχιστο πλευράς pad (mm). */
export const PAD_MIN_SIDE_MM = 600;

export interface PadSizingInput {
  /** Πλάτος όψης κολόνας (mm, X). */
  readonly columnWidthMm: number;
  /** Βάθος όψης κολόνας (mm, Y). */
  readonly columnDepthMm: number;
  /** Χαρακτηριστικό αξονικό service φορτίο N = G + Q (kN), αν γνωστό. */
  readonly axialServiceKn?: number;
  /** Επιτρεπόμενη τάση έδρασης εδάφους σ_allow (kPa), αν γνωστή. */
  readonly soilBearingCapacityKpa?: number;
}

export interface PadDimensions {
  readonly widthMm: number;
  readonly lengthMm: number;
}

/** Τετράγωνη πλευρά (mm) από έδραση, ή 0 όταν λείπουν φορτίο/σ_allow. */
function bearingSideMm(input: PadSizingInput): number {
  const n = input.axialServiceKn;
  const sigma = input.soilBearingCapacityKpa;
  if (!n || n <= 0 || !sigma || sigma <= 0) return 0;
  const areaM2 = n / sigma; // kN / kPa = m²
  return Math.sqrt(areaM2) * 1000;
}

/**
 * Πρόταση διαστάσεων pad. Width ακολουθεί τη διάσταση X της κολόνας (+ προεξοχή),
 * length τη Y· η έδραση (αν υπάρχει) ανεβάζει και τα δύο στην ίδια τετράγωνη πλευρά.
 */
export function suggestPadDimensions(input: PadSizingInput): PadDimensions {
  const fromLoad = bearingSideMm(input);
  const widthMm = roundUpToModule(
    Math.max(input.columnWidthMm + 2 * PAD_FACE_OVERHANG_MM, fromLoad, PAD_MIN_SIDE_MM),
    PAD_SIZE_MODULE_MM,
  );
  const lengthMm = roundUpToModule(
    Math.max(input.columnDepthMm + 2 * PAD_FACE_OVERHANG_MM, fromLoad, PAD_MIN_SIDE_MM),
    PAD_SIZE_MODULE_MM,
  );
  return { widthMm, lengthMm };
}
