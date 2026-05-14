import type { RibbonPanelDef } from '../types/ribbon-types';

export const HOME_HISTORY_PANEL: RibbonPanelDef = {
  id: 'history',
  labelKey: 'ribbon.panels.history',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'history.undo',
            labelKey: 'ribbon.commands.undo',
            icon: 'undo',
            commandKey: 'undo',
            action: 'undo',
          },
        },
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'history.redo',
            labelKey: 'ribbon.commands.redo',
            icon: 'redo',
            commandKey: 'redo',
            action: 'redo',
          },
        },
      ],
    },
  ],
};
