/**
 * ADR-583 Φ3e — Graphic scale-bar contextual ribbon command-key registry.
 *
 * Centralizes the `commandKey` strings shared between the ribbon data declaration
 * (`contextual-scale-bar-tab.ts`) and the bridge mappings (`useRibbonScaleBarBridge`).
 * Mirror of `ANNOTATION_SYMBOL_RIBBON_KEYS` — string params (style / unit / label
 * placement = enum pickers) split from numeric params (divisions / subdivisions /
 * annotative paper-mm heights) so the bridge routes each half with one guard.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-583-annotation-symbol-library-north-arrow.md
 */

import { makeKeySetGuard } from './make-key-set-guard';

export const SCALE_BAR_RIBBON_KEYS = {
  stringParams: {
    /** Body style (alternating / hollow / line-ticks / double). */
    style: 'scaleBar.params.style',
    /** Real-world unit of the span + boundary numerals. */
    unit: 'scaleBar.params.unit',
    /** Numeral side relative to the bar axis (below / above). */
    labelPlacement: 'scaleBar.params.labelPlacement',
  },
  params: {
    /** Major segment count. */
    divisions: 'scaleBar.params.divisions',
    /** Fine sub-ticks in the left extension (0 = none). */
    subdivisions: 'scaleBar.params.subdivisions',
    /** Bar body thickness, annotative paper-mm. */
    barHeightMm: 'scaleBar.params.barHeightMm',
    /** Numeral height, annotative paper-mm. */
    labelHeightMm: 'scaleBar.params.labelHeightMm',
  },
} as const;

export type ScaleBarRibbonNumberCommandKey =
  | typeof SCALE_BAR_RIBBON_KEYS.params.divisions
  | typeof SCALE_BAR_RIBBON_KEYS.params.subdivisions
  | typeof SCALE_BAR_RIBBON_KEYS.params.barHeightMm
  | typeof SCALE_BAR_RIBBON_KEYS.params.labelHeightMm;

export type ScaleBarRibbonStringCommandKey =
  | typeof SCALE_BAR_RIBBON_KEYS.stringParams.style
  | typeof SCALE_BAR_RIBBON_KEYS.stringParams.unit
  | typeof SCALE_BAR_RIBBON_KEYS.stringParams.labelPlacement;

export const isScaleBarRibbonKey = makeKeySetGuard<ScaleBarRibbonNumberCommandKey>([
  SCALE_BAR_RIBBON_KEYS.params.divisions,
  SCALE_BAR_RIBBON_KEYS.params.subdivisions,
  SCALE_BAR_RIBBON_KEYS.params.barHeightMm,
  SCALE_BAR_RIBBON_KEYS.params.labelHeightMm,
]);

export const isScaleBarRibbonStringKey = makeKeySetGuard<ScaleBarRibbonStringCommandKey>([
  SCALE_BAR_RIBBON_KEYS.stringParams.style,
  SCALE_BAR_RIBBON_KEYS.stringParams.unit,
  SCALE_BAR_RIBBON_KEYS.stringParams.labelPlacement,
]);
