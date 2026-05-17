/**
 * ADR-362 Phase E2 — Contextual ribbon tab: DIMENSION editor.
 *
 * Appears in the tab bar when the primary selection is a DimensionEntity
 * (`type === 'dimension'`). AutoCAD/Revit pattern: one unified tab for all
 * 10 dimension sub-types (linear, radial, angular, ordinate, etc.).
 *
 * Four panels:
 *   (A) Στυλ      — DIMSTYLE chooser + Apply / Edit Style
 *   (B) Παράκαμψη — color override, arrow style, reset
 *   (C) Κείμενο   — text height, position, rotation, reset
 *   (D) Ιδιότητες — layer, annotation scale, open panel
 *
 * Action handlers are stubs in E2 (`comingSoon: true`).
 * Real DIMSTYLE writes arrive in Phase F (style manager) and
 * Phase G (advanced overrides).
 *
 * Trigger token: 'dim-selected' (resolved by `resolveContextualTrigger`
 * in `app/ribbon-contextual-config.ts` when `entity.type === 'dimension'`).
 */

import type { RibbonTab } from '../types/ribbon-types';
import { DIM_RIBBON_KEYS } from '../hooks/bridge/dim-command-keys';

export const DIMENSION_CONTEXTUAL_TRIGGER = 'dim-selected';

// Static DIMSTYLE presets (E2 stub — Phase F bridges to DimStyleRegistry).
const DIMSTYLE_OPTIONS = [
  { value: 'iso-129',       labelKey: 'ribbon.commands.dimContextual.styleOptions.iso',           isLiteralLabel: false },
  { value: 'asme-y14',      labelKey: 'ribbon.commands.dimContextual.styleOptions.asme',          isLiteralLabel: false },
  { value: 'architectural', labelKey: 'ribbon.commands.dimContextual.styleOptions.architectural', isLiteralLabel: false },
] as const;

// Arrowhead variants (subset of DXF arrowhead tokens; full list in Phase G).
const ARROW_STYLE_OPTIONS = [
  { value: 'closed-filled', labelKey: 'ribbon.commands.dimContextual.arrowOptions.closedFilled', isLiteralLabel: false },
  { value: 'open',          labelKey: 'ribbon.commands.dimContextual.arrowOptions.open',          isLiteralLabel: false },
  { value: 'dot',           labelKey: 'ribbon.commands.dimContextual.arrowOptions.dot',           isLiteralLabel: false },
  { value: 'slash',         labelKey: 'ribbon.commands.dimContextual.arrowOptions.slash',         isLiteralLabel: false },
  { value: 'none',          labelKey: 'ribbon.commands.dimContextual.arrowOptions.none',          isLiteralLabel: false },
] as const;

// Paper-space text height presets (mm). Numeric literals — not translatable.
const TEXT_HEIGHT_OPTIONS = [
  { value: '2.5',  labelKey: '2.5',  isLiteralLabel: true },
  { value: '3.5',  labelKey: '3.5',  isLiteralLabel: true },
  { value: '5.0',  labelKey: '5.0',  isLiteralLabel: true },
  { value: '7.0',  labelKey: '7.0',  isLiteralLabel: true },
  { value: '10.0', labelKey: '10.0', isLiteralLabel: true },
] as const;

// DIMTAD text-position presets (above / center / below dim line).
const TEXT_POSITION_OPTIONS = [
  { value: 'above',    labelKey: 'ribbon.commands.dimContextual.textPositionOptions.above',    isLiteralLabel: false },
  { value: 'centered', labelKey: 'ribbon.commands.dimContextual.textPositionOptions.centered', isLiteralLabel: false },
  { value: 'below',    labelKey: 'ribbon.commands.dimContextual.textPositionOptions.below',    isLiteralLabel: false },
] as const;

// Text-rotation presets (degrees). Numeric literals — not translatable.
const TEXT_ROTATION_OPTIONS = [
  { value: '0',   labelKey: '0°',   isLiteralLabel: true },
  { value: '15',  labelKey: '15°',  isLiteralLabel: true },
  { value: '30',  labelKey: '30°',  isLiteralLabel: true },
  { value: '45',  labelKey: '45°',  isLiteralLabel: true },
  { value: '90',  labelKey: '90°',  isLiteralLabel: true },
  { value: '180', labelKey: '180°', isLiteralLabel: true },
] as const;

export const DIMENSION_CONTEXTUAL_TAB: RibbonTab = {
  id: 'dimension',
  labelKey: 'ribbon.tabs.dimension',
  isContextual: true,
  contextualTrigger: DIMENSION_CONTEXTUAL_TRIGGER,
  panels: [
    // (A) Στυλ — DIMSTYLE chooser
    {
      id: 'dim-style',
      labelKey: 'ribbon.panels.dimStyle',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.style.chooser',
                labelKey: 'ribbon.commands.dimStyleChooser',
                commandKey: DIM_RIBBON_KEYS.style.chooser,
                comboboxWidthPx: 160,
                options: DIMSTYLE_OPTIONS,
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
                id: 'dim.style.apply',
                labelKey: 'ribbon.commands.dimApplyStyle',
                icon: 'dim-apply-style',
                commandKey: DIM_RIBBON_KEYS.style.applyStyle,
                comingSoon: true,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'dim.style.edit',
                labelKey: 'ribbon.commands.dimEditStyle',
                icon: 'dim-edit-style',
                commandKey: DIM_RIBBON_KEYS.style.editStyle,
                comingSoon: true,
              },
            },
          ],
        },
      ],
    },
    // (B) Παράκαμψη — color + arrow override
    {
      id: 'dim-override',
      labelKey: 'ribbon.panels.dimOverride',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'color-swatch',
              size: 'small',
              command: {
                id: 'dim.override.color',
                labelKey: 'ribbon.commands.dimColorOverride',
                commandKey: DIM_RIBBON_KEYS.override.color,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.override.arrowStyle',
                labelKey: 'ribbon.commands.dimArrowStyle',
                commandKey: DIM_RIBBON_KEYS.override.arrowStyle,
                comboboxWidthPx: 140,
                options: ARROW_STYLE_OPTIONS,
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
                id: 'dim.override.reset',
                labelKey: 'ribbon.commands.dimResetOverrides',
                icon: 'dim-reset-overrides',
                commandKey: DIM_RIBBON_KEYS.override.resetOverrides,
                comingSoon: true,
              },
            },
          ],
        },
      ],
    },
    // (C) Κείμενο — height, position, rotation
    {
      id: 'dim-text',
      labelKey: 'ribbon.panels.dimText',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.text.height',
                labelKey: 'ribbon.commands.dimTextHeight',
                commandKey: DIM_RIBBON_KEYS.text.height,
                comboboxWidthPx: 80,
                options: TEXT_HEIGHT_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.text.position',
                labelKey: 'ribbon.commands.dimTextPosition',
                commandKey: DIM_RIBBON_KEYS.text.position,
                comboboxWidthPx: 120,
                options: TEXT_POSITION_OPTIONS,
              },
            },
          ],
        },
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.text.rotation',
                labelKey: 'ribbon.commands.dimTextRotation',
                commandKey: DIM_RIBBON_KEYS.text.rotation,
                comboboxWidthPx: 80,
                options: TEXT_ROTATION_OPTIONS,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'dim.text.resetPosition',
                labelKey: 'ribbon.commands.dimResetTextPosition',
                icon: 'dim-reset-text-position',
                commandKey: DIM_RIBBON_KEYS.text.resetPosition,
                comingSoon: true,
              },
            },
          ],
        },
        // ADR-362 Phase G1 — text override editor
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'dim.text.override',
                labelKey: 'ribbon.commands.dimTextOverride',
                icon: 'dim-text-override',
                commandKey: DIM_RIBBON_KEYS.text.override,
                action: 'dim.text.override',
              },
            },
          ],
        },
      ],
    },
    // (D) Ιδιότητες — layer + annotation scale
    {
      id: 'dim-properties',
      labelKey: 'ribbon.panels.dimProperties',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.properties.layer',
                labelKey: 'ribbon.commands.dimLayer',
                commandKey: DIM_RIBBON_KEYS.properties.layer,
                comboboxWidthPx: 160,
              },
            },
            {
              type: 'widget',
              size: 'small',
              widgetId: 'annotation-scale',
              command: {
                id: 'dim.properties.annotationScale',
                labelKey: 'ribbon.commands.dimAnnotationScale',
                commandKey: DIM_RIBBON_KEYS.properties.annotationScale,
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
                id: 'dim.properties.openPanel',
                labelKey: 'ribbon.commands.dimOpenPanel',
                icon: 'dim-open-panel',
                commandKey: DIM_RIBBON_KEYS.properties.openPanel,
                comingSoon: true,
              },
            },
          ],
        },
      ],
    },
  ],
};
