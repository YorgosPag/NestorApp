/**
 * ADR-375 Phase B.1 — View tab: Drawing Scale panel.
 *
 * Mounts the DrawingScaleWidget in the View ribbon tab.
 * Scale is annotation-scale (Revit pattern), decoupled from viewport zoom.
 */

import type { RibbonPanelDef } from '../types/ribbon-types';

export const VIEW_DRAWING_SCALE_PANEL: RibbonPanelDef = {
  id: 'drawingScale',
  labelKey: 'ribbon.panels.drawingScale',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'widget',
          size: 'small',
          widgetId: 'drawing-scale',
          command: {
            id: 'view.drawingScale',
            labelKey: 'ribbon.commands.drawingScale.label',
            icon: '',
            commandKey: 'drawing-scale',
          },
        },
      ],
    },
  ],
};
