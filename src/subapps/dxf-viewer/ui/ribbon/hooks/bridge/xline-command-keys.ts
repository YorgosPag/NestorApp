/**
 * ADR-359 Phase 10.b — Command key constants for the XLine mode ribbon bridge.
 *
 * One combobox key: xline:mode — reads/writes XLineModeStore.
 * Used by useRibbonXlineModeBridge and CONTEXTUAL_XLINE_MODE_TAB.
 */

export const XLINE_RIBBON_KEYS = {
  mode: 'xline:mode',
} as const;

export type XlineRibbonKey = (typeof XLINE_RIBBON_KEYS)[keyof typeof XLINE_RIBBON_KEYS];

const XLINE_KEY_SET: ReadonlySet<string> = new Set<string>(Object.values(XLINE_RIBBON_KEYS));

export function isXlineRibbonKey(key: string): key is XlineRibbonKey {
  return XLINE_KEY_SET.has(key);
}
