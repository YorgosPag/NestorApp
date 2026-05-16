/**
 * ADR-358 §5.5.bis Q8 Phase 7 — Home tab, LAYERS panel.
 *
 * Single inline widget (`current-layer-picker`) rendered by RibbonPanel's
 * widget switch. Mirrors the status-bar mount via the shared
 * `LayerStore.currentLayerId` SSoT.
 */

import type { RibbonPanelDef } from '../types/ribbon-types';

export const HOME_LAYERS_PANEL: RibbonPanelDef = {
  id: 'layers',
  labelKey: 'ribbon.panels.layers',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'widget',
          size: 'large',
          widgetId: 'current-layer-picker',
          command: {
            id: 'layers.currentLayerPicker',
            labelKey: 'ribbon.commands.currentLayerPicker',
            commandKey: 'current-layer-picker',
          },
        },
      ],
    },
  ],
};
