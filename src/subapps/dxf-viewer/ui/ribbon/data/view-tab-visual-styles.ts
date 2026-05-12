/**
 * ADR-345 Fase 5A — View tab, VISUAL STYLES panel.
 *
 * All buttons marked `comingSoon` — no DXF renderer support for visual
 * styles yet (2D Wireframe / Hidden / Realistic / Shaded / Conceptual).
 * Pattern stub same as Modify panel Fase 4.
 */

import type { RibbonPanelDef } from '../types/ribbon-types';

export const VIEW_VISUAL_STYLES_PANEL: RibbonPanelDef = {
  id: 'visual-styles',
  labelKey: 'ribbon.panels.visualStyles',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'visual.wireframe2d',
            labelKey: 'ribbon.commands.visualStyles.wireframe2d',
            icon: 'visual-2d',
            commandKey: 'visual-2d',
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
            id: 'visual.hidden',
            labelKey: 'ribbon.commands.visualStyles.hidden',
            icon: 'visual-hidden',
            commandKey: 'visual-hidden',
            comingSoon: true,
          },
        },
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'visual.realistic',
            labelKey: 'ribbon.commands.visualStyles.realistic',
            icon: 'visual-realistic',
            commandKey: 'visual-realistic',
            comingSoon: true,
          },
        },
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'visual.shaded',
            labelKey: 'ribbon.commands.visualStyles.shaded',
            icon: 'visual-shaded',
            commandKey: 'visual-shaded',
            comingSoon: true,
          },
        },
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'visual.conceptual',
            labelKey: 'ribbon.commands.visualStyles.conceptual',
            icon: 'visual-conceptual',
            commandKey: 'visual-conceptual',
            comingSoon: true,
          },
        },
      ],
    },
  ],
};
