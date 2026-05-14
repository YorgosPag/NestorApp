/**
 * ADR-345 Fase 7 — Home tab, AI panel.
 * AI Assistant toggle — migrated from EnhancedDXFToolbar second toolbar.
 * Pattern: Home tab rightmost panel (Revit/Docs — AI lives where work happens).
 */

import type { RibbonPanelDef } from '../types/ribbon-types';

export const HOME_AI_PANEL: RibbonPanelDef = {
  id: 'ai',
  labelKey: 'ribbon.panels.ai',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'ai.assistant',
            labelKey: 'ribbon.commands.aiAssistant',
            icon: 'ai-assistant',
            commandKey: 'ai-assistant',
            action: 'toggle-ai-assistant',
          },
        },
      ],
    },
  ],
};
