/**
 * ADR-646 Φ4 #6 — Command-key registry for the contextual «Κλιμάκωση» (Scale) tool
 * ribbon tab.
 *
 * Mirrors `ARRAY_RIBBON_KEYS` / `XLINE_RIBBON_KEYS`: the `commandKey` strings shared
 * between the ribbon data declaration (`contextual-scale-tool-tab.ts`) and the bridge
 * (`useRibbonScaleToolBridge`). One combobox (factor), two toggles (copy /
 * non-uniform), one action (reference-pick) — the C/R/N modes that were keyboard-only
 * in `useScaleTool.dispatchScaleKey`, now surfaced so the user can discover them.
 */

import { makeKeySetGuard } from './make-key-set-guard';

export const SCALE_TOOL_RIBBON_KEYS = {
  /** Editable numeric combobox — the uniform scale factor (presets ×2 / ×0.5 / …). */
  factor: 'scaleTool.factor',
  toggles: {
    copy: 'scaleTool.toggles.copy',
    nonUniform: 'scaleTool.toggles.nonUniform',
  },
  actions: {
    reference: 'scaleTool.actions.reference',
  },
} as const;

export type ScaleToolRibbonComboKey = typeof SCALE_TOOL_RIBBON_KEYS.factor;

export type ScaleToolRibbonToggleKey =
  | typeof SCALE_TOOL_RIBBON_KEYS.toggles.copy
  | typeof SCALE_TOOL_RIBBON_KEYS.toggles.nonUniform;

export type ScaleToolRibbonActionKey = typeof SCALE_TOOL_RIBBON_KEYS.actions.reference;

export const isScaleToolRibbonKey = makeKeySetGuard<ScaleToolRibbonComboKey>([
  SCALE_TOOL_RIBBON_KEYS.factor,
]);

export const isScaleToolToggleKey = makeKeySetGuard<ScaleToolRibbonToggleKey>([
  SCALE_TOOL_RIBBON_KEYS.toggles.copy,
  SCALE_TOOL_RIBBON_KEYS.toggles.nonUniform,
]);

export const isScaleToolActionKey = makeKeySetGuard<ScaleToolRibbonActionKey>([
  SCALE_TOOL_RIBBON_KEYS.actions.reference,
]);
