/**
 * ADR-359 Phase 10.b — Contextual ribbon tab for XLine construction mode selection.
 *
 * Trigger: `xline-mode-active` — dispatched from `useActiveContextualTrigger`
 * when `activeTool === 'xline'`.
 *
 * Panel "xline-mode-panel": 1 combobox for the 6 XLine sub-modes.
 * Options are provided at runtime by `useRibbonXlineModeBridge.getComboboxState`
 * (pre-translated from dxf-viewer namespace), so the static `options` array here
 * is intentionally empty — the bridge overrides it.
 *
 * Bridge: `useRibbonXlineModeBridge` (ADR-359 Phase 10.b).
 * Store SSoT: `systems/tools/xline-mode-store.ts`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-359-auxiliary-geometry-tools.md §5.2 §5.12
 */

import type { RibbonTab } from '../types/ribbon-types';
import { XLINE_RIBBON_KEYS } from '../hooks/bridge/xline-command-keys';

export const XLINE_MODE_CONTEXTUAL_TRIGGER = 'xline-mode-active';

export const CONTEXTUAL_XLINE_MODE_TAB: RibbonTab = {
  id: 'xline-mode',
  labelKey: 'ribbon.tabs.xlineMode',
  isContextual: true,
  contextualTrigger: XLINE_MODE_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'xline-mode-panel',
      labelKey: 'ribbon.panels.xlineMode',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'xlineModeSelector',
                labelKey: 'ribbon.commands.xlineModeSelector',
                commandKey: XLINE_RIBBON_KEYS.mode,
                comboboxWidthPx: 160,
                options: [],
              },
            },
          ],
        },
      ],
    },
  ],
};
