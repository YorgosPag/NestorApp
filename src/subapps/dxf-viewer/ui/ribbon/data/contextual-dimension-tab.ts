/**
 * ADR-362 Phase E2 + ADR-562 Φ4 — Contextual ribbon tab: DIMENSION editor.
 *
 * Appears in the tab bar when the primary selection is a DimensionEntity
 * (`type === 'dimension'`). AutoCAD/Revit pattern: one unified tab for all
 * 10 dimension sub-types (linear, radial, angular, ordinate, etc.).
 *
 * ADR-562 Φ4 — the single «Παράκαμψη» stub panel is split into AutoCAD-grade
 * PER-PART panels, each a ≤3-field column (Revit «Dimension Line / Extension
 * Lines / Arrowheads / Text»). Every per-part control routes through
 * `useRibbonDimBridge` → `entity.overrides` (undoable `UpdateEntityCommand`):
 *
 *   Στυλ            → DIMSTYLE chooser + Apply / Edit / Reset
 *   Γραμμή Διάστ.   → Χρώμα (dimclrd) · Πάχος (dimlwd) · Τύπος (dimltype)
 *   Προεκτάσεις     → Χρώμα (dimclre) · Πάχος (dimlwe) · Τύπος (dimltex1/2)
 *   Βελάκια         → Στυλ (dimblk) · Χρώμα (arrowColor) · Μέγεθος (dimasz)
 *   Κείμενο         → Χρώμα (dimclrt) · Γραμματοσειρά · Ύψος · Θέση · Στροφή · …
 *   Τροποποίηση     → DIMBREAK · DIMSPACE
 *   Ιδιότητες       → Layer · Annotation scale · Properties
 *
 * SSoT reuse (καμία διπλή λίστα): lineweight = `LINEWEIGHT_RIBBON_OPTIONS`
 * (shared)· linetype + arrow-style options = ΚΕΝΑ εδώ, τα τροφοδοτεί live το
 * bridge (`listSelectableLinetypeNames` / `listArrowheadBlockNames`).
 *
 * Trigger token: 'dim-selected' (resolved by `resolveContextualTrigger`
 * in `app/ribbon-contextual-config.ts` when `entity.type === 'dimension'`).
 */

import type { RibbonTab } from '../types/ribbon-types';
import { DIM_RIBBON_KEYS } from '../hooks/bridge/dim-command-keys';
import { LINEWEIGHT_RIBBON_OPTIONS } from './lineweight-ribbon-options';

export const DIMENSION_CONTEXTUAL_TRIGGER = 'dim-selected';

// Static DIMSTYLE presets (E2 stub — Phase F bridges to DimStyleRegistry).
const DIMSTYLE_OPTIONS = [
  { value: 'iso-129',       labelKey: 'ribbon.commands.dimContextual.styleOptions.iso',           isLiteralLabel: false },
  { value: 'asme-y14',      labelKey: 'ribbon.commands.dimContextual.styleOptions.asme',          isLiteralLabel: false },
  { value: 'architectural', labelKey: 'ribbon.commands.dimContextual.styleOptions.architectural', isLiteralLabel: false },
] as const;

// ADR-562 Φ4 — ByLayer + 7 standard ACI colors (value = ACI string / 'ByLayer',
// parsed by the bridge). Shared across every per-part color control.
const COLOR_OPTIONS = [
  { value: 'ByLayer', labelKey: 'ribbon.commands.dimContextual.colorOptions.byLayer', isLiteralLabel: false },
  { value: '1',       labelKey: 'ribbon.commands.dimContextual.colorOptions.red',     isLiteralLabel: false },
  { value: '2',       labelKey: 'ribbon.commands.dimContextual.colorOptions.yellow',  isLiteralLabel: false },
  { value: '3',       labelKey: 'ribbon.commands.dimContextual.colorOptions.green',   isLiteralLabel: false },
  { value: '4',       labelKey: 'ribbon.commands.dimContextual.colorOptions.cyan',    isLiteralLabel: false },
  { value: '5',       labelKey: 'ribbon.commands.dimContextual.colorOptions.blue',    isLiteralLabel: false },
  { value: '6',       labelKey: 'ribbon.commands.dimContextual.colorOptions.magenta', isLiteralLabel: false },
  { value: '7',       labelKey: 'ribbon.commands.dimContextual.colorOptions.white',   isLiteralLabel: false },
] as const;

// Arrow size presets (paper mm). Numeric literals — editable (type any value).
const ARROW_SIZE_OPTIONS = [
  { value: '1.5', labelKey: '1.5', isLiteralLabel: true },
  { value: '2.0', labelKey: '2.0', isLiteralLabel: true },
  { value: '2.5', labelKey: '2.5', isLiteralLabel: true },
  { value: '3.5', labelKey: '3.5', isLiteralLabel: true },
  { value: '5.0', labelKey: '5.0', isLiteralLabel: true },
] as const;

// Font-family presets (names are literal — not translatable).
const FONT_OPTIONS = [
  { value: 'Arial',           labelKey: 'Arial',           isLiteralLabel: true },
  { value: 'Roboto',          labelKey: 'Roboto',          isLiteralLabel: true },
  { value: 'Helvetica',       labelKey: 'Helvetica',       isLiteralLabel: true },
  { value: 'Times New Roman', labelKey: 'Times New Roman', isLiteralLabel: true },
  { value: 'Courier New',     labelKey: 'Courier New',     isLiteralLabel: true },
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

const O = DIM_RIBBON_KEYS.override;

export const DIMENSION_CONTEXTUAL_TAB: RibbonTab = {
  id: 'dimension',
  labelKey: 'ribbon.tabs.dimension',
  isContextual: true,
  contextualTrigger: DIMENSION_CONTEXTUAL_TRIGGER,
  panels: [
    // (A) Στυλ — DIMSTYLE chooser + apply / edit / reset
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
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'dim.override.reset',
                labelKey: 'ribbon.commands.dimResetOverrides',
                icon: 'dim-reset-overrides',
                commandKey: O.resetOverrides,
                comingSoon: true,
              },
            },
          ],
        },
      ],
    },
    // (B) Γραμμή Διάστασης — χρώμα / πάχος / τύπος (ADR-562 Φ4)
    {
      id: 'dim-line',
      labelKey: 'ribbon.panels.dimLine',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.override.color',
                labelKey: 'ribbon.commands.dimColorOverride',
                commandKey: O.color,
                comboboxWidthPx: 110,
                options: COLOR_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.override.lineWeight',
                labelKey: 'ribbon.commands.dimLineWeight',
                commandKey: O.lineWeight,
                comboboxWidthPx: 100,
                options: LINEWEIGHT_RIBBON_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.override.lineType',
                labelKey: 'ribbon.commands.dimLineType',
                commandKey: O.lineType,
                comboboxWidthPx: 120,
                // Options supplied live by the bridge (LinetypeRegistry).
                options: [],
              },
            },
          ],
        },
      ],
    },
    // (C) Προεκτάσεις — χρώμα / πάχος / τύπος
    {
      id: 'dim-ext',
      labelKey: 'ribbon.panels.dimExt',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.override.extColor',
                labelKey: 'ribbon.commands.dimExtColor',
                commandKey: O.extColor,
                comboboxWidthPx: 110,
                options: COLOR_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.override.extWeight',
                labelKey: 'ribbon.commands.dimExtWeight',
                commandKey: O.extWeight,
                comboboxWidthPx: 100,
                options: LINEWEIGHT_RIBBON_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.override.extType',
                labelKey: 'ribbon.commands.dimExtType',
                commandKey: O.extType,
                comboboxWidthPx: 120,
                options: [],
              },
            },
          ],
        },
      ],
    },
    // (D) Βελάκια — στυλ / χρώμα / μέγεθος
    {
      id: 'dim-arrow',
      labelKey: 'ribbon.panels.dimArrow',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.override.arrowStyle',
                labelKey: 'ribbon.commands.dimArrowStyle',
                commandKey: O.arrowStyle,
                comboboxWidthPx: 130,
                // Options supplied live by the bridge (20 arrowhead blocks).
                options: [],
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.override.arrowColor',
                labelKey: 'ribbon.commands.dimArrowColor',
                commandKey: O.arrowColor,
                comboboxWidthPx: 110,
                options: COLOR_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.override.arrowSize',
                labelKey: 'ribbon.commands.dimArrowSize',
                commandKey: O.arrowSize,
                comboboxWidthPx: 80,
                options: ARROW_SIZE_OPTIONS,
                // Editable paper-mm size (> 0).
                numericInput: { editable: true, min: 0 },
              },
            },
          ],
        },
      ],
    },
    // (E) Κείμενο — χρώμα / γραμματοσειρά / ύψος / θέση / στροφή / override / mask
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
                id: 'dim.override.textColor',
                labelKey: 'ribbon.commands.dimTextColor',
                commandKey: O.textColor,
                comboboxWidthPx: 110,
                options: COLOR_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.override.textFont',
                labelKey: 'ribbon.commands.dimTextFont',
                commandKey: O.textFont,
                comboboxWidthPx: 130,
                options: FONT_OPTIONS,
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
            // ADR-362 Phase K3 — DIMTFILL background mask toggle
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'dim.text.tfillToggle',
                labelKey: 'ribbon.commands.dimTfillToggle',
                icon: 'dim-tfill-toggle',
                commandKey: DIM_RIBBON_KEYS.text.tfillToggle,
                comingSoon: true,
              },
            },
          ],
        },
      ],
    },
    // (F) Τροποποίηση — DIMBREAK + DIMSPACE (ADR-362 Phase K)
    {
      id: 'dim-modify',
      labelKey: 'ribbon.panels.dimModify',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'dim.modify.dimBreak',
                labelKey: 'ribbon.commands.dimBreak',
                icon: 'dim-break',
                commandKey: DIM_RIBBON_KEYS.modify.dimBreak,
                action: DIM_RIBBON_KEYS.modify.dimBreak,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'dim.modify.dimSpace',
                labelKey: 'ribbon.commands.dimSpace',
                icon: 'dim-space',
                commandKey: DIM_RIBBON_KEYS.modify.dimSpace,
                action: DIM_RIBBON_KEYS.modify.dimSpace,
              },
            },
          ],
        },
      ],
    },
    // (G) Ιδιότητες — layer + annotation scale
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
