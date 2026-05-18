/**
 * ADR-357 Phase 17 — Ribbon command keys for the Line Tool Quick Style panel.
 * Mirrors the `stair-command-keys.ts` / `wall-command-keys.ts` pattern.
 */

export const LINE_TOOL_RIBBON_KEYS = Object.freeze({
  lineweight: 'lineToolStyle.lineweight',
  linetype:   'lineToolStyle.linetype',
  color:      'lineToolStyle.color',
} as const);

export type LineToolRibbonKey =
  (typeof LINE_TOOL_RIBBON_KEYS)[keyof typeof LINE_TOOL_RIBBON_KEYS];

export function isLineToolRibbonKey(key: string): key is LineToolRibbonKey {
  return (Object.values(LINE_TOOL_RIBBON_KEYS) as string[]).includes(key);
}
