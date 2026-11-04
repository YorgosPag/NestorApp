/**
 * =============================================================================
 * ΛΟΞΕΣ ΖΩΝΕΣ — Η ΙΔΙΑ ΜΗΧΑΝΗ ΖΩΝΩΝ ΣΕ ΟΠΟΙΑΔΗΠΟΤΕ ΓΩΝΙΑ (SSoT)
 * =============================================================================
 *
 * Οι ζώνες αξόνων (`axis-bands.ts`) βλέπουν μόνο 0°/90°. Ένας λοξός τοίχος (45° σε γωνιακό κτίριο, τοίχος σε κάτοψη
 * που ακολουθεί οικόπεδο) **δεν σβήνεται** (ADR-929 Φ2). Αντί για δεύτερο ανιχνευτή με άλλη σημασιολογία (LSD: ακμές
 * αντί για μέση γραμμή και πάχος), το μελάνι **στρέφεται** ώστε η λοξή διεύθυνση να γίνει οριζόντια και τρέχει η
 * **ίδια** μηχανή ζωνών. Πινελιά/γέμισμα, πάχος υπο-pixel και άκρα έχουν έτσι ίδιο νόημα σε κάθε γωνία.
 *
 * - {@link dominantObliqueDirection}: η κυρίαρχη λοξή γωνία. Το μελάνι στρέφεται κατά 45° και το **υπάρχον**
 *   `estimateSkew` ψάχνει σε ±(45° − εξαίρεση). Οι άξονες (0°/90°) πέφτουν έτσι **έξω** από το εύρος αναζήτησης, χωρίς
 *   ειδική περίπτωση.
 * - {@link bandsAtAngle}: οι ζώνες στη γωνία `θ` (οριζόντιες) και `θ + 90°` (κατακόρυφες), με την ομογραφία
 *   στραμμένο πλαίσιο → πηγή.
 *
 * Μάσκα με πλησιέστερο γείτονα: η περιστροφή είναι ισομετρία, άρα πάχη και μήκη μένουν σε px της πηγής.
 *
 * @module lib/geometry/raster/oblique-bands
 * @see docs/centralized-systems/reference/adrs/ADR-929-raster-plan-recognition.md §6.3
 */

import type { Homography } from '../homography';
import { axisBands, type AxisBand, type AxisBandOptions } from './axis-bands';
import { straighteningRotation, warpMask } from './raster-warp';
import { DEFAULT_SKEW_ESTIMATE, estimateSkew } from './skew-estimate';

export interface ObliqueDirection {
  /** Γωνία των ευθειών (raster-px, `+x → +y`), στο `[45° − (45° − εξαίρεση), 45° + (45° − εξαίρεση)]`. */
  readonly angleDeg: number;
  readonly confidence: number;
}

/**
 * Η κυρίαρχη **λοξή** διεύθυνση της μάσκας: τουλάχιστον `axisExclusionDeg` μακριά από τους άξονες. Επειδή οι ζώνες
 * βλέπουν `θ` και `θ + 90°` μαζί, αρκεί το εύρος γύρω από τις 45°.
 */
export function dominantObliqueDirection(
  mask: Uint8Array, cols: number, rows: number, axisExclusionDeg: number,
): ObliqueDirection {
  const rot = straighteningRotation(cols, rows, 45);
  const turned = warpMask(mask, cols, rows, rot.outputToInput, rot.width, rot.height);
  const est = estimateSkew(turned, rot.width, rot.height, {
    ...DEFAULT_SKEW_ESTIMATE,
    maxAngleDeg: 45 - axisExclusionDeg,
  });
  return { angleDeg: 45 + est.angleDeg, confidence: est.confidence };
}

export interface RotatedBands {
  readonly angleDeg: number;
  /** Σε px του **στραμμένου** πλαισίου: `horizontal` = γωνία `θ`, `vertical` = `θ + 90°`. */
  readonly bands: readonly AxisBand[];
  /** Στραμμένο πλαίσιο → πηγή. */
  readonly toSource: Homography;
  readonly width: number;
  readonly height: number;
  /** Η στραμμένη μάσκα (για σβήσιμο των ζωνών που κρατήθηκαν). */
  readonly mask: Uint8Array;
}

/** Οι ζώνες της μάσκας στη γωνία `angleDeg` και στην κάθετή της. */
export function bandsAtAngle(
  mask: Uint8Array, cols: number, rows: number, angleDeg: number, options: AxisBandOptions,
): RotatedBands {
  const rot = straighteningRotation(cols, rows, angleDeg);
  const turned = warpMask(mask, cols, rows, rot.outputToInput, rot.width, rot.height);
  return {
    angleDeg,
    bands: [
      ...axisBands(turned, rot.width, rot.height, 'horizontal', options),
      ...axisBands(turned, rot.width, rot.height, 'vertical', options),
    ],
    toSource: rot.outputToInput,
    width: rot.width,
    height: rot.height,
    mask: turned,
  };
}
