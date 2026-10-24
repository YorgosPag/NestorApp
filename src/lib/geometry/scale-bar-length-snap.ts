/**
 * ADR-583 Φ2 — Scale-bar length quantizer (1 · 2 · 5 × 10ⁿ "nice numbers").
 *
 * A graphic scale bar must span a *nice round* real-world distance so a reader can
 * measure off it (Revit/QGIS/AutoCAD/Esri parity): the bar IS "10 m", never "9.37 m".
 * `snapScaleBarLength` maps a raw real-world distance (in the bar's own unit) to the
 * NEAREST value in the classic cartographic 1-2-5 decade sequence
 * (… 0.5, 1, 2, 5, 10, 20, 50, 100 …).
 *
 * "Nearest" uses geometric-mean thresholds (the perceptually-correct midpoints on a
 * log scale): a raw fraction `f ∈ [1,10)` snaps to
 *   1  when f < √2  (≈1.414)
 *   2  when f < √10 (≈3.162)
 *   5  when f < √50 (≈7.071)
 *   10 otherwise.
 *
 * Pure + deterministic. This is the SINGLE home for scale-bar length rounding —
 * it does NOT clone the other 1-2-5 code, which answers different questions:
 * `RulerRenderer` (tick spacing), `niceScaleAtLeast` (round UP, `≥`), the topo grid
 * ladder (fixed step table).
 *
 * ΕΝΑ σπίτι (ADR-920 Β4.8, 2026-10-24): μετακόμισε εδώ από το
 * `dxf-viewer/bim/scale-bar/scale-bar-length-snap.ts`, γιατί ο χάρτης εδάφους της
 * αγγελίας ζει έξω από το subapp και δεν επιτρέπεται να εισάγει από αυτό (CHECK 3.62).
 * Το subapp το επανεξάγει — ίδιο σώμα, ίδια σημασιολογία (προηγούμενο: `planar-polygon`).
 *
 * Callers: `dxf-viewer/bim/scale-bar/build-scale-bar-entity.ts` (DXF scale bar) ·
 * the listing terrain map (ADR-920 Β4.8).
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
