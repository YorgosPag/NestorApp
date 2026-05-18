/**
 * ADR-362 Phase E1 — Home tab, DIMENSIONS panel.
 *
 * AutoCAD 2016+ pattern (D4):
 *   - Primary "Smart DIM" split button + dropdown of 9 manual variants
 *     (linear / aligned / angular2L / angular3P / radius / diameter /
 *      arcLength / joggedRadius / ordinate).
 *   - Baseline + Continued exposed as standalone small buttons. They
 *     require a parent dim (Phase D3 chain semantics), so they live
 *     outside the Smart DIM dropdown — AutoCAD ships DIMBASELINE /
 *     DIMCONTINUE as separate commands for the same reason.
 *
 * Tool routing: every `commandKey` here matches a `ToolType` literal
 * registered in `toolbar/types.ts` and a `TOOL_DEFINITIONS` entry in
 * `ToolStateManager.ts` (Phase D1/D2/D3 ✅). Click → `onToolChange` →
 * `toolStateStore.selectTool(commandKey)` → `useDimToolRouting` picks
 * the dim flow up via `DimensionCreateStore`.
 */

import type { RibbonPanelDef } from '../types/ribbon-types';

export const HOME_DIMENSIONS_PANEL: RibbonPanelDef = {
  id: 'dimensions',
  labelKey: 'ribbon.panels.dimensions',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'split',
          size: 'large',
          command: {
            id: 'dim.smart',
            labelKey: 'ribbon.commands.dim',
            icon: 'dim-smart',
            commandKey: 'dim-smart',
            shortcut: 'DIM',
          },
          variants: [
            {
              id: 'dim.smart',
              labelKey: 'ribbon.commands.dimVariants.smart',
              icon: 'dim-smart',
              commandKey: 'dim-smart',
            },
            {
              id: 'dim.linear',
              labelKey: 'ribbon.commands.dimVariants.linear',
              icon: 'dim-linear',
              commandKey: 'dim-linear',
            },
            {
              id: 'dim.aligned',
              labelKey: 'ribbon.commands.dimVariants.aligned',
              icon: 'dim-aligned',
              commandKey: 'dim-aligned',
            },
            {
              id: 'dim.angular2L',
              labelKey: 'ribbon.commands.dimVariants.angular2L',
              icon: 'dim-angular2L',
              commandKey: 'dim-angular2L',
            },
            {
              id: 'dim.angular3P',
              labelKey: 'ribbon.commands.dimVariants.angular3P',
              icon: 'dim-angular3P',
              commandKey: 'dim-angular3P',
            },
            {
              id: 'dim.radius',
              labelKey: 'ribbon.commands.dimVariants.radius',
              icon: 'dim-radius',
              commandKey: 'dim-radius',
            },
            {
              id: 'dim.diameter',
              labelKey: 'ribbon.commands.dimVariants.diameter',
              icon: 'dim-diameter',
              commandKey: 'dim-diameter',
            },
            {
              id: 'dim.arc-length',
              labelKey: 'ribbon.commands.dimVariants.arcLength',
              icon: 'dim-arc-length',
              commandKey: 'dim-arc-length',
            },
            {
              id: 'dim.jogged-radius',
              labelKey: 'ribbon.commands.dimVariants.joggedRadius',
              icon: 'dim-jogged-radius',
              commandKey: 'dim-jogged-radius',
            },
            {
              id: 'dim.ordinate',
              labelKey: 'ribbon.commands.dimVariants.ordinate',
              icon: 'dim-ordinate',
              commandKey: 'dim-ordinate',
            },
          ],
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
            id: 'dim.baseline',
            labelKey: 'ribbon.commands.dimBaseline',
            icon: 'dim-baseline',
            commandKey: 'dim-baseline',
          },
        },
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'dim.continued',
            labelKey: 'ribbon.commands.dimContinued',
            icon: 'dim-continued',
            commandKey: 'dim-continued',
          },
        },
      ],
    },
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'split',
          size: 'small',
          command: {
            id: 'dim.centerMark',
            labelKey: 'ribbon.commands.dimCenterMark',
            icon: 'dim-center-mark',
            commandKey: 'dim-center-mark',
          },
          variants: [
            {
              id: 'dim.centerMark',
              labelKey: 'ribbon.commands.dimCenterMark',
              icon: 'dim-center-mark',
              commandKey: 'dim-center-mark',
            },
            {
              id: 'dim.centerLine',
              labelKey: 'ribbon.commands.dimCenterLine',
              icon: 'dim-centerline',
              commandKey: 'dim-centerline',
            },
          ],
        },
      ],
    },
  ],
};
