/**
 * ADR-457 — Detail sheet scale-fit helper (pure SSoT).
 *
 * Shared by the plan and elevation view builders: snaps a real-world footprint
 * (mm) to a standard structural-detail scale (1:N) so that it fills the drawable
 * area on BOTH axes — the section/elevation grows as large as fits instead of
 * being limited by its largest single dimension.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/detail-sheet-fit
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

/** Standard structural-detail scales (1:N) the views snap to. */
export const DETAIL_SCALE_DENOMINATORS: readonly number[] = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];

/**
 * Smallest standard denominator (1:N) fitting a `fpWidthMm × fpHeightMm`
 * footprint into a `availW × availH` drawable area on both axes.
 */
export function pickScaleDenominator(
  fpWidthMm: number, fpHeightMm: number, availW: number, availH: number,
): number {
  const required = Math.max(
    availW > 0 ? fpWidthMm / availW : Infinity,
    availH > 0 ? fpHeightMm / availH : Infinity,
  );
  for (const d of DETAIL_SCALE_DENOMINATORS) {
    if (d >= required) return d;
  }
  return DETAIL_SCALE_DENOMINATORS[DETAIL_SCALE_DENOMINATORS.length - 1];
}
