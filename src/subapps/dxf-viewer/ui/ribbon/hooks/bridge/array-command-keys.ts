/**
 * ADR-353 Phase A/B/C — Array contextual ribbon command-key registry.
 *
 * Centralizes the `commandKey` strings shared between the ribbon data
 * declaration (`contextual-array-tab.ts`) and the bridge mappings
 * (`useRibbonArrayBridge`). Mirrors `TEXT_RIBBON_KEYS` pattern from
 * the text editor bridge.
 */

import { makeKeySetGuard } from './make-key-set-guard';

export const ARRAY_RIBBON_KEYS = {
  params: {
    // Rect (Phase A)
    rows: 'array.params.rows',
    cols: 'array.params.cols',
    rowSpacing: 'array.params.rowSpacing',
    colSpacing: 'array.params.colSpacing',
    angle: 'array.params.angle',
    // Polar (Phase B)
    polarCount: 'array.params.polarCount',
    polarFillAngle: 'array.params.polarFillAngle',
    polarStartAngle: 'array.params.polarStartAngle',
    polarRadius: 'array.params.polarRadius',
    // Path (Phase C) — numeric
    pathCount: 'array.params.pathCount',
    pathSpacing: 'array.params.pathSpacing',
    // Path (M2) — "magical" scatter/align numerics (ADR-353 M1 params)
    pathAlignOffset: 'array.params.pathAlignOffset',
    pathRotationJitter: 'array.params.pathRotationJitter',
    pathScaleJitter: 'array.params.pathScaleJitter',
    pathOffsetJitter: 'array.params.pathOffsetJitter',
    pathSeed: 'array.params.pathSeed',
  },
  stringParams: {
    // Path (Phase C) — string-valued
    pathMethod: 'array.params.pathMethod',
    // Path (M2) — source distribution mode (group/sequential/random)
    pathDistribution: 'array.params.pathDistribution',
  },
  toggles: {
    // Polar (Phase B)
    polarRotateItems: 'array.toggles.polarRotateItems',
    // Path (Phase C)
    pathAlignItems: 'array.toggles.pathAlignItems',
    pathReversed: 'array.toggles.pathReversed',
  },
  actions: {
    // Polar (Phase B)
    polarPickCenter: 'array.actions.polarPickCenter',
    // Path (Phase C)
    pathPickPath: 'array.actions.pathPickPath',
  },
} as const;

export type ArrayRibbonComboKey =
  | typeof ARRAY_RIBBON_KEYS.params.rows
  | typeof ARRAY_RIBBON_KEYS.params.cols
  | typeof ARRAY_RIBBON_KEYS.params.rowSpacing
  | typeof ARRAY_RIBBON_KEYS.params.colSpacing
  | typeof ARRAY_RIBBON_KEYS.params.angle
  | typeof ARRAY_RIBBON_KEYS.params.polarCount
  | typeof ARRAY_RIBBON_KEYS.params.polarFillAngle
  | typeof ARRAY_RIBBON_KEYS.params.polarStartAngle
  | typeof ARRAY_RIBBON_KEYS.params.polarRadius
  | typeof ARRAY_RIBBON_KEYS.params.pathCount
  | typeof ARRAY_RIBBON_KEYS.params.pathSpacing
  | typeof ARRAY_RIBBON_KEYS.params.pathAlignOffset
  | typeof ARRAY_RIBBON_KEYS.params.pathRotationJitter
  | typeof ARRAY_RIBBON_KEYS.params.pathScaleJitter
  | typeof ARRAY_RIBBON_KEYS.params.pathOffsetJitter
  | typeof ARRAY_RIBBON_KEYS.params.pathSeed;

export type ArrayRibbonToggleKey =
  | typeof ARRAY_RIBBON_KEYS.toggles.polarRotateItems
  | typeof ARRAY_RIBBON_KEYS.toggles.pathAlignItems
  | typeof ARRAY_RIBBON_KEYS.toggles.pathReversed;

export type ArrayRibbonStringComboKey =
  | typeof ARRAY_RIBBON_KEYS.stringParams.pathMethod
  | typeof ARRAY_RIBBON_KEYS.stringParams.pathDistribution;

/** @deprecated Phase A alias — use {@link ArrayRibbonComboKey}. */
export type ArrayRibbonKey = ArrayRibbonComboKey;

export const isArrayRibbonKey = makeKeySetGuard<ArrayRibbonComboKey>([
  ARRAY_RIBBON_KEYS.params.rows,
  ARRAY_RIBBON_KEYS.params.cols,
  ARRAY_RIBBON_KEYS.params.rowSpacing,
  ARRAY_RIBBON_KEYS.params.colSpacing,
  ARRAY_RIBBON_KEYS.params.angle,
  ARRAY_RIBBON_KEYS.params.polarCount,
  ARRAY_RIBBON_KEYS.params.polarFillAngle,
  ARRAY_RIBBON_KEYS.params.polarStartAngle,
  ARRAY_RIBBON_KEYS.params.polarRadius,
  ARRAY_RIBBON_KEYS.params.pathCount,
  ARRAY_RIBBON_KEYS.params.pathSpacing,
  ARRAY_RIBBON_KEYS.params.pathAlignOffset,
  ARRAY_RIBBON_KEYS.params.pathRotationJitter,
  ARRAY_RIBBON_KEYS.params.pathScaleJitter,
  ARRAY_RIBBON_KEYS.params.pathOffsetJitter,
  ARRAY_RIBBON_KEYS.params.pathSeed,
]);

export const isArrayRibbonStringKey = makeKeySetGuard<ArrayRibbonStringComboKey>([
  ARRAY_RIBBON_KEYS.stringParams.pathMethod,
  ARRAY_RIBBON_KEYS.stringParams.pathDistribution,
]);

export const isArrayRibbonToggleKey = makeKeySetGuard<ArrayRibbonToggleKey>([
  ARRAY_RIBBON_KEYS.toggles.polarRotateItems,
  ARRAY_RIBBON_KEYS.toggles.pathAlignItems,
  ARRAY_RIBBON_KEYS.toggles.pathReversed,
]);
