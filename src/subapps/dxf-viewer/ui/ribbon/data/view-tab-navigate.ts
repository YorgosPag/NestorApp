/**
 * ADR-345 Fase 5A — View tab, NAVIGATE panel buttons.
 *
 * Wired to real ToolType: pan, zoom-window, zoom-in, zoom-out.
 * Wired to handleAction: zoom-extents, zoom-reset.
 * `comingSoon`: Previous View, Realtime Zoom.
 */

import type { RibbonPanelDef } from '../types/ribbon-types';

export const VIEW_NAVIGATE_PANEL: RibbonPanelDef = {
  id: 'navigate',
  labelKey: 'ribbon.panels.navigate',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'navigate.pan',
            labelKey: 'ribbon.commands.pan',
            icon: 'pan',
            commandKey: 'pan',
            shortcut: 'P',
          },
        },
        {
          type: 'split',
          size: 'large',
          command: {
            id: 'navigate.zoom',
            labelKey: 'ribbon.commands.zoom',
            icon: 'zoom-window',
            commandKey: 'zoom-window',
          },
          variants: [
            {
              id: 'zoom.window',
              labelKey: 'ribbon.commands.zoomVariants.window',
              icon: 'zoom-window',
              commandKey: 'zoom-window',
            },
            {
              id: 'zoom.in',
              labelKey: 'ribbon.commands.zoomVariants.zoomIn',
              icon: 'zoom-in',
              commandKey: 'zoom-in',
            },
            {
              id: 'zoom.out',
              labelKey: 'ribbon.commands.zoomVariants.zoomOut',
              icon: 'zoom-out',
              commandKey: 'zoom-out',
            },
          ],
        },
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'navigate.zoomExtents',
            labelKey: 'ribbon.commands.zoomExtents',
            icon: 'zoom-extents',
            commandKey: 'zoom-extents',
            action: 'zoom-extents',
          },
        },
      ],
    },
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'navigate.zoomPrevious',
            labelKey: 'ribbon.commands.zoomPrevious',
            icon: 'zoom-previous',
            commandKey: 'zoom-previous',
            comingSoon: true,
          },
        },
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'navigate.zoomRealtime',
            labelKey: 'ribbon.commands.zoomRealtime',
            icon: 'zoom-realtime',
            commandKey: 'zoom-realtime',
            comingSoon: true,
          },
        },
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'navigate.zoomReset',
            labelKey: 'ribbon.commands.zoomReset',
            icon: 'zoom-reset',
            commandKey: 'zoom-reset',
            action: 'zoom-reset',
          },
        },
      ],
    },
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'widget',
          size: 'small',
          widgetId: 'zoom-controls',
          command: {
            id: 'navigate.zoomLevel',
            labelKey: 'ribbon.commands.zoomLevel',
            icon: '',
            commandKey: 'zoom-level',
          },
        },
      ],
    },
  ],
};
