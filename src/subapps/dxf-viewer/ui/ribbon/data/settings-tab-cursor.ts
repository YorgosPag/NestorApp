/**
 * ADR-345 Fase 7 — Settings tab, Cursor panel.
 * Cursor crosshair/snap configuration — migrated from EnhancedDXFToolbar second toolbar.
 * Pattern: AutoCAD Options → Drafting / Revit Manage tab → persistent env config.
 */

import type { RibbonPanelDef } from '../types/ribbon-types';

export const SETTINGS_CURSOR_PANEL: RibbonPanelDef = {
  id: 'cursor',
  labelKey: 'ribbon.panels.cursor',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'settings.cursor',
            labelKey: 'ribbon.commands.cursorSettings',
            icon: 'cursor-settings',
            commandKey: 'cursor-settings',
            action: 'toggle-cursor-settings',
          },
        },
      ],
    },
  ],
};
