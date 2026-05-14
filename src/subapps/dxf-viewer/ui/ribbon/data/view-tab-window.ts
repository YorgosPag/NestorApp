/**
 * ADR-345 Fase 8 — View tab, WINDOW panel.
 * Fullscreen toggle — migrated from EnhancedDXFToolbar standalone button.
 * Pattern: AutoCAD View → Window panel / Revit F11 keyboard.
 */

import type { RibbonPanelDef } from '../types/ribbon-types';

export const VIEW_WINDOW_PANEL: RibbonPanelDef = {
  id: 'window',
  labelKey: 'ribbon.panels.window',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'view.fullscreen',
            labelKey: 'ribbon.commands.fullscreen',
            icon: 'fullscreen',
            commandKey: 'fullscreen',
            action: 'toggle-fullscreen',
          },
        },
      ],
    },
  ],
};
