/**
 * ADR-652 M6 — «Επιλογή σημείου βάσης» για «Δημιουργία Block»: ΕΝΑ κλικ (snapped) γράφει το world
 * σημείο ως base point του υπό-δημιουργία block (AutoCAD «Specify base point»).
 *
 * Ζει σε δικό του module (ίδιο idiom με `canvas-click-geo-ref.ts`) — το wiring μένει ΕΝΑ branch στο
 * `useCanvasClickHandler`. Το `worldPoint` φτάνει ΗΔΗ snapped στο πλησιέστερο χαρακτηριστικό (κεντρικό
 * `findSnapPoint` στο mouse-up), οπότε ο χρήστης πιάνει ακριβώς τη γωνία/κόμβο που θέλει· καμία
 * επιπλέον γεωμετρία εδώ — μόνο capture. Πάντα consume όσο είναι armed (το gating γίνεται από τον
 * caller μέσω {@link isPickBasePointArmed}), ώστε να ΜΗΝ πέσει σε grips/drawing/selection.
 *
 * @see ../../systems/block/pick-base-point-store.ts — capturePickBasePoint
 */

import type { Point2D } from '../../rendering/types/Types';
import { capturePickBasePoint } from '../../systems/block/pick-base-point-store';
import type { UseCanvasClickHandlerParams } from './canvas-click-types';

/** Capture το (snapped) world σημείο ως base point. Πάντα consume το κλικ. */
export function handlePickBasePointClick(
  worldPoint: Point2D,
  _p: UseCanvasClickHandlerParams,
): boolean {
  capturePickBasePoint(worldPoint);
  return true;
}
