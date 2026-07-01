/**
 * ADR-357 Phase 17 / ADR-510 Φ2E + Φ4 — Contextual ribbon tab for a drawing
 * primitive: draw-time «Quick Style» defaults AND a selected-entity property
 * editor (Revit «διάλεξε → σχεδίασε» + «επίλεξε → επεξεργάσου»).
 *
 * ADR-510 Φ4 — the fields were a single 5-combobox column that forced vertical
 * scrolling. They are now split into AutoCAD-grade panels laid out HORIZONTALLY
 * (each panel = a ≤3-field column → zero scroll):
 *
 *   Γενικά (General)         → Χρώμα · Επίπεδο · Διαφάνεια
 *   Εμφάνιση Γραμμής         → [Τύπος · Πάχος · Κλίμακα] [Πλάτος]
 *   Γεωμετρία (line-only)    → [Μήκος · Γωνία] [Αρχή Χ · Αρχή Υ] [Τέλος Χ · Τέλος Υ] [ΔΧ · ΔΥ]
 *
 * ALL fields are visible inline (Giorgio 2026-07-01): every `RibbonRow` is a
 * NON-flyout column, and the panel body lays its rows out HORIZONTALLY
 * (`.dxf-ribbon-panel-body` = flex-row), so 2-field columns spread sideways with
 * zero vertical scroll AND zero flyout expander — nothing is hidden behind a ▼.
 *
 * The Geometry panel self-hides for non-`line` primitives via `visibilityKey`
 * (`getPanelVisibility` in `useRibbonLineToolBridge`).
 *
 * Bridge: `useRibbonLineToolBridge`. Store SSoT: `stores/QuickStyleStore.ts`
 * (draw-defaults) + `UpdateEntityCommand` (selected entity).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-510-line-creation-system.md §Φ4
 * @see docs/centralized-systems/reference/adrs/ADR-357-dxf-line-tool-google-level.md §G15
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  LINE_TOOL_RIBBON_KEYS,
  LINE_TOOL_PANEL_VISIBILITY_KEYS,
} from '../hooks/bridge/line-tool-command-keys';
import { LINETYPE_ISO_NAMES } from '../../../config/linetype-iso-catalog';
// ADR-357 §G15 / ADR-507 Φ2 — ByLayer + ISO subset, shared SSoT (boy-scout extract).
import { LINEWEIGHT_RIBBON_OPTIONS } from './lineweight-ribbon-options';

export const LINE_TOOL_CONTEXTUAL_TRIGGER = 'line-tool-active';

// ─── Lineweight options ───────────────────────────────────────────────────────

const LINEWEIGHT_OPTIONS = LINEWEIGHT_RIBBON_OPTIONS;

// ─── Linetype options ─────────────────────────────────────────────────────────
// ByLayer + all 8 ISO baseline names (SSoT: linetype-iso-catalog.ts).

const LINETYPE_OPTIONS = [
  { value: 'ByLayer', labelKey: 'ByLayer', isLiteralLabel: true },
  ...LINETYPE_ISO_NAMES.map((name) => ({
    value: name,
    labelKey: name,
    isLiteralLabel: true as const,
  })),
] as const;

// ─── Color options ────────────────────────────────────────────────────────────
// ByLayer + 7 standard ACI colors (value = ACI number as string).

const COLOR_OPTIONS = [
  { value: 'ByLayer', labelKey: 'ByLayer',  isLiteralLabel: true },
  { value: '1',       labelKey: 'Red',      isLiteralLabel: true },
  { value: '2',       labelKey: 'Yellow',   isLiteralLabel: true },
  { value: '3',       labelKey: 'Green',    isLiteralLabel: true },
  { value: '4',       labelKey: 'Cyan',     isLiteralLabel: true },
  { value: '5',       labelKey: 'Blue',     isLiteralLabel: true },
  { value: '6',       labelKey: 'Magenta',  isLiteralLabel: true },
  { value: '7',       labelKey: 'White',    isLiteralLabel: true },
] as const;

// ─── Linetype scale (CELTSCALE) options ───────────────────────────────────────
// Numeric presets → RibbonCombobox renders an EDITABLE type-to-enter field (the
// list is purely numeric); `numericInput.editable` keeps free typing too.

const LINETYPE_SCALE_OPTIONS = [
  { value: '0.25', labelKey: '0.25', isLiteralLabel: true },
  { value: '0.5',  labelKey: '0.5',  isLiteralLabel: true },
  { value: '1',    labelKey: '1',    isLiteralLabel: true },
  { value: '2',    labelKey: '2',    isLiteralLabel: true },
  { value: '4',    labelKey: '4',    isLiteralLabel: true },
] as const;

// ─── Polyline width options (ADR-510 Φ3d) ─────────────────────────────────────
// Edge-to-edge width in the ACTIVE display unit (default cm). Presets are just
// shortcuts — the field is editable (numericInput), so any value can be typed.
// 0 = hairline. Values chosen to be VISIBLE at the default cm unit (1 cm = 10 mm).

const WIDTH_OPTIONS = [
  { value: '0',  labelKey: '0',  isLiteralLabel: true },
  { value: '1',  labelKey: '1',  isLiteralLabel: true },
  { value: '2',  labelKey: '2',  isLiteralLabel: true },
  { value: '5',  labelKey: '5',  isLiteralLabel: true },
  { value: '10', labelKey: '10', isLiteralLabel: true },
] as const;

// ─── Transparency options (ADR-510 Φ4) ────────────────────────────────────────
// AutoCAD object transparency 0 (opaque) .. 90. Editable integer, presets are
// shortcuts. Draw-defaults show 0.

const TRANSPARENCY_OPTIONS = [
  { value: '0',  labelKey: '0',  isLiteralLabel: true },
  { value: '25', labelKey: '25', isLiteralLabel: true },
  { value: '50', labelKey: '50', isLiteralLabel: true },
  { value: '75', labelKey: '75', isLiteralLabel: true },
  { value: '90', labelKey: '90', isLiteralLabel: true },
] as const;

// ADR-510 Φ4 — editable numeric config for a signed display-unit coordinate/delta.
const COORD_INPUT = { editable: true, allowNegative: true, allowDecimal: true } as const;

// ─── Tab definition ───────────────────────────────────────────────────────────

export const CONTEXTUAL_LINE_TOOL_TAB: RibbonTab = {
  id: 'line-tool-style',
  labelKey: 'ribbon.tabs.lineToolStyle',
  isContextual: true,
  contextualTrigger: LINE_TOOL_CONTEXTUAL_TRIGGER,
  panels: [
    // ── Γενικά (AutoCAD «General») ────────────────────────────────────────────
    {
      id: 'line-general',
      labelKey: 'ribbon.panels.lineGeneral',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineToolStyle.color',
                labelKey: 'ribbon.commands.quickStyle.color',
                commandKey: LINE_TOOL_RIBBON_KEYS.color,
                comboboxWidthPx: 100,
                options: COLOR_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineToolStyle.layer',
                labelKey: 'ribbon.commands.quickStyle.layer',
                commandKey: LINE_TOOL_RIBBON_KEYS.layer,
                comboboxWidthPx: 150,
                // Options come from the bridge (live LayerStore).
                options: [],
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineToolStyle.transparency',
                labelKey: 'ribbon.commands.quickStyle.transparency',
                commandKey: LINE_TOOL_RIBBON_KEYS.transparency,
                comboboxWidthPx: 80,
                options: TRANSPARENCY_OPTIONS,
                numericInput: { editable: true, min: 0, max: 90, allowDecimal: false },
              },
            },
          ],
        },
      ],
    },
    // ── Εμφάνιση Γραμμής (linetype / lineweight / scale + width flyout) ────────
    {
      id: 'line-appearance',
      labelKey: 'ribbon.panels.lineAppearance',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineToolStyle.linetype',
                labelKey: 'ribbon.commands.quickStyle.linetype',
                commandKey: LINE_TOOL_RIBBON_KEYS.linetype,
                comboboxWidthPx: 120,
                options: LINETYPE_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineToolStyle.lineweight',
                labelKey: 'ribbon.commands.quickStyle.lineweight',
                commandKey: LINE_TOOL_RIBBON_KEYS.lineweight,
                comboboxWidthPx: 100,
                options: LINEWEIGHT_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineToolStyle.linetypeScale',
                labelKey: 'ribbon.commands.quickStyle.linetypeScale',
                commandKey: LINE_TOOL_RIBBON_KEYS.linetypeScale,
                comboboxWidthPx: 80,
                options: LINETYPE_SCALE_OPTIONS,
                // ADR-510 Φ2E #2 — editable numeric (CELTSCALE > 0), Revit-grade.
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
                id: 'lineToolStyle.width',
                labelKey: 'ribbon.commands.quickStyle.width',
                commandKey: LINE_TOOL_RIBBON_KEYS.width,
                comboboxWidthPx: 80,
                options: WIDTH_OPTIONS,
                // ADR-510 Φ3d — editable numeric polyline width (≥ 0, display unit).
                numericInput: { editable: true, min: 0 },
              },
            },
          ],
        },
      ],
    },
    // ── Γεωμετρία (AutoCAD «Geometry», line-only → self-hides otherwise) ───────
    {
      id: 'line-geometry',
      labelKey: 'ribbon.panels.lineGeometry',
      visibilityKey: LINE_TOOL_PANEL_VISIBILITY_KEYS.geometry,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineToolStyle.length',
                labelKey: 'ribbon.commands.quickStyle.length',
                commandKey: LINE_TOOL_RIBBON_KEYS.length,
                comboboxWidthPx: 90,
                options: [],
                numericInput: { editable: true, allowDecimal: true, min: 0.0001 },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineToolStyle.angle',
                labelKey: 'ribbon.commands.quickStyle.angle',
                commandKey: LINE_TOOL_RIBBON_KEYS.angle,
                comboboxWidthPx: 90,
                options: [],
                numericInput: { editable: true, allowNegative: true, allowDecimal: true },
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
                id: 'lineToolStyle.startX',
                labelKey: 'ribbon.commands.quickStyle.startX',
                commandKey: LINE_TOOL_RIBBON_KEYS.startX,
                comboboxWidthPx: 90,
                options: [],
                numericInput: COORD_INPUT,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineToolStyle.startY',
                labelKey: 'ribbon.commands.quickStyle.startY',
                commandKey: LINE_TOOL_RIBBON_KEYS.startY,
                comboboxWidthPx: 90,
                options: [],
                numericInput: COORD_INPUT,
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
                id: 'lineToolStyle.endX',
                labelKey: 'ribbon.commands.quickStyle.endX',
                commandKey: LINE_TOOL_RIBBON_KEYS.endX,
                comboboxWidthPx: 90,
                options: [],
                numericInput: COORD_INPUT,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineToolStyle.endY',
                labelKey: 'ribbon.commands.quickStyle.endY',
                commandKey: LINE_TOOL_RIBBON_KEYS.endY,
                comboboxWidthPx: 90,
                options: [],
                numericInput: COORD_INPUT,
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
                id: 'lineToolStyle.deltaX',
                labelKey: 'ribbon.commands.quickStyle.deltaX',
                commandKey: LINE_TOOL_RIBBON_KEYS.deltaX,
                comboboxWidthPx: 90,
                options: [],
                numericInput: COORD_INPUT,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineToolStyle.deltaY',
                labelKey: 'ribbon.commands.quickStyle.deltaY',
                commandKey: LINE_TOOL_RIBBON_KEYS.deltaY,
                comboboxWidthPx: 90,
                options: [],
                numericInput: COORD_INPUT,
              },
            },
          ],
        },
      ],
    },
  ],
};
