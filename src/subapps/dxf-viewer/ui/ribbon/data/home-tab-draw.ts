/**
 * ADR-345 §3.1 Fase 3 — Home tab, DRAW panel buttons.
 *
 * Variants are wired only to existing `ToolType` entries
 * (src/subapps/dxf-viewer/ui/toolbar/types.ts). Variants listed in
 * ADR §3.1 but not yet mapped to a real ToolType (Tan-Tan-Radius,
 * Start+Center+Angle, Start+End+Angle, Ellipse Axis+End, Elliptical Arc)
 * are deferred to a later sub-phase.
 */

import type { RibbonPanelDef } from '../types/ribbon-types';

export const HOME_DRAW_PANEL: RibbonPanelDef = {
  id: 'draw',
  labelKey: 'ribbon.panels.draw',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'split',
          size: 'large',
          command: {
            id: 'draw.line',
            labelKey: 'ribbon.commands.line',
            icon: 'line',
            commandKey: 'line',
            shortcut: 'L',
          },
          variants: [
            {
              id: 'line.line',
              labelKey: 'ribbon.commands.lineVariants.line',
              icon: 'line',
              commandKey: 'line',
            },
            {
              id: 'line.perpendicular',
              labelKey: 'ribbon.commands.lineVariants.perpendicular',
              icon: 'line-perpendicular',
              commandKey: 'line-perpendicular',
            },
            {
              id: 'line.parallel',
              labelKey: 'ribbon.commands.lineVariants.parallel',
              icon: 'line-parallel',
              commandKey: 'line-parallel',
            },
          ],
        },
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'draw.polyline',
            labelKey: 'ribbon.commands.polyline',
            icon: 'polyline',
            commandKey: 'polyline',
            shortcut: 'PL',
          },
        },
        {
          type: 'split',
          size: 'large',
          command: {
            id: 'draw.circle',
            labelKey: 'ribbon.commands.circle',
            icon: 'circle-radius',
            commandKey: 'circle',
            shortcut: 'C',
          },
          variants: [
            {
              id: 'circle.radius',
              labelKey: 'ribbon.commands.circleVariants.radius',
              icon: 'circle-radius',
              commandKey: 'circle',
            },
            {
              id: 'circle.diameter',
              labelKey: 'ribbon.commands.circleVariants.diameter',
              icon: 'circle-diameter',
              commandKey: 'circle-diameter',
            },
            {
              id: 'circle.2p',
              labelKey: 'ribbon.commands.circleVariants.twoPoint',
              icon: 'circle-2p',
              commandKey: 'circle-2p-diameter',
            },
            {
              id: 'circle.3p',
              labelKey: 'ribbon.commands.circleVariants.threePoint',
              icon: 'circle-3p',
              commandKey: 'circle-3p',
            },
          ],
        },
        {
          type: 'split',
          size: 'large',
          command: {
            id: 'draw.arc',
            labelKey: 'ribbon.commands.arc',
            icon: 'arc-3p',
            commandKey: 'arc-3p',
            shortcut: 'A',
          },
          variants: [
            {
              id: 'arc.3p',
              labelKey: 'ribbon.commands.arcVariants.threePoint',
              icon: 'arc-3p',
              commandKey: 'arc-3p',
            },
            {
              id: 'arc.sce',
              labelKey: 'ribbon.commands.arcVariants.startCenterEnd',
              icon: 'arc-sce',
              commandKey: 'arc-sce',
            },
            {
              id: 'arc.cse',
              labelKey: 'ribbon.commands.arcVariants.centerStartEnd',
              icon: 'arc-cse',
              commandKey: 'arc-cse',
            },
          ],
        },
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'draw.rectangle',
            labelKey: 'ribbon.commands.rectangle',
            icon: 'rectangle',
            commandKey: 'rectangle',
            shortcut: 'REC',
          },
        },
        {
          type: 'split',
          size: 'large',
          command: {
            id: 'draw.text',
            labelKey: 'ribbon.commands.text',
            icon: 'text-create',
            commandKey: 'text',
            shortcut: 'T',
          },
          variants: [
            {
              id: 'text.singleline',
              labelKey: 'ribbon.commands.textVariants.singleLine',
              icon: 'text-create',
              commandKey: 'text',
            },
            {
              id: 'text.multiline',
              labelKey: 'ribbon.commands.textVariants.multiLine',
              icon: 'text-placeholder',
              commandKey: 'mtext',
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
            id: 'draw.polygon',
            labelKey: 'ribbon.commands.polygon',
            icon: 'polygon',
            commandKey: 'polygon',
          },
        },
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'draw.ellipse',
            labelKey: 'ribbon.commands.ellipse',
            icon: 'ellipse',
            commandKey: 'ellipse',
          },
        },
      ],
    },
  ],
};
