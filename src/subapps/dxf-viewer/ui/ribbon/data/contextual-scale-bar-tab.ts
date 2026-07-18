/**
 * ADR-583 Φ3e — Contextual ribbon tab for the graphic scale-bar (γραφική κλίμακα).
 *
 * Trigger: `scale-bar-tool-active`. DUAL mode (mirror the annotation-symbol tab):
 *   - a SELECTED scale-bar surfaces this tab → edits mutate that entity live
 *     (`UpdateEntityCommand` → derived `computeScaleBarGeometry` recomputes at render);
 *   - the `scale-bar` placement tool active (before the 2nd click) → the same tab
 *     edits the `scale-bar-options-store` defaults for the NEXT bar.
 *
 * The `useRibbonScaleBarBridge` reads/writes both sides. Every option list is
 * STATIC (declared here) — the bridge supplies only the current value (returns
 * `options: []`, so `RibbonCombobox` falls back to these `command.options`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-583-annotation-symbol-library-north-arrow.md
 */

import type { RibbonTab, RibbonComboboxOption } from '../types/ribbon-types';
import { SCALE_BAR_RIBBON_KEYS } from '../hooks/bridge/scale-bar-command-keys';

export const SCALE_BAR_CONTEXTUAL_TRIGGER = 'scale-bar-tool-active';

const CMD = 'ribbon.commands.scaleBarEditor';

/** Body-style options — `value` is the `ScaleBarStyle` literal; label from i18n. */
const STYLE_OPTIONS: readonly RibbonComboboxOption[] = [
  { value: 'alternating', labelKey: `${CMD}.styleOptions.alternating`, isLiteralLabel: false },
  { value: 'hollow', labelKey: `${CMD}.styleOptions.hollow`, isLiteralLabel: false },
  { value: 'line-ticks', labelKey: `${CMD}.styleOptions.lineTicks`, isLiteralLabel: false },
  { value: 'double', labelKey: `${CMD}.styleOptions.double`, isLiteralLabel: false },
];

/** Real-world unit options — `value` is the `SceneUnits` literal, shown verbatim. */
const UNIT_OPTIONS: readonly RibbonComboboxOption[] = (['mm', 'cm', 'm', 'in', 'ft'] as const).map(
  (u) => ({ value: u, labelKey: u, isLiteralLabel: true }),
);

/** Numeral-side options — `value` is the `ScaleBarLabelPlacement` literal; label from i18n. */
const LABEL_PLACEMENT_OPTIONS: readonly RibbonComboboxOption[] = [
  { value: 'below', labelKey: `${CMD}.labelPlacementOptions.below`, isLiteralLabel: false },
  { value: 'above', labelKey: `${CMD}.labelPlacementOptions.above`, isLiteralLabel: false },
];

/** Literal numeric presets — the number IS the label (Revit type-to-enter editable). */
const numOptions = (values: readonly number[]): readonly RibbonComboboxOption[] =>
  values.map((v) => ({ value: String(v), labelKey: String(v), isLiteralLabel: true }));

const DIVISION_OPTIONS = numOptions([2, 3, 4, 5, 6, 8, 10]);
const SUBDIVISION_OPTIONS = numOptions([0, 2, 4, 5, 10]);
const BAR_HEIGHT_OPTIONS = numOptions([2, 3, 4, 5, 6]);
const LABEL_HEIGHT_OPTIONS = numOptions([1.5, 2, 2.5, 3, 4]);

export const CONTEXTUAL_SCALE_BAR_TAB: RibbonTab = {
  id: 'scale-bar-editor',
  labelKey: 'ribbon.tabs.scaleBarProperties',
  isContextual: true,
  contextualTrigger: SCALE_BAR_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'scale-bar-style',
      labelKey: 'ribbon.panels.scaleBarStyle',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'scaleBar.style',
                labelKey: `${CMD}.style`,
                commandKey: SCALE_BAR_RIBBON_KEYS.stringParams.style,
                comboboxWidthPx: 180,
                options: STYLE_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'scaleBar.unit',
                labelKey: `${CMD}.unit`,
                commandKey: SCALE_BAR_RIBBON_KEYS.stringParams.unit,
                comboboxWidthPx: 80,
                options: UNIT_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'scale-bar-divisions',
      labelKey: 'ribbon.panels.scaleBarDivisions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'scaleBar.divisions',
                labelKey: `${CMD}.divisions`,
                commandKey: SCALE_BAR_RIBBON_KEYS.params.divisions,
                comboboxWidthPx: 80,
                options: DIVISION_OPTIONS,
                numericInput: { quantityKind: 'count' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'scaleBar.subdivisions',
                labelKey: `${CMD}.subdivisions`,
                commandKey: SCALE_BAR_RIBBON_KEYS.params.subdivisions,
                comboboxWidthPx: 80,
                options: SUBDIVISION_OPTIONS,
                numericInput: { quantityKind: 'count' },
              },
            },
          ],
        },
      ],
    },
    {
      id: 'scale-bar-labels',
      labelKey: 'ribbon.panels.scaleBarLabels',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'scaleBar.barHeight',
                labelKey: `${CMD}.barHeight`,
                commandKey: SCALE_BAR_RIBBON_KEYS.params.barHeightMm,
                comboboxWidthPx: 100,
                options: BAR_HEIGHT_OPTIONS,
                numericInput: { quantityKind: 'paper-length' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'scaleBar.labelHeight',
                labelKey: `${CMD}.labelHeight`,
                commandKey: SCALE_BAR_RIBBON_KEYS.params.labelHeightMm,
                comboboxWidthPx: 100,
                options: LABEL_HEIGHT_OPTIONS,
                numericInput: { quantityKind: 'paper-length' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'scaleBar.labelPlacement',
                labelKey: `${CMD}.labelPlacement`,
                commandKey: SCALE_BAR_RIBBON_KEYS.stringParams.labelPlacement,
                comboboxWidthPx: 100,
                options: LABEL_PLACEMENT_OPTIONS,
              },
            },
          ],
        },
      ],
    },
  ],
};
