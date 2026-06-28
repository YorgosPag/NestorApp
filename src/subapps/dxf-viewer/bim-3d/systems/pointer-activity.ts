/**
 * pointer-activity.ts — zero-dependency «cursor is moving right now» signal (ADR-040 / ADR-452).
 *
 * THE PROBLEM (Firefox/Chrome trace 2026-06-28, active axis-cut): while the cursor moves over the
 * 3D viewport, each hover-id change marks the scene dirty → a full `renderFrameWithCaps`. With a
 * section/axis cut active and the camera SETTLED, that frame is `'full'` quality, which re-renders
 * the whole BIM scene 2×(1+N_colours) times for the coloured cut caps — ~20% of the frame, on every
 * hover frame. The crosshair «swam».
 *
 * THE FIX: treat a moving cursor as a motion signal, exactly like camera orbit/zoom (which already
 * drops the caps to the cheap grey `'fast'` tier, Giorgio «γκρι στην κίνηση» 2026-06-26). The
 * section controller folds {@link isPointerActive} into its quality ladder; the existing
 * refine-on-settle timer snaps the coloured `'full'` caps back the instant the cursor stops.
 *
 * This is a tiny leaf module (no imports) so BOTH the pointer scheduler (viewport layer) and the
 * section controller (scene layer) can read it without a cross-layer import cycle.
 *
 * @module bim-3d/systems/pointer-activity
 */

let lastMoveMs = 0;

/** Record that the cursor moved over the 3D viewport. Called per move by the pointer scheduler. */
export function markPointerMoved(nowMs: number): void {
  lastMoveMs = nowMs;
}

/**
 * True when the cursor moved within the last `settleMs` — i.e. the user is actively sweeping the
 * pointer and a momentarily-lighter render is acceptable. `settleMs` should be shorter than the
 * section refine delay so the refine frame (fired after the cursor stops) reads as settled.
 */
export function isPointerActive(nowMs: number, settleMs: number): boolean {
  return nowMs - lastMoveMs < settleMs;
}
