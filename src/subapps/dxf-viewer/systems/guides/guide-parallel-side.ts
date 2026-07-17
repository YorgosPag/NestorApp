/**
 * @module systems/guides/guide-parallel-side
 * @description SSoT για την πλευρά του παράλληλου οδηγού (ADR-189 §3.x).
 * @see ADR-189 (Construction Grid & Guide System)
 * @since 2026-07-17
 */

import type { Guide, Point2D } from './guide-types';

/**
 * Το πρόσημο που δίνει `CreateParallelGuideCommand` για να τοποθετηθεί ο νέος
 * οδηγός στην ΙΔΙΑ πλευρά με το `worldPoint`.
 *
 * ΣΥΜΒΑΣΗ (μην την αλλάξεις χωρίς να τρέξεις το `guide-parallel-side.test.ts`):
 * το πρόσημο πολλαπλασιάζεται με θετική απόσταση και δίνεται ως `offsetDistance`
 * στην `CreateParallelGuideCommand`, η οποία κάνει `reference.offset + offsetDistance`
 * για X/Y και μετατόπιση κατά `+n * offsetDistance` για XZ, όπου `n = (-dy, dx)/len`.
 *
 * Και η σύγκριση εδώ και η τοποθέτηση εκεί γίνονται στον ΙΔΙΟ χώρο (world/offset).
 * Άρα η φορά του άξονα Y στην οθόνη δεν παίζει ρόλο — απλοποιείται. Γι' αυτό ο Y
 * είναι συμμετρικός με τον X· ΜΗΝ προσθέσεις «διόρθωση» αντιστροφής.
 */
export function resolveParallelSide(guide: Guide, worldPoint: Point2D): 1 | -1 {
  if (guide.axis === 'XZ' && guide.startPoint && guide.endPoint) {
    const dx = guide.endPoint.x - guide.startPoint.x;
    const dy = guide.endPoint.y - guide.startPoint.y;
    const cx = worldPoint.x - guide.startPoint.x;
    const cy = worldPoint.y - guide.startPoint.y;
    // Προβολή του cursor στο κάθετο διάνυσμα n = (-dy, dx) που χρησιμοποιεί η εντολή.
    return cy * dx - cx * dy >= 0 ? 1 : -1;
  }

  return guide.axis === 'X'
    ? (worldPoint.x >= guide.offset ? 1 : -1)
    : (worldPoint.y >= guide.offset ? 1 : -1);
}
