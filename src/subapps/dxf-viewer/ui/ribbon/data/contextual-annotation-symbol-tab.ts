/**
 * ADR-583 — Contextual ribbon tab for the annotation symbol library (North arrow).
 *
 * Trigger: `annotation-symbol-tool-active` (dispatched from
 * `app/ribbon-contextual-config.ts` when `activeTool === 'north-arrow'`). Lets the
 * user pick WHICH variant + size + initial rotation to place before clicking, bound
 * live to `annotation-symbol-selection-store` via `useRibbonAnnotationSymbolBridge`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-583-annotation-symbol-library-north-arrow.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import { ANNOTATION_SYMBOL_RIBBON_KEYS } from '../hooks/bridge/annotation-symbol-command-keys';
import { listAnnotationSymbolsByKind } from '../../../config/annotation-symbol-catalog';
import { literalNumberOptions } from './ribbon-numeric-options';

export const ANNOTATION_SYMBOL_CONTEXTUAL_TRIGGER = 'annotation-symbol-tool-active';

/** Variant options GENERATED from the catalog SSoT (never hand-listed). */
const VARIANT_OPTIONS = listAnnotationSymbolsByKind('north-arrow').map((d) => ({
  value: d.id,
  labelKey: d.labelKey,
  isLiteralLabel: false,
}));

/** Paper-height presets (mm). Literal labels — the number IS the label. */
const SIZE_MM_OPTIONS = [
  { value: '10', labelKey: '10', isLiteralLabel: true },
  { value: '15', labelKey: '15', isLiteralLabel: true },
  { value: '20', labelKey: '20', isLiteralLabel: true },
  { value: '25', labelKey: '25', isLiteralLabel: true },
  { value: '30', labelKey: '30', isLiteralLabel: true },
] as const;

const ROTATION_DEG_OPTIONS = literalNumberOptions([0, 45, 90, 135, 180, 225, 270, 315]);

export const CONTEXTUAL_ANNOTATION_SYMBOL_TAB: RibbonTab = {
  id: 'annotation-symbol-editor',
  labelKey: 'ribbon.tabs.annotationSymbolProperties',
  isContextual: true,
  contextualTrigger: ANNOTATION_SYMBOL_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'annotation-symbol-catalog',
      labelKey: 'ribbon.panels.annotationSymbolCatalog',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'annotationSymbol.variant',
                labelKey: 'ribbon.commands.annotationSymbolEditor.variant',
                commandKey: ANNOTATION_SYMBOL_RIBBON_KEYS.stringParams.symbolId,
                comboboxWidthPx: 180,
                options: VARIANT_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'annotation-symbol-geometry',
      labelKey: 'ribbon.panels.annotationSymbolGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'annotationSymbol.size',
                labelKey: 'ribbon.commands.annotationSymbolEditor.size',
                commandKey: ANNOTATION_SYMBOL_RIBBON_KEYS.params.sizeMm,
                comboboxWidthPx: 80,
                options: SIZE_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'annotationSymbol.rotation',
                labelKey: 'ribbon.commands.annotationSymbolEditor.rotation',
                commandKey: ANNOTATION_SYMBOL_RIBBON_KEYS.params.rotation,
                comboboxWidthPx: 80,
                options: ROTATION_DEG_OPTIONS,
              },
            },
          ],
        },
      ],
    },
  ],
};
