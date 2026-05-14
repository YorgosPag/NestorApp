/**
 * ADR-345 §5.4 Fase 5.5 — Contextual tab: TEXT EDITOR (wired).
 *
 * Appears in the tab bar with accent color when the primary selection
 * is a TEXT or MTEXT entity. Five panels in horizontal layout
 * (decision Plan Mode 2026-05-12, "Τρόπος Α").
 *
 * Live controls (wired through `useRibbonTextEditorBridge`):
 *   - Font: family / height comboboxes, bold/italic/underline toggles
 *   - Paragraph: align-left/center/right toggles (mutually exclusive
 *     via `justification` field), line-spacing combobox
 *   - Properties: layer + annotation scale comboboxes
 *
 * Coming-soon buttons (placeholder UX, no engine wiring):
 *   - Insert: symbol / field
 *   - Editor Tools: find-replace (FindReplaceDialog wiring → ADR-344
 *     Phase 9 close), spell-check
 *
 * Trigger token: 'text-selected' (matched against
 * `activeContextualTrigger` prop on RibbonRoot).
 */

import type { RibbonTab } from '../types/ribbon-types';
import { TEXT_RIBBON_KEYS } from '../hooks/bridge/command-keys';

export const TEXT_EDITOR_CONTEXTUAL_TRIGGER = 'text-selected';

const WIDTH_FACTOR_OPTIONS = [
  { value: '0.50', labelKey: '0.50', isLiteralLabel: true },
  { value: '0.75', labelKey: '0.75', isLiteralLabel: true },
  { value: '1.00', labelKey: '1.00', isLiteralLabel: true },
  { value: '1.25', labelKey: '1.25', isLiteralLabel: true },
  { value: '1.50', labelKey: '1.50', isLiteralLabel: true },
  { value: '2.00', labelKey: '2.00', isLiteralLabel: true },
] as const;

const OBLIQUE_ANGLE_OPTIONS = [
  { value: '-30', labelKey: '-30°', isLiteralLabel: true },
  { value: '-15', labelKey: '-15°', isLiteralLabel: true },
  { value: '0', labelKey: '0°', isLiteralLabel: true },
  { value: '15', labelKey: '15°', isLiteralLabel: true },
  { value: '30', labelKey: '30°', isLiteralLabel: true },
] as const;

const TRACKING_OPTIONS = [
  { value: '0.80', labelKey: '0.80', isLiteralLabel: true },
  { value: '1.00', labelKey: '1.00', isLiteralLabel: true },
  { value: '1.20', labelKey: '1.20', isLiteralLabel: true },
  { value: '1.50', labelKey: '1.50', isLiteralLabel: true },
] as const;

const FONT_HEIGHT_OPTIONS = [
  { value: '1', labelKey: '1.0', isLiteralLabel: true },
  { value: '2.5', labelKey: '2.5', isLiteralLabel: true },
  { value: '3.5', labelKey: '3.5', isLiteralLabel: true },
  { value: '5', labelKey: '5.0', isLiteralLabel: true },
  { value: '7', labelKey: '7.0', isLiteralLabel: true },
  { value: '10', labelKey: '10.0', isLiteralLabel: true },
] as const;


export const CONTEXTUAL_TEXT_EDITOR_TAB: RibbonTab = {
  id: 'text-editor',
  labelKey: 'ribbon.tabs.textEditor',
  isContextual: true,
  contextualTrigger: TEXT_EDITOR_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'text-font',
      labelKey: 'ribbon.panels.font',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'font-family',
              command: {
                id: 'text.font.family',
                labelKey: 'ribbon.commands.textEditor.font.family',
                commandKey: TEXT_RIBBON_KEYS.font.family,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'text.font.height',
                labelKey: 'ribbon.commands.textEditor.font.height',
                commandKey: TEXT_RIBBON_KEYS.font.height,
                comboboxWidthPx: 80,
                options: FONT_HEIGHT_OPTIONS,
              },
            },
          ],
        },
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'text.style.bold',
                labelKey: 'ribbon.commands.textEditor.style.bold',
                icon: 'text-bold',
                commandKey: TEXT_RIBBON_KEYS.style.bold,
              },
            },
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'text.style.italic',
                labelKey: 'ribbon.commands.textEditor.style.italic',
                icon: 'text-italic',
                commandKey: TEXT_RIBBON_KEYS.style.italic,
              },
            },
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'text.style.underline',
                labelKey: 'ribbon.commands.textEditor.style.underline',
                icon: 'text-underline',
                commandKey: TEXT_RIBBON_KEYS.style.underline,
              },
            },
          ],
        },
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'text.style.overline',
                labelKey: 'ribbon.commands.textEditor.style.overline',
                icon: 'text-overline',
                commandKey: TEXT_RIBBON_KEYS.style.overline,
              },
            },
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'text.style.strikethrough',
                labelKey: 'ribbon.commands.textEditor.style.strikethrough',
                icon: 'text-strikethrough',
                commandKey: TEXT_RIBBON_KEYS.style.strikethrough,
              },
            },
            {
              type: 'color-swatch',
              size: 'small',
              command: {
                id: 'text.font.color',
                labelKey: 'ribbon.commands.textEditor.font.color',
                commandKey: 'text.font.color',
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
                id: 'text.font.widthFactor',
                labelKey: 'ribbon.commands.textEditor.font.widthFactor',
                commandKey: TEXT_RIBBON_KEYS.font.widthFactor,
                comboboxWidthPx: 80,
                options: WIDTH_FACTOR_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'text.font.obliqueAngle',
                labelKey: 'ribbon.commands.textEditor.font.obliqueAngle',
                commandKey: TEXT_RIBBON_KEYS.font.obliqueAngle,
                comboboxWidthPx: 80,
                options: OBLIQUE_ANGLE_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'text.font.tracking',
                labelKey: 'ribbon.commands.textEditor.font.tracking',
                commandKey: TEXT_RIBBON_KEYS.font.tracking,
                comboboxWidthPx: 80,
                options: TRACKING_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'text-paragraph',
      labelKey: 'ribbon.panels.paragraph',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'justification-grid',
              command: {
                id: 'text.paragraph.justification',
                labelKey: 'ribbon.commands.textEditor.paragraph.justification',
                commandKey: 'text.paragraph.justification',
              },
            },
          ],
        },
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'line-spacing',
              command: {
                id: 'text.paragraph.lineSpacing',
                labelKey: 'ribbon.commands.textEditor.paragraph.lineSpacing',
                commandKey: TEXT_RIBBON_KEYS.paragraph.lineSpacing,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'text-properties',
      labelKey: 'ribbon.panels.textProperties',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'text.properties.layer',
                labelKey: 'ribbon.commands.textEditor.properties.layer',
                commandKey: TEXT_RIBBON_KEYS.properties.layer,
                comboboxWidthPx: 160,
              },
            },
            {
              type: 'widget',
              size: 'small',
              widgetId: 'annotation-scale',
              command: {
                id: 'text.properties.annotationScale',
                labelKey:
                  'ribbon.commands.textEditor.properties.annotationScale',
                commandKey: TEXT_RIBBON_KEYS.properties.annotationScale,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'text-insert',
      labelKey: 'ribbon.panels.insert',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'insert-tokens',
              command: {
                id: 'text.insert.tokens',
                labelKey: 'ribbon.commands.textEditor.insert.tokens',
                commandKey: 'text-insert-tokens',
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
                id: 'text.insert.symbol',
                labelKey: 'ribbon.commands.textEditor.insert.symbol',
                icon: 'text-placeholder',
                commandKey: 'text-insert-symbol',
                comingSoon: true,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'text.insert.field',
                labelKey: 'ribbon.commands.textEditor.insert.field',
                icon: 'text-placeholder',
                commandKey: 'text-insert-field',
                comingSoon: true,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'text-editor-tools',
      labelKey: 'ribbon.panels.editor',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'text.editor.findReplace',
                labelKey: 'ribbon.commands.textEditor.editor.findReplace',
                icon: 'text-placeholder',
                commandKey: 'text-find-replace',
                comingSoon: true,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'text.editor.spellCheck',
                labelKey: 'ribbon.commands.textEditor.editor.spellCheck',
                icon: 'text-placeholder',
                commandKey: 'text-spell-check',
                comingSoon: true,
              },
            },
          ],
        },
      ],
    },
  ],
};
