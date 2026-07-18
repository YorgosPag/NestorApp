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
import { literalNumberOptions } from './ribbon-numeric-options';

export const TEXT_EDITOR_CONTEXTUAL_TRIGGER = 'text-selected';

const WIDTH_FACTOR_OPTIONS = literalNumberOptions(['0.50', 0.75, '1.00', 1.25, '1.50', '2.00']);

const OBLIQUE_ANGLE_OPTIONS = [
  { value: '-30', labelKey: '-30°', isLiteralLabel: true },
  { value: '-15', labelKey: '-15°', isLiteralLabel: true },
  { value: '0', labelKey: '0°', isLiteralLabel: true },
  { value: '15', labelKey: '15°', isLiteralLabel: true },
  { value: '30', labelKey: '30°', isLiteralLabel: true },
] as const;

const TRACKING_OPTIONS = literalNumberOptions(['0.80', '1.00', '1.20', '1.50']);

const ROTATION_OPTIONS = [
  { value: '0', labelKey: '0°', isLiteralLabel: true },
  { value: '45', labelKey: '45°', isLiteralLabel: true },
  { value: '90', labelKey: '90°', isLiteralLabel: true },
  { value: '135', labelKey: '135°', isLiteralLabel: true },
  { value: '180', labelKey: '180°', isLiteralLabel: true },
  { value: '270', labelKey: '270°', isLiteralLabel: true },
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
      id: 'text-tool',
      labelKey: 'ribbon.panels.text',
      rows: [
        {
          isInFlyout: false,
          buttons: [
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
      ],
    },
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
                numericInput: { quantityKind: 'paper-length' },
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
                numericInput: { quantityKind: 'ratio' },
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
                numericInput: { quantityKind: 'angle' },
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
                numericInput: { quantityKind: 'ratio' },
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
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'text.properties.rotation',
                labelKey: 'ribbon.commands.textEditor.properties.rotation',
                commandKey: TEXT_RIBBON_KEYS.properties.rotation,
                comboboxWidthPx: 80,
                options: ROTATION_OPTIONS,
                // Rotation is a free degree value: allow negatives + decimals when typing
                // (presets are the common 0/45/90… snaps; the live rotate-grip writes any°).
                numericInput: { quantityKind: 'angle', allowNegative: true, allowDecimal: true },
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
                action: 'text-insert-symbol',
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
                icon: 'search',
                commandKey: 'text-find-replace',
                action: 'text-find-replace',
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
