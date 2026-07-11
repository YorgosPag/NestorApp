/**
 * point-glyph — DXF $PDMODE / $PDSIZE point-marker SSoT (ADR-635 Φάση C).
 *
 * AutoCAD renders every POINT with a drawing-wide glyph controlled by two sysvars:
 *   $PDMODE (bitmask) — the base figure + optional enclosures:
 *     figure = pdmode & 7 → 0 dot · 1 none · 2 plus (+) · 3 cross (X) · 4 tick (↑)
 *     +32 → circle around · +64 → square around  (combine freely, e.g. 35 = X-in-circle)
 *   $PDSIZE (size) — >0 absolute drawing units · 0 = 5% of viewport height ·
 *     <0 = |value|% of viewport height.
 *
 * This module owns ONLY the pure decode + size math (fully unit-testable). The canvas
 * stamping lives in `PointRenderer` (ctx-specific), exactly as the arrowhead SSoT splits
 * decode (`dim-arrowhead-blocks`) from stamping (`dim-arrowhead-renderer`).
 */

export type PointFigure = 'dot' | 'none' | 'plus' | 'cross' | 'tick';

export interface PointGlyphSpec {
  readonly figure: PointFigure;
  /** +32 bit — circle enclosing the figure. */
  readonly circle: boolean;
  /** +64 bit — square enclosing the figure. */
  readonly square: boolean;
}

const FIGURE_BY_LOW: Readonly<Record<number, PointFigure>> = {
  0: 'dot',
  1: 'none',
  2: 'plus',
  3: 'cross',
  4: 'tick',
};

/** Decode a raw $PDMODE bitmask into its figure + enclosures. Unknown low bits → dot. */
export function decodePdMode(pdmode: number): PointGlyphSpec {
  const low = (pdmode | 0) & 0x07;
  return {
    figure: FIGURE_BY_LOW[low] ?? 'dot',
    circle: ((pdmode | 0) & 32) !== 0,
    square: ((pdmode | 0) & 64) !== 0,
  };
}

/**
 * Resolve the FULL screen-space glyph size (px) from $PDSIZE.
 *   pdSize > 0 → absolute drawing units → `pdSize · pxPerWorld`
 *   pdSize = 0 → 5% of the viewport height
 *   pdSize < 0 → |pdSize|% of the viewport height
 * The `dot` figure ignores this (always a small fixed dot) — the caller gates that.
 */
export function resolvePointGlyphSize(
  pdSize: number,
  pxPerWorld: number,
  viewportHeightPx: number,
): number {
  if (pdSize > 0) return pdSize * pxPerWorld;
  if (pdSize === 0) return viewportHeightPx * 0.05;
  return viewportHeightPx * (Math.abs(pdSize) / 100);
}
