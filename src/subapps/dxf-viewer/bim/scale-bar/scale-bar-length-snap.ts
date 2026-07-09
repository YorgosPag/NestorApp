/**
 * ADR-583 Φ2 — Scale-bar length quantizer (1 · 2 · 5 × 10ⁿ "nice numbers").
 *
 * A graphic scale bar must span a *nice round* real-world distance so a reader can
 * measure off it (Revit/QGIS/AutoCAD parity): the bar IS "10 m", never "9.37 m".
 * `snapScaleBarLength` maps the raw real distance dragged by the user (already in
 * the bar's real-world `unit`, from `realDistanceToModelMm`'s inverse in
 * `build-scale-bar-entity.ts`) to the NEAREST value in the classic cartographic
 * 1-2-5 decade sequence (… 0.5, 1, 2, 5, 10, 20, 50, 100 …).
 *
 * "Nearest" uses geometric-mean thresholds (the perceptually-correct midpoints on a
 * log scale): a raw fraction `f ∈ [1,10)` snaps to
 *   1  when f < √2  (≈1.414)
 *   2  when f < √10 (≈3.162)
 *   5  when f < √50 (≈7.071)
 *   10 otherwise.
 *
 * Pure + deterministic. This is the SINGLE home for scale-bar length rounding —
 * it does NOT clone the dimension "nice tick" code (that lives elsewhere and
 * targets a different problem: choosing tick spacing, not a total span).
 *
 * @see bim/scale-bar/build-scale-bar-entity.ts — the sole caller
 * @see utils/scale-bar-divisions.ts — division/subdivision boundary math
 */

/** Log-scale midpoints between the 1 · 2 · 5 · 10 anchors (√2, √10, √50). */
const SNAP_THRESHOLD_1_TO_2 = Math.SQRT2;      // ≈ 1.41421
const SNAP_THRESHOLD_2_TO_5 = Math.sqrt(10);   // ≈ 3.16228
const SNAP_THRESHOLD_5_TO_10 = Math.sqrt(50);  // ≈ 7.07107

/**
 * Snap a raw real-world distance to the nearest 1-2-5 nice number.
 *
 * Returns `0` for non-finite / non-positive input (a degenerate drag) so callers
 * can treat it as "no bar yet" without special-casing NaN.
 */
export function snapScaleBarLength(rawRealDistance: number): number {
  if (!Number.isFinite(rawRealDistance) || rawRealDistance <= 0) return 0;

  const exponent = Math.floor(Math.log10(rawRealDistance));
  const decade = Math.pow(10, exponent);
  const fraction = rawRealDistance / decade; // normalised into [1, 10)

  const niceFraction =
    fraction < SNAP_THRESHOLD_1_TO_2 ? 1 :
    fraction < SNAP_THRESHOLD_2_TO_5 ? 2 :
    fraction < SNAP_THRESHOLD_5_TO_10 ? 5 : 10;

  return niceFraction * decade;
}
