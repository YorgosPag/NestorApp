/**
 * ADR-658 M2 (D3) / M3 (D2) — Contextual ribbon tab for the «Μολύβι» freehand tool.
 *
 * Trigger: `sketch-tool-active` — dispatched from `resolve-tool-active-trigger`
 * when `activeTool === 'sketch'`.
 *
 * Two panels (AutoCAD-style, one concept each):
 *   - "sketch-type-panel"    — combobox «Τύπος» (Τεθλασμένη / Καμπύλη) → sketch-output-store.
 *   - "sketch-fidelity-panel" — combobox «Πιστότητα» (4 RDP levels) → sketch-fidelity-store.
 * Options are provided at runtime by `useRibbonSketchFidelityBridge.getComboboxState`
 * (pre-translated), so the static `options` arrays here are intentionally empty.
 *
 * Bridge: `useRibbonSketchFidelityBridge` (one bridge, both keys).
 * Store SSoTs: `systems/sketch/sketch-output-store.ts`, `systems/sketch/sketch-fidelity-store.ts`.
 */
import type { RibbonTab } from '../types/ribbon-types';
import { SKETCH_RIBBON_KEYS } from '../hooks/bridge/sketch-fidelity-command-keys';

export const SKETCH_CONTEXTUAL_TRIGGER = 'sketch-tool-active';

export const CONTEXTUAL_SKETCH_TAB: RibbonTab = {
  id: 'sketch',
  labelKey: 'ribbon.tabs.sketch',
  isContextual: true,
  contextualTrigger: SKETCH_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'sketch-type-panel',
      labelKey: 'ribbon.panels.sketchType',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'sketchTypeSelector',
                labelKey: 'ribbon.commands.sketchTypeSelector',
                commandKey: SKETCH_RIBBON_KEYS.outputType,
                comboboxWidthPx: 160,
                options: [],
              },
            },
          ],
        },
      ],
    },
    {
      id: 'sketch-fidelity-panel',
      labelKey: 'ribbon.panels.sketchFidelity',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'sketchFidelitySelector',
                labelKey: 'ribbon.commands.sketchFidelitySelector',
                commandKey: SKETCH_RIBBON_KEYS.fidelity,
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
