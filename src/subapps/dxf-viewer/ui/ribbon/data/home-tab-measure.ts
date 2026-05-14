/**
 * ADR-345 §3 — Annotate tab, MEASURE panel.
 * AutoCAD/BricsCAD pattern: measure tools live in Annotate tab.
 */

import type { RibbonPanelDef } from '../types/ribbon-types';

export const ANNOTATE_MEASURE_PANEL: RibbonPanelDef = {
  id: 'measure',
  labelKey: 'ribbon.panels.measure',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'split',
          size: 'large',
          command: {
            id: 'measure.distance',
            labelKey: 'ribbon.commands.measureDistance',
            icon: 'measure-distance',
            commandKey: 'measure-distance',
            shortcut: 'MD',
          },
          variants: [
            {
              id: 'measure-distance.two-point',
              labelKey: 'ribbon.commands.measureDistanceVariants.twoPoint',
              icon: 'measure-distance',
              commandKey: 'measure-distance',
            },
            {
              id: 'measure-distance.continuous',
              labelKey: 'ribbon.commands.measureDistanceVariants.continuous',
              icon: 'measure-distance-continuous',
              commandKey: 'measure-distance-continuous',
            },
          ],
        },
        {
          type: 'split',
          size: 'large',
          command: {
            id: 'measure.area',
            labelKey: 'ribbon.commands.measureArea',
            icon: 'measure-area',
            commandKey: 'measure-area',
            shortcut: 'AA',
          },
          variants: [
            {
              id: 'measure-area.manual',
              labelKey: 'ribbon.commands.measureAreaVariants.manual',
              icon: 'measure-area',
              commandKey: 'measure-area',
            },
            {
              id: 'measure-area.auto',
              labelKey: 'ribbon.commands.measureAreaVariants.auto',
              icon: 'measure-area-auto',
              commandKey: 'auto-measure-area',
            },
          ],
        },
        {
          type: 'split',
          size: 'large',
          command: {
            id: 'measure.angle',
            labelKey: 'ribbon.commands.measureAngle',
            icon: 'measure-angle',
            commandKey: 'measure-angle',
            shortcut: 'MA',
          },
          variants: [
            {
              id: 'measure-angle.basic',
              labelKey: 'ribbon.commands.measureAngleVariants.basic',
              icon: 'measure-angle',
              commandKey: 'measure-angle',
            },
            {
              id: 'measure-angle.line-arc',
              labelKey: 'ribbon.commands.measureAngleVariants.lineArc',
              icon: 'measure-angle-line-arc',
              commandKey: 'measure-angle-line-arc',
            },
            {
              id: 'measure-angle.two-arcs',
              labelKey: 'ribbon.commands.measureAngleVariants.twoArcs',
              icon: 'measure-angle-two-arcs',
              commandKey: 'measure-angle-two-arcs',
            },
            {
              id: 'measure-angle.measuregeom',
              labelKey: 'ribbon.commands.measureAngleVariants.measureGeom',
              icon: 'measure-angle-measuregeom',
              commandKey: 'measure-angle-measuregeom',
            },
            {
              id: 'measure-angle.constraint',
              labelKey: 'ribbon.commands.measureAngleVariants.constraint',
              icon: 'measure-angle-constraint',
              commandKey: 'measure-angle-constraint',
            },
          ],
        },
      ],
    },
  ],
};
