/**
 * ADR-514 §2 (γενίκευση 2026-07-20) — SSoT για «ποιον snap δεσμεύει το commit ενός
 * ΓΕΝΙΚΟΥ εργαλείου σχεδίασης».
 *
 * Το commit των γενικών εργαλείων έκανε δεύτερη, ΑΝΕΞΑΡΤΗΤΗ `findSnapPoint` στο κλικ.
 * Αυτή τρέχει με άλλη είσοδο (ωμό world της στιγμής του κλικ, όχι του τελευταίου tick
 * του scheduler) και από άλλη διαδρομή μηχανής απ' αυτήν που ζωγράφισε τον δείκτη — άρα
 * μπορούσε να προσγειωθεί ΑΛΛΟΥ (μετρημένο: ~2mm δίπλα από τη «γωνία τοίχου» που έδειχνε
 * ο δείκτης). Ίδια ρίζα με το beam/column· εδώ γενικεύεται σε ΟΛΑ τα γενικά εργαλεία.
 *
 * Προτιμά τον armed snap — `getFullSnapResult()`, ακριβώς το αντικείμενο που ρεντάρει ο
 * `SnapIndicatorOverlay` (ό,τι είδε ο χρήστης). Belt-and-suspenders (N.7.2 #4): όταν δεν
 * υπάρχει armed snap ο χρήστης ΔΕΝ είδε δείκτη → `findSnapPoint` ως δίχτυ, ώστε η
 * συμπεριφορά «καμία έλξη οπλισμένη» να μένει bit-for-bit η προηγούμενη.
 *
 * @see systems/cursor/ImmediateSnapStore.ts — armed snap SSoT (getFullSnapResult)
 * @see ADR-040 changelog 2026-07-20 (b)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ProSnapResult } from '../../snapping/extended-types';
import type { FindSnapPoint } from './corner-projection-snap';
import { getFullSnapResult } from './ImmediateSnapStore';

/**
 * Επιστρέφει τον snap που πρέπει να δεσμεύσει το κλικ: τον armed snap αν υπάρχει
 * (WYSIWYG), αλλιώς το αποτέλεσμα του `findSnapPoint` στο σημείο του κλικ.
 */
export function resolveArmedSnapForCommit(
  worldPoint: Point2D,
  findSnapPoint: FindSnapPoint,
): ProSnapResult | null {
  const armed = getFullSnapResult();
  return armed?.found === true && armed.snappedPoint != null
    ? armed // ό,τι είδες — αυτό δεσμεύεται
    : findSnapPoint(worldPoint.x, worldPoint.y); // δίχτυ: κανένας armed snap → ως πριν
}
