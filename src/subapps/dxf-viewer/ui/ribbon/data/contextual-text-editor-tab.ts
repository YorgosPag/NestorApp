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

const FONT_HEIGHT_OPTIONS = [
  { value: '1', labelKey: '1.0', isLiteralLabel: true },
  { value: '2.5', labelKey: '2.5', isLiteralLabel: true },
  { value: '3.5', labelKey: '3.5', isLiteralLabel: true },
  { value: '5', labelKey: '5.0', isLiteralLabel: true },
  { value: '7', labelKey: '7.0', isLiteralLabel: true },
  { value: '10', labelKey: '10.0', isLiteralLabel: true },
] as const;

const LINE_SPACING_OPTIONS = [
  { value: '1.00', labelKey: '1.0', isLiteralLabel: true },
  { value: '1.15', labelKey: '1.15', isLiteralLabel: true },
  { value: '1.50', labelKey: '1.5', isLiteralLabel: true },
  { value: '2.00', labelKey: '2.0', isLiteralLabel: true },
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
              type: 'combobox',
              size: 'small',
              command: {
                id: 'text.font.family',
                labelKey: 'ribbon.commands.textEditor.font.family',
                commandKey: TEXT_RIBBON_KEYS.font.family,
                comboboxWidthPx: 180,
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
              type: 'toggle',
              size: 'small',
              command: {
                id: 'text.align.left',
                labelKey: 'ribbon.commands.textEditor.paragraph.alignLeft',
                icon: 'text-align-left',
                commandKey: TEXT_RIBBON_KEYS.align.left,
              },
            },
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'text.align.center',
                labelKey: 'ribbon.commands.textEditor.paragraph.alignCenter',
                icon: 'text-align-center',
                commandKey: TEXT_RIBBON_KEYS.align.center,
              },
            },
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'text.align.right',
                labelKey: 'ribbon.commands.textEditor.paragraph.alignRight',
                icon: 'text-align-right',
                commandKey: TEXT_RIBBON_KEYS.align.right,
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
                id: 'text.paragraph.lineSpacing',
                labelKey: 'ribbon.commands.textEditor.paragraph.lineSpacing',
                commandKey: TEXT_RIBBON_KEYS.paragraph.lineSpacing,
                comboboxWidthPx: 90,
                options: LINE_SPACING_OPTIONS,
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
              type: 'combobox',
              size: 'small',
              command: {
                id: 'text.properties.annotationScale',
                labelKey:
                  'ribbon.commands.textEditor.properties.annotationScale',
                commandKey: TEXT_RIBBON_KEYS.properties.annotationScale,
                comboboxWidthPx: 110,
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
