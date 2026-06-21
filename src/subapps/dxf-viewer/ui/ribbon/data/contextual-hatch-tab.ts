/**
 * ADR-507 S2 — Contextual ribbon tab για τη γραμμοσκίαση (hatch).
 *
 * Trigger: `hatch-selected` — εμφανίζεται είτε όταν είναι ενεργό το εργαλείο
 * «Γραμμοσκίαση» (tool-active → επεξεργασία draw-defaults για την επόμενη), είτε
 * όταν είναι επιλεγμένο ένα `HatchEntity` (επεξεργασία της ίδιας της οντότητας).
 *
 * Panels:
 *   Γέμισμα  → fill type + χρώμα
 *   Μοτίβο   → γωνία + απόσταση + διπλή σταυρωτή + island style (user-defined)
 *   Πληροφορίες → live εμβαδόν (read-only)
 *   Ενέργειες → close + delete
 *
 * Πρότυπο: `contextual-floor-finish-tab.ts`. Select = ADR-001 (RibbonCombobox).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import { HATCH_RIBBON_KEYS } from '../hooks/bridge/hatch-command-keys';
import { listHatchPatterns } from '../../../data/hatch-pattern-catalog';

export const HATCH_CONTEXTUAL_TRIGGER = 'hatch-selected';

// ─── Combobox options ─────────────────────────────────────────────────────────

const FILL_TYPE_OPTIONS = [
  { value: 'solid', labelKey: 'ribbon.commands.hatchEditor.fillTypeSolid', isLiteralLabel: false },
  { value: 'user-defined', labelKey: 'ribbon.commands.hatchEditor.fillTypeUserDefined', isLiteralLabel: false },
  { value: 'predefined', labelKey: 'ribbon.commands.hatchEditor.fillTypePredefined', isLiteralLabel: false },
] as const;

/** Predefined μοτίβα — options από τον PAT catalog (SSoT), label μέσω i18n key. */
const PATTERN_NAME_OPTIONS = listHatchPatterns().map((p) => ({
  value: p.name, labelKey: p.labelKey, isLiteralLabel: false,
}));

const PATTERN_SCALE_OPTIONS = [
  { value: '0.5', labelKey: '×0.5', isLiteralLabel: true },
  { value: '1', labelKey: '×1', isLiteralLabel: true },
  { value: '2', labelKey: '×2', isLiteralLabel: true },
  { value: '5', labelKey: '×5', isLiteralLabel: true },
  { value: '10', labelKey: '×10', isLiteralLabel: true },
  { value: '25', labelKey: '×25', isLiteralLabel: true },
  { value: '50', labelKey: '×50', isLiteralLabel: true },
] as const;

const ISLAND_STYLE_OPTIONS = [
  { value: 'normal', labelKey: 'ribbon.commands.hatchEditor.islandNormal', isLiteralLabel: false },
  { value: 'outer', labelKey: 'ribbon.commands.hatchEditor.islandOuter', isLiteralLabel: false },
  { value: 'ignore', labelKey: 'ribbon.commands.hatchEditor.islandIgnore', isLiteralLabel: false },
] as const;

/** Preset χρώματα (value=hex, label=i18n όνομα — N.11: μηδέν literal label). */
const FILL_COLOR_OPTIONS = [
  { value: '#000000', labelKey: 'ribbon.commands.hatchEditor.colors.black', isLiteralLabel: false },
  { value: '#404040', labelKey: 'ribbon.commands.hatchEditor.colors.darkGray', isLiteralLabel: false },
  { value: '#808080', labelKey: 'ribbon.commands.hatchEditor.colors.gray', isLiteralLabel: false },
  { value: '#c0c0c0', labelKey: 'ribbon.commands.hatchEditor.colors.lightGray', isLiteralLabel: false },
  { value: '#ffffff', labelKey: 'ribbon.commands.hatchEditor.colors.white', isLiteralLabel: false },
  { value: '#c0392b', labelKey: 'ribbon.commands.hatchEditor.colors.red', isLiteralLabel: false },
  { value: '#2980b9', labelKey: 'ribbon.commands.hatchEditor.colors.blue', isLiteralLabel: false },
  { value: '#27ae60', labelKey: 'ribbon.commands.hatchEditor.colors.green', isLiteralLabel: false },
] as const;

const LINE_ANGLE_OPTIONS = [
  { value: '0', labelKey: '0°', isLiteralLabel: true },
  { value: '45', labelKey: '45°', isLiteralLabel: true },
  { value: '90', labelKey: '90°', isLiteralLabel: true },
  { value: '135', labelKey: '135°', isLiteralLabel: true },
] as const;

const LINE_SPACING_OPTIONS = [
  { value: '25', labelKey: '25 mm', isLiteralLabel: true },
  { value: '50', labelKey: '50 mm', isLiteralLabel: true },
  { value: '100', labelKey: '100 mm', isLiteralLabel: true },
  { value: '150', labelKey: '150 mm', isLiteralLabel: true },
  { value: '200', labelKey: '200 mm', isLiteralLabel: true },
  { value: '300', labelKey: '300 mm', isLiteralLabel: true },
] as const;

// ─── Tab definition ───────────────────────────────────────────────────────────

export const CONTEXTUAL_HATCH_TAB: RibbonTab = {
  id: 'hatch-editor',
  labelKey: 'ribbon.tabs.hatchProperties',
  isContextual: true,
  contextualTrigger: HATCH_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'hatch-fill',
      labelKey: 'ribbon.panels.hatchFill',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'hatch.fillType',
                labelKey: 'ribbon.commands.hatchEditor.fillType',
                commandKey: HATCH_RIBBON_KEYS.stringParams.fillType,
                comboboxWidthPx: 150,
                options: FILL_TYPE_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'hatch.fillColor',
                labelKey: 'ribbon.commands.hatchEditor.fillColor',
                commandKey: HATCH_RIBBON_KEYS.stringParams.fillColor,
                comboboxWidthPx: 140,
                options: FILL_COLOR_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'hatch-pattern',
      labelKey: 'ribbon.panels.hatchPattern',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'hatch.patternName',
                labelKey: 'ribbon.commands.hatchEditor.patternName',
                commandKey: HATCH_RIBBON_KEYS.stringParams.patternName,
                comboboxWidthPx: 160,
                options: PATTERN_NAME_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'hatch.patternScale',
                labelKey: 'ribbon.commands.hatchEditor.patternScale',
                commandKey: HATCH_RIBBON_KEYS.params.patternScale,
                comboboxWidthPx: 90,
                options: PATTERN_SCALE_OPTIONS,
                numericInput: { editable: true, min: 0.01 },
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
                id: 'hatch.lineAngle',
                labelKey: 'ribbon.commands.hatchEditor.lineAngle',
                commandKey: HATCH_RIBBON_KEYS.params.lineAngle,
                comboboxWidthPx: 90,
                options: LINE_ANGLE_OPTIONS,
                numericInput: { editable: true, min: 0, max: 360 },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'hatch.lineSpacing',
                labelKey: 'ribbon.commands.hatchEditor.lineSpacing',
                commandKey: HATCH_RIBBON_KEYS.params.lineSpacing,
                comboboxWidthPx: 100,
                options: LINE_SPACING_OPTIONS,
                numericInput: { editable: true, min: 1 },
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
                id: 'hatch.doubleCrossHatch',
                labelKey: 'ribbon.commands.hatchEditor.doubleCrossHatch',
                icon: 'array-rect',
                commandKey: HATCH_RIBBON_KEYS.toggles.doubleCrossHatch,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'hatch.islandStyle',
                labelKey: 'ribbon.commands.hatchEditor.islandStyle',
                commandKey: HATCH_RIBBON_KEYS.stringParams.islandStyle,
                comboboxWidthPx: 130,
                options: ISLAND_STYLE_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'hatch-info',
      labelKey: 'ribbon.panels.hatchInfo',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'hatch.area',
                labelKey: 'ribbon.commands.hatchEditor.area',
                commandKey: HATCH_RIBBON_KEYS.readouts.area,
                comboboxWidthPx: 120,
                options: [],
                numericInput: { editable: false },
              },
            },
          ],
        },
      ],
    },
    {
      id: 'hatch-actions',
      labelKey: 'ribbon.panels.hatchActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'hatch.close',
                labelKey: 'ribbon.commands.hatchEditor.close',
                icon: 'select',
                commandKey: HATCH_RIBBON_KEYS.actions.close,
                action: HATCH_RIBBON_KEYS.actions.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'hatch.delete',
                labelKey: 'ribbon.commands.hatchEditor.delete',
                icon: 'trash',
                commandKey: HATCH_RIBBON_KEYS.actions.delete,
                action: HATCH_RIBBON_KEYS.actions.delete,
              },
            },
          ],
        },
      ],
    },
  ],
};
