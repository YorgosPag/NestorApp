/**
 * ADR-357 Phase 17 — Contextual ribbon tab για γρήγορο στυλ κατά τη σχεδίαση.
 *
 * Trigger: `line-tool-active` — dispatched από `useActiveContextualTrigger`
 * όταν `activeTool` είναι drawing tool (line, circle, rectangle, κλπ.).
 *
 * Panel "Quick Style": 3 comboboxes
 *   Lineweight → ISO subset (ByLayer + 0.05..2.00 mm)
 *   Linetype   → ByLayer + ISO 8 catalog names
 *   Color      → ByLayer + 7 ACI standard colors
 *
 * Bridge: `useRibbonLineToolBridge` (ADR-357 Phase 17).
 * Store SSoT: `stores/QuickStyleStore.ts`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-357-dxf-line-tool-google-level.md §G15
 */

import type { RibbonTab } from '../types/ribbon-types';
import { LINE_TOOL_RIBBON_KEYS } from '../hooks/bridge/line-tool-command-keys';
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

// ─── Tab definition ───────────────────────────────────────────────────────────

export const CONTEXTUAL_LINE_TOOL_TAB: RibbonTab = {
  id: 'line-tool-style',
  labelKey: 'ribbon.tabs.lineToolStyle',
  isContextual: true,
  contextualTrigger: LINE_TOOL_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'line-tool-quick-style',
      labelKey: 'ribbon.panels.lineToolQuickStyle',
      rows: [
        {
          isInFlyout: false,
          buttons: [
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
                id: 'lineToolStyle.linetypeScale',
                labelKey: 'ribbon.commands.quickStyle.linetypeScale',
                commandKey: LINE_TOOL_RIBBON_KEYS.linetypeScale,
                comboboxWidthPx: 80,
                options: LINETYPE_SCALE_OPTIONS,
                // ADR-510 Φ2E #2 — editable numeric (CELTSCALE > 0), Revit-grade.
                numericInput: { editable: true, min: 0.01 },
              },
            },
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
  ],
};
