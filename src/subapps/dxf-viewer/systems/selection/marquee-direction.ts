/**
 * marquee-direction.ts — SSoT for the AutoCAD/Revit "window vs crossing" verdict.
 *
 * The rule is drag-DIRECTION based and identical in 2D and 3D:
 *   • left → right  (endX ≥ startX)  ⇒ WINDOW   — select only fully-enclosed items
 *   • right → left  (endX <  startX) ⇒ CROSSING — select anything the box touches
 *
 * Historically this `startX > endX` comparison lived inline in
 * `UniversalMarqueeSelection.performSelection` (the 2D path). The 3D marquee
 * (ADR-692) needs the EXACT same verdict; extracting it here keeps a single
 * source of truth instead of a second, drifting copy (N.18 anti-clone).
 */

export type MarqueeSelectionType = 'window' | 'crossing';

/**
 * TRUE when the drag goes right-to-left ⇒ crossing (touch) selection.
 * Screen X grows to the right, so `endX < startX` means the pointer moved left.
 */
export function isCrossingDrag(startX: number, endX: number): boolean {
  return startX > endX;
}

/** The named selection mode for a given horizontal drag direction. */
export function getMarqueeSelectionType(startX: number, endX: number): MarqueeSelectionType {
  return isCrossingDrag(startX, endX) ? 'crossing' : 'window';
}
