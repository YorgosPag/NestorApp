/**
 * ADR-345 §3.2 Fase 4 — Home tab, MODIFY panel buttons.
 *
 * Wired to real ToolType: Move, Copy, Rotate.
 * Marked `comingSoon`: Mirror, Scale, Stretch, Trim, Extend, Offset,
 * Fillet ▾ (Fillet/Chamfer), Array ▾ (Rect/Path/Polar), Explode.
 * Clicking a comingSoon button fires `onComingSoon(label)` →
 * notifications.info("Σύντομα διαθέσιμο: <label>").
 */

import type { RibbonPanelDef } from '../types/ribbon-types';

export const HOME_MODIFY_PANEL: RibbonPanelDef = {
  id: 'modify',
  labelKey: 'ribbon.panels.modify',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'modify.select',
            labelKey: 'ribbon.commands.select',
            icon: 'select',
            commandKey: 'select',
            shortcut: 'ESC',
          },
        },
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'modify.gripEdit',
            labelKey: 'ribbon.commands.gripEdit',
            icon: 'grip-edit',
            commandKey: 'grip-edit',
          },
        },
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'modify.move',
            labelKey: 'ribbon.commands.move',
            icon: 'move',
            commandKey: 'move',
            shortcut: 'M',
          },
        },
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'modify.copy',
            labelKey: 'ribbon.commands.copy',
            icon: 'copy',
            commandKey: 'copy',
            shortcut: 'CO',
          },
        },
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'modify.rotate',
            labelKey: 'ribbon.commands.rotate',
            icon: 'rotate',
            commandKey: 'rotate',
            shortcut: 'RO',
          },
        },
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'modify.mirror',
            labelKey: 'ribbon.commands.mirror',
            icon: 'mirror',
            commandKey: 'mirror',
            shortcut: 'MI',
            comingSoon: true,
          },
        },
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'modify.delete',
            labelKey: 'ribbon.commands.delete',
            icon: 'delete',
            commandKey: 'delete',
            shortcut: 'DEL',
          },
        },
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'modify.cropWindow',
            labelKey: 'ribbon.commands.cropWindow',
            icon: 'crop-window',
            commandKey: 'crop-window',
            shortcut: 'CR',
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
            id: 'modify.scale',
            labelKey: 'ribbon.commands.scale',
            icon: 'scale',
            commandKey: 'scale',
            shortcut: 'SC',
            comingSoon: true,
          },
        },
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'modify.stretch',
            labelKey: 'ribbon.commands.stretch',
            icon: 'stretch',
            commandKey: 'stretch',
            shortcut: 'S',
            comingSoon: true,
          },
        },
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'modify.trim',
            labelKey: 'ribbon.commands.trim',
            icon: 'trim',
            commandKey: 'trim',
            shortcut: 'TR',
            comingSoon: true,
          },
        },
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'modify.extend',
            labelKey: 'ribbon.commands.extend',
            icon: 'extend',
            commandKey: 'extend',
            shortcut: 'EX',
            comingSoon: true,
          },
        },
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'modify.offset',
            labelKey: 'ribbon.commands.offset',
            icon: 'offset',
            commandKey: 'offset',
            shortcut: 'O',
            comingSoon: true,
          },
        },
        {
          type: 'split',
          size: 'small',
          command: {
            id: 'modify.fillet',
            labelKey: 'ribbon.commands.fillet',
            icon: 'fillet',
            commandKey: 'fillet',
            shortcut: 'F',
            comingSoon: true,
          },
          variants: [
            {
              id: 'fillet.fillet',
              labelKey: 'ribbon.commands.filletVariants.fillet',
              icon: 'fillet',
              commandKey: 'fillet',
              comingSoon: true,
            },
            {
              id: 'fillet.chamfer',
              labelKey: 'ribbon.commands.filletVariants.chamfer',
              icon: 'chamfer',
              commandKey: 'chamfer',
              comingSoon: true,
            },
          ],
        },
        {
          type: 'split',
          size: 'small',
          command: {
            id: 'modify.array',
            labelKey: 'ribbon.commands.array',
            icon: 'array-rect',
            commandKey: 'array',
            shortcut: 'AR',
            comingSoon: true,
          },
          variants: [
            {
              id: 'array.rectangular',
              labelKey: 'ribbon.commands.arrayVariants.rectangular',
              icon: 'array-rect',
              commandKey: 'array-rect',
              comingSoon: true,
            },
            {
              id: 'array.path',
              labelKey: 'ribbon.commands.arrayVariants.path',
              icon: 'array-path',
              commandKey: 'array-path',
              comingSoon: true,
            },
            {
              id: 'array.polar',
              labelKey: 'ribbon.commands.arrayVariants.polar',
              icon: 'array-polar',
              commandKey: 'array-polar',
              comingSoon: true,
            },
          ],
        },
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'modify.explode',
            labelKey: 'ribbon.commands.explode',
            icon: 'explode',
            commandKey: 'explode',
            shortcut: 'X',
            comingSoon: true,
          },
        },
      ],
    },
  ],
};
