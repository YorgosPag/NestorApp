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

export const LINE_TOOL_CONTEXTUAL_TRIGGER = 'line-tool-active';

// ─── Lineweight options ───────────────────────────────────────────────────────
// ADR-357 §G15: ByLayer + ISO subset (11 most common values per AutoCAD UI).

const LINEWEIGHT_OPTIONS = [
  { value: 'ByLayer',  labelKey: 'ByLayer',   isLiteralLabel: true },
  { value: '0.05',     labelKey: '0.05 mm',   isLiteralLabel: true },
  { value: '0.09',     labelKey: '0.09 mm',   isLiteralLabel: true },
  { value: '0.13',     labelKey: '0.13 mm',   isLiteralLabel: true },
  { value: '0.18',     labelKey: '0.18 mm',   isLiteralLabel: true },
  { value: '0.25',     labelKey: '0.25 mm',   isLiteralLabel: true },
  { value: '0.35',     labelKey: '0.35 mm',   isLiteralLabel: true },
  { value: '0.50',     labelKey: '0.50 mm',   isLiteralLabel: true },
  { value: '0.70',     labelKey: '0.70 mm',   isLiteralLabel: true },
  { value: '1.00',     labelKey: '1.00 mm',   isLiteralLabel: true },
  { value: '1.40',     labelKey: '1.40 mm',   isLiteralLabel: true },
  { value: '2.00',     labelKey: '2.00 mm',   isLiteralLabel: true },
] as const;

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
          ],
        },
      ],
    },
  ],
};
