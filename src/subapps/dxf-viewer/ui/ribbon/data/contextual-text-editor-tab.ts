/**
 * ADR-345 §5.4 Fase 5B — Contextual tab: TEXT EDITOR.
 *
 * Appears in the tab bar with accent color when the primary selection
 * is a TEXT or MTEXT entity. Panels are scaffolded with a single
 * placeholder button per panel — concrete controls (font combobox,
 * bold/italic toggles, layer dropdown, find/replace dialog) are wired
 * in a follow-up phase (5.5), which requires new RibbonCombobox /
 * RibbonToggleButton components.
 *
 * Trigger token: 'text-selected' (matched against `activeContextualTrigger`
 * prop on RibbonRoot, driven by selection state in DxfViewerContent).
 */

import type { RibbonTab } from '../types/ribbon-types';

export const TEXT_EDITOR_CONTEXTUAL_TRIGGER = 'text-selected';

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
              type: 'simple',
              size: 'large',
              command: {
                id: 'text.font.placeholder',
                labelKey: 'ribbon.commands.textEditor.fontPlaceholder',
                icon: 'text-placeholder',
                commandKey: 'text-font-placeholder',
                comingSoon: true,
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
              type: 'simple',
              size: 'large',
              command: {
                id: 'text.paragraph.placeholder',
                labelKey: 'ribbon.commands.textEditor.paragraphPlaceholder',
                icon: 'text-placeholder',
                commandKey: 'text-paragraph-placeholder',
                comingSoon: true,
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
              type: 'simple',
              size: 'large',
              command: {
                id: 'text.properties.placeholder',
                labelKey: 'ribbon.commands.textEditor.propertiesPlaceholder',
                icon: 'text-placeholder',
                commandKey: 'text-properties-placeholder',
                comingSoon: true,
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
              size: 'large',
              command: {
                id: 'text.insert.placeholder',
                labelKey: 'ribbon.commands.textEditor.insertPlaceholder',
                icon: 'text-placeholder',
                commandKey: 'text-insert-placeholder',
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
              size: 'large',
              command: {
                id: 'text.editor.placeholder',
                labelKey: 'ribbon.commands.textEditor.editorPlaceholder',
                icon: 'text-placeholder',
                commandKey: 'text-editor-placeholder',
                comingSoon: true,
              },
            },
          ],
        },
      ],
    },
  ],
};
