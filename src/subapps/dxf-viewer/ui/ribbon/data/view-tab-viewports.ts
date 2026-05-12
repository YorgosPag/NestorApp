/**
 * ADR-345 Fase 5A — View tab, VIEWPORTS panel.
 *
 * All buttons marked `comingSoon` — multi-viewport rendering not yet
 * supported by the DXF canvas (single canvas only).
 */

import type { RibbonPanelDef } from '../types/ribbon-types';

export const VIEW_VIEWPORTS_PANEL: RibbonPanelDef = {
  id: 'viewports',
  labelKey: 'ribbon.panels.viewports',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'viewport.single',
            labelKey: 'ribbon.commands.viewports.single',
            icon: 'viewport-single',
            commandKey: 'viewport-single',
            comingSoon: true,
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
            id: 'viewport.two',
            labelKey: 'ribbon.commands.viewports.two',
            icon: 'viewport-two',
            commandKey: 'viewport-two',
            comingSoon: true,
          },
        },
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'viewport.three',
            labelKey: 'ribbon.commands.viewports.three',
            icon: 'viewport-three',
            commandKey: 'viewport-three',
            comingSoon: true,
          },
        },
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'viewport.four',
            labelKey: 'ribbon.commands.viewports.four',
            icon: 'viewport-four',
            commandKey: 'viewport-four',
            comingSoon: true,
          },
        },
      ],
    },
  ],
};
