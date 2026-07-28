/**
 * ADR-391 / ADR-723 — View tab, LAYER MANAGER panel.
 *
 * Industry: AutoCAD "Layer Properties Manager" button on View tab — **modeless palette**,
 * changes apply immediately, no OK button.
 * Click dispatches `open-layer-manager` → `AdminLayerManagerPalette` opens (ADR-723: παλέτα,
 * όχι modal — ο καμβάς παραμένει πλήρως λειτουργικός όσο είναι ανοιχτή).
 * Keyboard fallback: Ctrl+L (centralized `toggleLayers` shortcut SSoT).
 */

import type { RibbonPanelDef } from '../types/ribbon-types';

export const VIEW_LAYER_MANAGER_PANEL: RibbonPanelDef = {
  id: 'layerManager',
  labelKey: 'ribbon.panels.layerManager',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'view.layerManager',
            labelKey: 'ribbon.commands.layerManager',
            icon: 'layering',
            commandKey: 'layer-manager',
            action: 'open-layer-manager',
          },
        },
      ],
    },
  ],
};
