/**
 * ADR-345 Fase 7 — Settings tab, Developer panel.
 * Run Tests + Performance Monitor — migrated from EnhancedDXFToolbar second toolbar.
 * Pattern: dev/debug tools grouped in Manage/Settings tab (AutoCAD, VS Code pattern).
 * Future: feature-flag hide in production builds.
 */

import type { RibbonPanelDef } from '../types/ribbon-types';

export const SETTINGS_DEVELOPER_PANEL: RibbonPanelDef = {
  id: 'developer',
  labelKey: 'ribbon.panels.developer',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'settings.run-tests',
            labelKey: 'ribbon.commands.runTests',
            icon: 'run-tests',
            commandKey: 'run-tests',
            action: 'run-tests',
          },
        },
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'settings.toggle-perf',
            labelKey: 'ribbon.commands.togglePerf',
            icon: 'toggle-perf',
            commandKey: 'toggle-perf',
            action: 'toggle-perf',
          },
        },
      ],
    },
  ],
};
