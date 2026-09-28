/**
 * @fileoverview **ΒΑΘΜΟΝΟΜΗΣΗ ΚΛΙΜΑΚΑΣ «ΔΥΟ ΣΗΜΕΙΑ + ΓΝΩΣΤΗ ΑΠΟΣΤΑΣΗ»** — τα καθαρά μαθηματικά, μία φορά (ADR-884 Φ2στ-β ·
 * §4.13 · ADR-340 §3.6).
 * @related `components/shared/files/media/CalibrateScaleDialog.tsx` (η οθόνη) · `lib/spatial-tour/tour-plan-frame.ts`
 *   (η κάτοψη της περιήγησης)
 * @module lib/geometry/scale-calibration
 *
 * 🔑 **Πάντα σε pixel της ΕΙΚΟΝΑΣ, ποτέ της οθόνης.** Η εικόνα ζωγραφίζεται «χωρά χωρίς κόψιμο» (object-contain) μέσα σε
 * κουτί άλλου μεγέθους· ένα κλικ πρέπει να επιστρέψει στο φυσικό pixel της εικόνας **πριν** μετρηθεί απόσταση — αλλιώς η
 * κλίμακα εξαρτάται από το πόσο μεγάλο ήταν το παράθυρο (το σφάλμα που είχε ο διάλογος ως 2026-09-27: μετρούσε σε pixel
 * του καμβά 640×420, ενώ ο καταναλωτής μετρά σε pixel της εικόνας).
 *
 * **Layering**: leaf — καθαρή.
 */

export interface PixelPoint {
  readonly x: number;
  readonly y: number;
}

export interface PixelSize {
  readonly width: number;
  readonly height: number;
}

/** Οι μονάδες που πληκτρολογεί ο άνθρωπος για τη γνωστή απόσταση. */
export const CALIBRATION_UNITS = ['mm', 'cm', 'm'] as const;
export type CalibrationUnit = (typeof CALIBRATION_UNITS)[number];

export const CALIBRATION_UNIT_METRES: Readonly<Record<CalibrationUnit, number>> = { mm: 0.001, cm: 0.01, m: 1 };

/** Κάτω από τόσα pixel εικόνας τα δύο κλικ θεωρούνται ίδιο σημείο — η κλίμακα θα ήταν θόρυβος. */
export const MIN_CALIBRATION_PIXELS = 4;

export function pixelDistance(a: PixelPoint, b: PixelPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * **Pixel εικόνας ανά μέτρο** — ή `null` όταν η μέτρηση δεν στέκει (σημεία σχεδόν ίδια · απόσταση μη θετική/μη πεπερασμένη).
 */
export function pixelsPerMetre(a: PixelPoint, b: PixelPoint, distance: number, unit: CalibrationUnit): number | null {
  const pixels = pixelDistance(a, b);
  const metres = distance * CALIBRATION_UNIT_METRES[unit];
  if (!Number.isFinite(metres) || metres <= 0 || pixels < MIN_CALIBRATION_PIXELS) return null;
  return pixels / metres;
}

/** Πού κάθεται η εικόνα μέσα στο κουτί με «χωρά χωρίς κόψιμο»: κλίμακα + μετατόπιση. */
export function containRect(box: PixelSize, image: PixelSize): { readonly scale: number; readonly left: number; readonly top: number } {
  const scale = Math.min(box.width / image.width, box.height / image.height);
  return { scale, left: (box.width - image.width * scale) / 2, top: (box.height - image.height * scale) / 2 };
}

/**
 * **Σημείο του κουτιού → φυσικό pixel της εικόνας** (αντίστροφο του «χωρά χωρίς κόψιμο»). `null` όταν το κλικ έπεσε στο
 * κενό γύρω από την εικόνα — εκεί δεν υπάρχει σημείο της κάτοψης.
 */
export function boxToImagePoint(point: PixelPoint, box: PixelSize, image: PixelSize): PixelPoint | null {
  const { scale, left, top } = containRect(box, image);
  const x = (point.x - left) / scale;
  const y = (point.y - top) / scale;
  return x < 0 || y < 0 || x > image.width || y > image.height ? null : { x, y };
}

/** **Φυσικό pixel της εικόνας → σημείο του κουτιού** — για να ζωγραφιστεί ξανά ό,τι αποθηκεύτηκε. */
export function imageToBoxPoint(point: PixelPoint, box: PixelSize, image: PixelSize): PixelPoint {
  const { scale, left, top } = containRect(box, image);
  return { x: left + point.x * scale, y: top + point.y * scale };
}
