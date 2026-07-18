/**
 * ADR-353 Phase A (Session A4) + Phase B (Session B2) + Phase C (Session C3)
 * — Contextual ribbon tabs for the Array editor. Three siblings, picked by
 * `params.kind`:
 *
 *   - ARRAY-RECT  (`array-rect-selected` trigger)
 *       Geometry  → rows / cols / angle
 *       Spacing   → row spacing / col spacing
 *       Actions   → edit source / explode / close
 *
 *   - ARRAY-POLAR (`array-polar-selected` trigger)
 *       Geometry  → count / fillAngle / startAngle / radius
 *       Options   → rotateItems toggle / pick-center action
 *       Actions   → edit source / explode / close
 *
 *   - ARRAY-PATH  (`array-path-selected` trigger)
 *       Geometry  → method toggle / count (divide) or spacing (measure)
 *       Options   → alignItems toggle / reversed toggle / pick-path action
 *       Actions   → edit source / explode / close
 *
 * Live preview: bridge dispatches `UpdateArrayParamsCommand` on each
 * change with `isDragging=true` so the command stack merges rapid edits
 * into a single undo step (UpdateArrayParamsCommand.canMergeWith).
 *
 * Trigger tokens are dispatched by DxfViewerContent based on
 * `primarySelectedId.params.kind`.
 */

import type { RibbonTab } from '../types/ribbon-types';
import { ARRAY_RIBBON_KEYS } from '../hooks/bridge/array-command-keys';
import {
  COUNT_OPTIONS,
  ANGLE_OPTIONS,
  SPACING_OPTIONS,
  FILL_ANGLE_OPTIONS,
  START_ANGLE_OPTIONS,
  RADIUS_OPTIONS,
  METHOD_OPTIONS,
  ALIGN_OFFSET_OPTIONS,
  ROTATION_JITTER_OPTIONS,
  SCALE_JITTER_OPTIONS,
  OFFSET_JITTER_OPTIONS,
  SEED_OPTIONS,
  DISTRIBUTION_OPTIONS,
} from './contextual-array-tab-options';

export const ARRAY_RECT_CONTEXTUAL_TRIGGER = 'array-rect-selected';
export const ARRAY_POLAR_CONTEXTUAL_TRIGGER = 'array-polar-selected';
export const ARRAY_PATH_CONTEXTUAL_TRIGGER = 'array-path-selected';

/** @deprecated Phase A alias — use {@link ARRAY_RECT_CONTEXTUAL_TRIGGER}. */
export const ARRAY_CONTEXTUAL_TRIGGER = ARRAY_RECT_CONTEXTUAL_TRIGGER;

export const CONTEXTUAL_ARRAY_RECT_TAB: RibbonTab = {
  id: 'array-editor-rect',
  labelKey: 'ribbon.tabs.arrayEditor',
  isContextual: true,
  contextualTrigger: ARRAY_RECT_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'array-geometry',
      labelKey: 'ribbon.panels.arrayGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'array.rows',
                labelKey: 'ribbon.commands.arrayEditor.rows',
                commandKey: ARRAY_RIBBON_KEYS.params.rows,
                comboboxWidthPx: 80,
                options: COUNT_OPTIONS,
                numericInput: { quantityKind: 'count' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'array.cols',
                labelKey: 'ribbon.commands.arrayEditor.cols',
                commandKey: ARRAY_RIBBON_KEYS.params.cols,
                comboboxWidthPx: 80,
                options: COUNT_OPTIONS,
                numericInput: { quantityKind: 'count' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'array.angle',
                labelKey: 'ribbon.commands.arrayEditor.angle',
                commandKey: ARRAY_RIBBON_KEYS.params.angle,
                comboboxWidthPx: 90,
                options: ANGLE_OPTIONS,
                numericInput: { quantityKind: 'angle' },
              },
            },
          ],
        },
      ],
    },
    {
      id: 'array-spacing',
      labelKey: 'ribbon.panels.arraySpacing',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'array.rowSpacing',
                labelKey: 'ribbon.commands.arrayEditor.rowSpacing',
                commandKey: ARRAY_RIBBON_KEYS.params.rowSpacing,
                comboboxWidthPx: 100,
                options: SPACING_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'array.colSpacing',
                labelKey: 'ribbon.commands.arrayEditor.colSpacing',
                commandKey: ARRAY_RIBBON_KEYS.params.colSpacing,
                comboboxWidthPx: 100,
                options: SPACING_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
          ],
        },
      ],
    },
    ARRAY_ACTIONS_PANEL('rect'),
  ],
};

/** @deprecated Phase A alias — use {@link CONTEXTUAL_ARRAY_RECT_TAB}. */
export const CONTEXTUAL_ARRAY_TAB = CONTEXTUAL_ARRAY_RECT_TAB;

export const CONTEXTUAL_ARRAY_POLAR_TAB: RibbonTab = {
  id: 'array-editor-polar',
  labelKey: 'ribbon.tabs.arrayEditor',
  isContextual: true,
  contextualTrigger: ARRAY_POLAR_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'array-polar-geometry',
      labelKey: 'ribbon.panels.arrayGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'array.polarCount',
                labelKey: 'ribbon.commands.arrayEditor.polarCount',
                commandKey: ARRAY_RIBBON_KEYS.params.polarCount,
                comboboxWidthPx: 80,
                options: COUNT_OPTIONS,
                numericInput: { quantityKind: 'count' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'array.polarFillAngle',
                labelKey: 'ribbon.commands.arrayEditor.polarFillAngle',
                commandKey: ARRAY_RIBBON_KEYS.params.polarFillAngle,
                comboboxWidthPx: 90,
                options: FILL_ANGLE_OPTIONS,
                numericInput: { quantityKind: 'angle' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'array.polarStartAngle',
                labelKey: 'ribbon.commands.arrayEditor.polarStartAngle',
                commandKey: ARRAY_RIBBON_KEYS.params.polarStartAngle,
                comboboxWidthPx: 90,
                options: START_ANGLE_OPTIONS,
                numericInput: { quantityKind: 'angle' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'array.polarRadius',
                labelKey: 'ribbon.commands.arrayEditor.polarRadius',
                commandKey: ARRAY_RIBBON_KEYS.params.polarRadius,
                comboboxWidthPx: 100,
                options: RADIUS_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
          ],
        },
      ],
    },
    {
      id: 'array-polar-options',
      labelKey: 'ribbon.panels.arrayOptions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'array.polarRotateItems',
                labelKey: 'ribbon.commands.arrayEditor.polarRotateItems',
                icon: 'rotate',
                commandKey: ARRAY_RIBBON_KEYS.toggles.polarRotateItems,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'array.polarPickCenter',
                labelKey: 'ribbon.commands.arrayEditor.polarPickCenter',
                icon: 'select',
                commandKey: ARRAY_RIBBON_KEYS.actions.polarPickCenter,
                action: ARRAY_RIBBON_KEYS.actions.polarPickCenter,
              },
            },
          ],
        },
      ],
    },
    ARRAY_ACTIONS_PANEL('polar'),
  ],
};

export const CONTEXTUAL_ARRAY_PATH_TAB: RibbonTab = {
  id: 'array-editor-path',
  labelKey: 'ribbon.tabs.arrayEditor',
  isContextual: true,
  contextualTrigger: ARRAY_PATH_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'array-path-geometry',
      labelKey: 'ribbon.panels.arrayGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'array.pathMethod',
                labelKey: 'ribbon.commands.arrayEditor.pathMethod',
                commandKey: ARRAY_RIBBON_KEYS.stringParams.pathMethod,
                comboboxWidthPx: 100,
                options: METHOD_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'array.pathCount',
                labelKey: 'ribbon.commands.arrayEditor.pathCount',
                commandKey: ARRAY_RIBBON_KEYS.params.pathCount,
                comboboxWidthPx: 80,
                options: COUNT_OPTIONS,
                numericInput: { quantityKind: 'count' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'array.pathSpacing',
                labelKey: 'ribbon.commands.arrayEditor.pathSpacing',
                commandKey: ARRAY_RIBBON_KEYS.params.pathSpacing,
                comboboxWidthPx: 100,
                options: SPACING_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
          ],
        },
      ],
    },
    {
      id: 'array-path-options',
      labelKey: 'ribbon.panels.arrayOptions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'array.pathAlignItems',
                labelKey: 'ribbon.commands.arrayEditor.pathAlignItems',
                icon: 'rotate',
                commandKey: ARRAY_RIBBON_KEYS.toggles.pathAlignItems,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'array.pathAlignOffset',
                labelKey: 'ribbon.commands.arrayEditor.alignOffset',
                commandKey: ARRAY_RIBBON_KEYS.params.pathAlignOffset,
                comboboxWidthPx: 90,
                options: ALIGN_OFFSET_OPTIONS,
                numericInput: { quantityKind: 'angle' },
              },
            },
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'array.pathReversed',
                labelKey: 'ribbon.commands.arrayEditor.pathReversed',
                icon: 'mirror',
                commandKey: ARRAY_RIBBON_KEYS.toggles.pathReversed,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'array.pathPickPath',
                labelKey: 'ribbon.commands.arrayEditor.pathPickPath',
                icon: 'select',
                commandKey: ARRAY_RIBBON_KEYS.actions.pathPickPath,
                action: ARRAY_RIBBON_KEYS.actions.pathPickPath,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'array-path-scatter',
      labelKey: 'ribbon.panels.arrayScatter',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'array.pathRotationJitter',
                labelKey: 'ribbon.commands.arrayEditor.rotationJitter',
                commandKey: ARRAY_RIBBON_KEYS.params.pathRotationJitter,
                comboboxWidthPx: 90,
                options: ROTATION_JITTER_OPTIONS,
                numericInput: { quantityKind: 'angle' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'array.pathScaleJitter',
                labelKey: 'ribbon.commands.arrayEditor.scaleJitter',
                commandKey: ARRAY_RIBBON_KEYS.params.pathScaleJitter,
                comboboxWidthPx: 90,
                options: SCALE_JITTER_OPTIONS,
                numericInput: { quantityKind: 'percent' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'array.pathOffsetJitter',
                labelKey: 'ribbon.commands.arrayEditor.offsetJitter',
                commandKey: ARRAY_RIBBON_KEYS.params.pathOffsetJitter,
                comboboxWidthPx: 90,
                options: OFFSET_JITTER_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'array.pathDistribution',
                labelKey: 'ribbon.commands.arrayEditor.distribution',
                commandKey: ARRAY_RIBBON_KEYS.stringParams.pathDistribution,
                comboboxWidthPx: 110,
                options: DISTRIBUTION_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'array.pathSeed',
                labelKey: 'ribbon.commands.arrayEditor.seed',
                commandKey: ARRAY_RIBBON_KEYS.params.pathSeed,
                comboboxWidthPx: 80,
                options: SEED_OPTIONS,
                numericInput: { quantityKind: 'dimensionless' },
              },
            },
          ],
        },
      ],
    },
    ARRAY_ACTIONS_PANEL('path'),
  ],
};

function ARRAY_ACTIONS_PANEL(variant: 'rect' | 'polar' | 'path'): RibbonTab['panels'][number] {
  return {
    id: `array-actions-${variant}`,
    labelKey: 'ribbon.panels.arrayActions',
    rows: [
      {
        isInFlyout: false,
        buttons: [
          {
            type: 'simple',
            size: 'small',
            command: {
              id: `array.editSource.${variant}`,
              labelKey: 'ribbon.commands.arrayEditor.editSource',
              icon: 'grip-edit',
              commandKey: 'array-edit-source',
              action: 'array-edit-source',
            },
          },
          {
            type: 'simple',
            size: 'small',
            command: {
              id: `array.explode.${variant}`,
              labelKey: 'ribbon.commands.arrayEditor.explode',
              icon: 'explode',
              commandKey: 'array-explode',
              action: 'array-explode',
            },
          },
          {
            type: 'simple',
            size: 'small',
            command: {
              id: `array.close.${variant}`,
              labelKey: 'ribbon.commands.arrayEditor.close',
              icon: 'select',
              commandKey: 'array.actions.close',
              action: 'array.actions.close',
            },
          },
        ],
      },
    ],
  };
}
