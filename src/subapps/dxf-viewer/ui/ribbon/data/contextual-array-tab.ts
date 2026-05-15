/**
 * ADR-353 Phase A (Session A4) — Contextual ribbon tab: ARRAY EDITOR.
 *
 * Auto-opens when the primary selection is an ArrayEntity (Q17). Three
 * panels:
 *   - Geometry  → rows / cols / angle (numeric comboboxes with industry
 *     defaults; free-typed values auto-inject as first option).
 *   - Spacing   → row spacing / col spacing.
 *   - Actions   → edit source / explode / close.
 *
 * Live preview: bridge dispatches `UpdateArrayParamsCommand` on each
 * change with `isDragging=true` so the command stack merges rapid edits
 * into a single undo step (UpdateArrayParamsCommand.canMergeWith).
 *
 * Trigger token: 'array-selected' — DxfViewerContent flips
 * `activeContextualTrigger` based on `primarySelectedId.type === 'array'`.
 */

import type { RibbonTab } from '../types/ribbon-types';
import { ARRAY_RIBBON_KEYS } from '../hooks/bridge/array-command-keys';

export const ARRAY_CONTEXTUAL_TRIGGER = 'array-selected';

const COUNT_OPTIONS = [
  { value: '1', labelKey: '1', isLiteralLabel: true },
  { value: '2', labelKey: '2', isLiteralLabel: true },
  { value: '3', labelKey: '3', isLiteralLabel: true },
  { value: '4', labelKey: '4', isLiteralLabel: true },
  { value: '5', labelKey: '5', isLiteralLabel: true },
  { value: '6', labelKey: '6', isLiteralLabel: true },
  { value: '8', labelKey: '8', isLiteralLabel: true },
  { value: '10', labelKey: '10', isLiteralLabel: true },
  { value: '12', labelKey: '12', isLiteralLabel: true },
  { value: '20', labelKey: '20', isLiteralLabel: true },
] as const;

const ANGLE_OPTIONS = [
  { value: '0', labelKey: '0°', isLiteralLabel: true },
  { value: '15', labelKey: '15°', isLiteralLabel: true },
  { value: '30', labelKey: '30°', isLiteralLabel: true },
  { value: '45', labelKey: '45°', isLiteralLabel: true },
  { value: '60', labelKey: '60°', isLiteralLabel: true },
  { value: '90', labelKey: '90°', isLiteralLabel: true },
] as const;

const SPACING_OPTIONS = [
  { value: '5', labelKey: '5', isLiteralLabel: true },
  { value: '10', labelKey: '10', isLiteralLabel: true },
  { value: '25', labelKey: '25', isLiteralLabel: true },
  { value: '50', labelKey: '50', isLiteralLabel: true },
  { value: '100', labelKey: '100', isLiteralLabel: true },
  { value: '250', labelKey: '250', isLiteralLabel: true },
] as const;

export const CONTEXTUAL_ARRAY_TAB: RibbonTab = {
  id: 'array-editor',
  labelKey: 'ribbon.tabs.arrayEditor',
  isContextual: true,
  contextualTrigger: ARRAY_CONTEXTUAL_TRIGGER,
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
              },
            },
          ],
        },
      ],
    },
    {
      id: 'array-actions',
      labelKey: 'ribbon.panels.arrayActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'array.editSource',
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
                id: 'array.explode',
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
                id: 'array.close',
                labelKey: 'ribbon.commands.arrayEditor.close',
                icon: 'select',
                commandKey: 'array-close-tab',
                action: 'array-close-tab',
              },
            },
          ],
        },
      ],
    },
  ],
};
