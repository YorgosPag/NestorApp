/**
 * @module systems/guides/guide-parallel-ghost
 * @description SSoT για τη ΓΕΩΜΕΤΡΙΑ του φαντάσματος-οδηγού στη ροή «Παράλληλος»
 *              (ADR-189 §3.13). Μία πηγή και για τους δύο άξονες.
 * @see ADR-189 (Construction Grid & Guide System)
 * @since 2026-07-18
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ:
 * 1. Το κάθετο μοναδιαίο διάνυσμα `n = (-dy, dx)/len` υπολογιζόταν σε ΤΡΙΑ σημεία
 *    (εδώ, στο `resolveParallelSide`, και μέσα στην `CreateParallelGuideCommand`).
 *    Το `perpendicularNormal` το κάνει μία φορά.
 * 2. Όσο ο χρήστης ΠΛΗΚΤΡΟΛΟΓΕΙ απόσταση, το φάντασμα ακολουθούσε τον ΚΕΡΣΟΡΑ αντί
 *    της τιμής που έγραφε → η προεπισκόπηση διαφωνούσε με το αποτέλεσμα του Enter.
 *    Το `typedDistance` κλειδώνει το φάντασμα στην πληκτρολογημένη τιμή (WYSIWYG).
 *
 * ΣΥΜΒΑΣΗ ΠΡΟΣΗΜΟΥ — μην την αλλάξεις χωρίς `guide-parallel-side.test.ts`:
 * η πλευρά έρχεται ΠΑΝΤΑ από το `resolveParallelSide` (ίδιος χώρος με το commit).
 * Για XZ ισχύει αλγεβρικά `sign(cx·nx + cy·ny) === resolveParallelSide(...)`, αφού
 * `cx·(-dy/len) + cy·(dx/len) = (cy·dx − cx·dy)/len` — ίδιος αριθμητής, θετικός
 * παρονομαστής. Άρα οι δύο κλάδοι παρακάτω δεν μπορούν να αποκλίνουν.
 */

import { resolveParallelSide } from './guide-parallel-side';
import type { Guide, Point2D } from './guide-types';

/** Το κάθετο μοναδιαίο διάνυσμα ενός διαγώνιου οδηγού· `null` αν είναι εκφυλισμένος. */
export function perpendicularNormal(startPoint: Point2D, endPoint: Point2D): Point2D | null {
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  return { x: -dy / len, y: dx / len };
}

/**
 * Το `offset` του φαντάσματος για οδηγό άξονα X ή Y.
 *
 * - Χωρίς πληκτρολογημένη τιμή → ακολουθεί τον κέρσορα (ελεύθερη σάρωση).
 * - Με πληκτρολογημένη τιμή → κουμπώνει στο `refGuide.offset ± typedDistance`,
 *   ακριβώς όπως θα το τοποθετήσει το Enter.
 */
export function resolveParallelGhostOffset(
  refGuide: Guide,
  cursor: Point2D,
  typedDistance: number | null,
): number {
  if (typedDistance !== null) {
    return refGuide.offset + resolveParallelSide(refGuide, cursor) * typedDistance;
  }
  return refGuide.axis === 'X' ? cursor.x : cursor.y;
}

/** Τα δύο άκρα του διαγώνιου φαντάσματος· `null` αν ο οδηγός δεν είναι έγκυρος XZ. */
export function resolveParallelGhostDiagonal(
  refGuide: Guide,
  cursor: Point2D,
  typedDistance: number | null,
): { start: Point2D; end: Point2D } | null {
  if (refGuide.axis !== 'XZ' || !refGuide.startPoint || !refGuide.endPoint) return null;
  const n = perpendicularNormal(refGuide.startPoint, refGuide.endPoint);
  if (!n) return null;

  const perpDist = typedDistance !== null
    ? resolveParallelSide(refGuide, cursor) * typedDistance
    : (cursor.x - refGuide.startPoint.x) * n.x + (cursor.y - refGuide.startPoint.y) * n.y;

  return {
    start: { x: refGuide.startPoint.x + n.x * perpDist, y: refGuide.startPoint.y + n.y * perpDist },
    end: { x: refGuide.endPoint.x + n.x * perpDist, y: refGuide.endPoint.y + n.y * perpDist },
  };
}
