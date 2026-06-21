/**
 * VIEWPORT SCALE UTILITIES — pure, zero-import leaf SSoT (ADR-508, 2026-06-21).
 *
 * The viewport transform `scale` = screen pixels per world unit. Converting a
 * screen-pixel quantity to world units (and the special case "world units per one
 * pixel") was an inline idiom repeated across the drawing/tracking/rulers code:
 *
 *     1 / Math.max(scale, 0.001)            // world units per pixel
 *     somePx / Math.max(scale, 0.001)       // screen px → world units
 *
 * The `Math.max(scale, 0.001)` clamp guards a degenerate / not-yet-initialised
 * transform (scale 0 ⇒ Infinity). Centralised here so the clamp constant + the
 * conversion live in ONE place (no scattered magic `0.001`).
 *
 * Zero imports = cycle-proof leaf (any module may use it).
 */

/** Minimum view scale used to guard division by a degenerate (≈0) transform. */
export const MIN_VIEW_SCALE = 0.001;

/** World units spanned by ONE screen pixel at the given transform `scale`. */
export function worldPerPixel(scale: number): number {
  return 1 / Math.max(scale, MIN_VIEW_SCALE);
}

/** Convert a screen-pixel length to world units at the given transform `scale`. */
export function pixelsToWorld(px: number, scale: number): number {
  return px / Math.max(scale, MIN_VIEW_SCALE);
}
