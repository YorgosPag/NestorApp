import type { RibbonPanelDef } from '../types/ribbon-types';

export const VIEW_DISPLAY_PANEL: RibbonPanelDef = {
  id: 'display',
  labelKey: 'ribbon.panels.display',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'display.grid',
            labelKey: 'ribbon.commands.displayGrid',
            icon: 'display-grid',
            commandKey: 'grid',
            action: 'grid',
            shortcut: 'G',
          },
        },
      ],
    },
  ],
};
