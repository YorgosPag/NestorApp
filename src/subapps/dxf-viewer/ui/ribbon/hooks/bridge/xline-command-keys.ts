/**
 * ADR-359 Phase 10.b — Command key constants for the XLine mode ribbon bridge.
 *
 * One combobox key: xline:mode — reads/writes XLineModeStore.
 * Used by useRibbonXlineModeBridge and CONTEXTUAL_XLINE_MODE_TAB.
 */

import { makeKeySetGuard } from './make-key-set-guard';

export const XLINE_RIBBON_KEYS = {
  mode: 'xline:mode',
} as const;

export type XlineRibbonKey = (typeof XLINE_RIBBON_KEYS)[keyof typeof XLINE_RIBBON_KEYS];

export const isXlineRibbonKey = makeKeySetGuard<XlineRibbonKey>(Object.values(XLINE_RIBBON_KEYS));
