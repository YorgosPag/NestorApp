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

// ADR-444 — Coordination / Clash detection (Revit/Navisworks "Interference Check").
// A cross-discipline ANALYSIS tool, so it lives here in «Ανάλυση», not in any MEP
// discipline tab. Read-only `action` buttons (detect / clear), reused verbatim from
// the legacy `draw.mep.group` clash submenu.
export const CLASH_COORDINATION_PANEL: RibbonPanelDef = {
  id: 'coordination',
  labelKey: 'ribbon.panels.coordination',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'analyze.clashDetect',
            labelKey: 'ribbon.commands.bim.clashDetectionDetect.label',
            icon: 'bim-pipe',
            commandKey: 'clashDetection.actions.detect',
            action: 'clashDetection.actions.detect',
          },
        },
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'analyze.clashClear',
            labelKey: 'ribbon.commands.bim.clashDetectionClear.label',
            icon: 'bim-pipe',
            commandKey: 'clashDetection.actions.clear',
            action: 'clashDetection.actions.clear',
          },
        },
      ],
    },
  ],
};

// ADR-453 — Print/Export («Εκτύπωση»): 2D/3D drawing → PDF / printer / plotter.
// Reporting/output tool → lives in «Ανάλυση» (mirror του Schedule panel:
// action → wrappedHandleAction → EventBus → PrintHost).
export const PRINT_PANEL: RibbonPanelDef = {
  id: 'print',
  labelKey: 'ribbon.panels.print',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'analyze.print',
            labelKey: 'ribbon.commands.print',
            icon: 'printer',
            commandKey: 'open-print-dialog',
            action: 'open-print-dialog',
            tooltipKey: 'ribbon.tooltips.print',
          },
        },
      ],
    },
  ],
};

// ADR-459 Φ4d — Structural «Αυτόματος Οπλισμός»: auto-apply code-suggested
// reinforcement στα επιλεγμένα μέλη (ή όλον τον οργανισμό ορόφου). Analysis tool →
// «Ανάλυση» (mirror Schedule: action → wrappedHandleAction → EventBus → command hook).
export const STRUCTURAL_REINFORCE_PANEL: RibbonPanelDef = {
  id: 'structural',
  labelKey: 'ribbon.panels.structural',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        // ADR-500 (ADR-487 §7) — «Αυτόματη Μελέτη»: ντετερμινιστικός βρόχος σύγκλισης
        // που μελετά όλον τον όροφο μόνος του (φορτία→size→reinforce→footing→diagnostics)
        // μέχρι μηδέν κόκκινο ή MAX_STUDY_ROUNDS, με ΕΝΑ atomic undo + report toast.
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'analyze.auto-study',
            labelKey: 'ribbon.commands.autoStudyOrganism',
            icon: 'struct-run-analysis',
            commandKey: 'organism.auto-study',
            action: 'organism.auto-study',
            tooltipKey: 'ribbon.tooltips.autoStudyOrganism',
          },
        },
        // ADR-482 — «Ανάλυση»: explicit trigger του στατικού FEM solver (ADR-481).
        // emit `bim:run-structural-analysis` → dormant hook ξυπνά → K·u=F → M/V/N.
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'analyze.run-analysis',
            labelKey: 'ribbon.commands.runStructuralAnalysis',
            icon: 'struct-run-analysis',
            commandKey: 'organism.run-analysis',
            action: 'organism.run-analysis',
            tooltipKey: 'ribbon.tooltips.runStructuralAnalysis',
          },
        },
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'analyze.auto-reinforce',
            labelKey: 'ribbon.commands.autoReinforceOrganism',
            icon: 'struct-auto-reinforce',
            commandKey: 'organism.auto-reinforce',
            action: 'organism.auto-reinforce',
            tooltipKey: 'ribbon.tooltips.autoReinforceOrganism',
          },
        },
        // ADR-464 Slice 4 — «Υπολογισμός Φορτίων»: tributary load takedown σε όλα τα
        // πέδιλα του ορόφου (αυτόματα service φορτία από area loads × ορόφους × ευθύνη).
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'analyze.compute-loads',
            labelKey: 'ribbon.commands.computeTakedownLoads',
            icon: 'struct-auto-reinforce',
            commandKey: 'organism.compute-loads',
            action: 'organism.compute-loads',
            tooltipKey: 'ribbon.tooltips.computeTakedownLoads',
          },
        },
        // ADR-459 Φ4f — manual κολόνα↔πέδιλο connectivity (selection-driven· εδώ
        // ώστε να δουλεύει με multi-selection — οι contextual καρτέλες κρύβονται).
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'analyze.footing-attach',
            labelKey: 'ribbon.commands.footingConnect.attach',
            tooltipKey: 'ribbon.commands.footingConnect.attachTooltip',
            icon: 'bim-wall-attach-base',
            commandKey: 'organism.footing-attach',
            action: 'organism.footing-attach',
          },
        },
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'analyze.footing-detach',
            labelKey: 'ribbon.commands.footingConnect.detach',
            tooltipKey: 'ribbon.commands.footingConnect.detachTooltip',
            icon: 'bim-wall-detach',
            commandKey: 'organism.footing-detach',
            action: 'organism.footing-detach',
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
  panels: [
    ANALYZE_SCHEDULE_PANEL,
    STRUCTURAL_REINFORCE_PANEL,
    THERMAL_ENVELOPE_PANEL,
    CLASH_COORDINATION_PANEL,
    PRINT_PANEL,
  ],
} as const;
