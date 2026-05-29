/**
 * ADR-363 §6 Phase 8 — Analyze tab definition.
 *
 * Dedicated «Ανάλυση» tab μιμείται το Revit/ArchiCAD pattern όπου
 * analysis/reporting tools αποχωρίζονται από drafting (Home/Insert).
 *
 * Panels:
 *   - Schedule (BIM Schedule export dialog)
 *
 * Future panels (Phase 9+):
 *   - BOQ relocation from Home (σε αυτό το tab σχεδιάστηκε να μετακομίσει)
 *
 * ADR-345 §3 ribbon data conventions:
 *   - Each button dispatches `action` string → `wrappedHandleAction` in
 *     `useDxfViewerCallbacks` (caller intercepts 'open-schedule-dialog').
 *   - `icon: 'bim-schedule'` → `RibbonButtonIcon` case (added M6.4).
 *   - i18n keys σε `ribbon.tabs.analyze`, `ribbon.panels.*`, `ribbon.commands.*`
 *     — M7 fills locale JSONs.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
 * @see docs/centralized-systems/reference/adrs/ADR-345-ribbon.md
 */

import type { RibbonPanelDef, RibbonTab } from '../types/ribbon-types';

// ─── Panels ──────────────────────────────────────────────────────────────────

export const ANALYZE_SCHEDULE_PANEL: RibbonPanelDef = {
  id: 'bim-schedule',
  labelKey: 'ribbon.panels.bimSchedule',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'analyze.bim-schedule',
            labelKey: 'ribbon.commands.bimSchedule',
            icon: 'bim-schedule',
            commandKey: 'open-schedule-dialog',
            action: 'open-schedule-dialog',
            tooltipKey: 'ribbon.tooltips.bimSchedule',
          },
        },
      ],
    },
  ],
};

// ADR-396 Phase P6 — Thermal Envelope (ETICS) authoring command. Building-wide
// BIM tool, mirror του Schedule panel (action → wrappedHandleAction → EventBus).
export const THERMAL_ENVELOPE_PANEL: RibbonPanelDef = {
  id: 'bim-thermal-envelope',
  labelKey: 'ribbon.panels.thermalEnvelope',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'analyze.thermal-envelope',
            labelKey: 'ribbon.commands.thermalEnvelope.label',
            icon: 'bim-thermal-envelope',
            commandKey: 'thermal-envelope.open',
            action: 'thermal-envelope.open',
            tooltipKey: 'ribbon.tooltips.thermalEnvelope',
          },
        },
      ],
    },
  ],
};

// ─── Tab ─────────────────────────────────────────────────────────────────────

export const ANALYZE_TAB: RibbonTab = {
  id: 'analyze',
  labelKey: 'ribbon.tabs.analyze',
  panels: [ANALYZE_SCHEDULE_PANEL, THERMAL_ENVELOPE_PANEL],
} as const;
