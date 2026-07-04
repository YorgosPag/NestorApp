/**
 * MoveOrthoAxisStore — active LOCAL ORTHO axis for a whole-entity MOVE drag.
 *
 * ADR-363 §line local-ortho (Giorgio 2026-07-04): όταν πιάνεται η λαβή ΟΛΙΚΗΣ μετακίνησης
 * μιας απλής ΓΡΑΜΜΗΣ (μέσο grip 2 / MOVE-cross grip 4), το F8 ORTHO πρέπει να κλειδώνει τη
 * μετατόπιση στους ΔΙΚΟΥΣ ΤΗΣ άξονες (παράλληλα ∥ / κάθετα ⟂), όχι στο world H/V — ώστε μια
 * λοξή γραμμή να μετακινείται ακριβώς κάθετα στον εαυτό της (offset). Το unit `û` (start→end)
 * αποτυπώνεται ΜΙΑ φορά στην αρχή του drag (μια άκαμπτη μετακίνηση δεν περιστρέφει τη γραμμή)
 * και διαβάζεται imperatively από το constraint SSoT (`grip-move-constraints.applyMoveConstraints`)
 * — η ΙΔΙΑ τιμή στο preview ghost ΚΑΙ στο commit → WYSIWYG.
 *
 * Zero-React imperative singleton (mirror του GripAltMoveStore / GripDragStore). Καθαρίζεται
 * στο τέλος του drag lifecycle (`GripDragStore.clearActiveDragGrip`).
 */
import type { Point2D } from '../../rendering/types/Types';

let activeAxis: Point2D | null = null;

/** Set the unit axis û (γραμμή start→end, normalized) για το ενεργό line whole-move drag. */
export function setMoveOrthoAxis(axis: Point2D): void {
  activeAxis = { x: axis.x, y: axis.y };
}

/** Το ενεργό local-ortho unit axis, ή null (→ το constraint πέφτει πίσω σε world H/V). */
export function getMoveOrthoAxis(): Point2D | null {
  return activeAxis;
}

/** Clear — καλείται από το grip-drag lifecycle SSoT (`clearActiveDragGrip`). */
export function clearMoveOrthoAxis(): void {
  activeAxis = null;
}
