/**
 * ADR-646 Φ4 #6 — Contextual ribbon tab for the Scale tool.
 *
 * Trigger: `scale-tool-active` — surfaced by `resolveToolActiveTrigger` when
 * `activeTool === 'scale'` (mirrors the xline mode tab). Makes the C/R/N modes —
 * previously discoverable ONLY via the command-line keyboard shortcuts in
 * `useScaleTool.dispatchScaleKey` — visible on-screen:
 *
 *   Options panel  → Copy (toggle) / Non-uniform (toggle) / Reference (action)
 *   Factor panel   → editable numeric combobox with ×2 / ×0.5 presets
 *
 * Bridge: `useRibbonScaleToolBridge` reads/writes `ScaleToolStore`; the factor
 * commit routes through the hook-registered executor (`commitUniformScale`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-646-scale-tool-gap-analysis.md §#6
 * @see docs/centralized-systems/reference/adrs/ADR-348-scale-command.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import { SCALE_TOOL_RIBBON_KEYS } from '../hooks/bridge/scale-tool-command-keys';

export const SCALE_TOOL_CONTEXTUAL_TRIGGER = 'scale-tool-active';

// Uniform-factor presets. Negative → mirror + scale (AutoCAD parity, leading `-`
// path in `dispatchScaleKey`). Non-integer presets → editable combobox infers
// decimals; `numericInput` below makes negatives + free typing explicit.
const FACTOR_OPTIONS = [
  { value: '2', labelKey: '×2', isLiteralLabel: true },
  { value: '1.5', labelKey: '×1.5', isLiteralLabel: true },
  { value: '1', labelKey: '×1', isLiteralLabel: true },
  { value: '0.5', labelKey: '×0.5', isLiteralLabel: true },
  { value: '0.25', labelKey: '×0.25', isLiteralLabel: true },
  { value: '-1', labelKey: '×-1', isLiteralLabel: true },
] as const;

export const CONTEXTUAL_SCALE_TOOL_TAB: RibbonTab = {
  id: 'scale-tool',
  labelKey: 'ribbon.tabs.scaleTool',
  isContextual: true,
  contextualTrigger: SCALE_TOOL_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'scale-tool-options',
      labelKey: 'ribbon.panels.scaleToolOptions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'scaleTool.copy',
                labelKey: 'ribbon.commands.scaleTool.copy',
                icon: 'copy',
                commandKey: SCALE_TOOL_RIBBON_KEYS.toggles.copy,
              },
            },
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'scaleTool.nonUniform',
                labelKey: 'ribbon.commands.scaleTool.nonUniform',
                icon: 'stretch',
                commandKey: SCALE_TOOL_RIBBON_KEYS.toggles.nonUniform,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'scaleTool.reference',
                labelKey: 'ribbon.commands.scaleTool.reference',
                icon: 'grip-edit',
                commandKey: SCALE_TOOL_RIBBON_KEYS.actions.reference,
                action: SCALE_TOOL_RIBBON_KEYS.actions.reference,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'scale-tool-factor',
      labelKey: 'ribbon.panels.scaleToolFactor',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'scaleTool.factor',
                labelKey: 'ribbon.commands.scaleTool.factor',
                commandKey: SCALE_TOOL_RIBBON_KEYS.factor,
                comboboxWidthPx: 100,
                options: FACTOR_OPTIONS,
                numericInput: { editable: true, allowNegative: true, allowDecimal: true },
              },
            },
          ],
        },
      ],
    },
  ],
};
