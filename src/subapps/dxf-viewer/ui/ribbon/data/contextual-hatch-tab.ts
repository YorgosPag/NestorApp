/**
 * ADR-507 — Contextual ribbon tab για τη γραμμοσκίαση (hatch) — **tools-only**.
 *
 * Trigger: `hatch-selected` — εμφανίζεται όταν είναι ενεργό το εργαλείο «Γραμμοσκίαση»
 * ή όταν είναι επιλεγμένο ένα `HatchEntity`.
 *
 * ADR-507 (Revit/AutoCAD split): οι **ιδιότητες** του hatch (Γενικά/Μοτίβο/Διαβάθμιση/
 * Εμβαδόν) ζουν πλέον στο ΑΡΙΣΤΕΡΟ Properties palette (`HatchPropertiesTab`, ίδιο SSoT
 * bridge). Το ribbon κρατά ΜΟΝΟ τα **εργαλεία** δημιουργίας/διαχείρισης:
 *   Μέθοδος   → επιλογή σημείου / σχεδίαση ορίου + ανοχή κενού (creation-time)
 *   Λίστα     → «Γραμμοσκιάσεις ορόφου» (list widget)
 *   Ενέργειες → επιλογή γραμμοσκίασης + κλείσιμο + διαγραφή
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import { HATCH_RIBBON_KEYS } from '../hooks/bridge/hatch-command-keys';

export const HATCH_CONTEXTUAL_TRIGGER = 'hatch-selected';

// ─── Combobox options ─────────────────────────────────────────────────────────

/**
 * Gap tolerance (AutoCAD HPGAPTOL, σε μονάδες σχεδίου — π.χ. mm) — editable numeric.
 * Presets ρεαλιστικά για κατόψεις σε mm· ο χρήστης πληκτρολογεί ελεύθερα 0..5000.
 */
const GAP_TOLERANCE_OPTIONS = [
  { value: '0', labelKey: '0', isLiteralLabel: true },
  { value: '10', labelKey: '10', isLiteralLabel: true },
  { value: '50', labelKey: '50', isLiteralLabel: true },
  { value: '100', labelKey: '100', isLiteralLabel: true },
  { value: '250', labelKey: '250', isLiteralLabel: true },
  { value: '500', labelKey: '500', isLiteralLabel: true },
] as const;

// ─── Tab definition (tools-only) ──────────────────────────────────────────────

export const CONTEXTUAL_HATCH_TAB: RibbonTab = {
  id: 'hatch-editor',
  labelKey: 'ribbon.tabs.hatchProperties',
  isContextual: true,
  contextualTrigger: HATCH_CONTEXTUAL_TRIGGER,
  panels: [
    {
      // ADR-507 Φ3 — Τρόπος ορισμού περιοχής (AutoCAD «Boundaries» / Revit): 2 μεγάλα
      // radio-toggles με εικονίδια. Το ένα πάντα ενεργό (SSoT = hatch-pick-mode-store).
      id: 'hatch-method',
      labelKey: 'ribbon.panels.hatchMethod',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'toggle',
              size: 'large',
              command: {
                id: 'hatch.methodPickPoint',
                labelKey: 'ribbon.commands.hatchEditor.methodPickPoint',
                tooltipKey: 'ribbon.commands.hatchEditor.methodPickPointTip',
                icon: 'hatch-pick-point',
                commandKey: HATCH_RIBBON_KEYS.toggles.methodPickPoint,
              },
            },
            {
              type: 'toggle',
              size: 'large',
              command: {
                id: 'hatch.methodBoundary',
                labelKey: 'ribbon.commands.hatchEditor.methodBoundary',
                tooltipKey: 'ribbon.commands.hatchEditor.methodBoundaryTip',
                icon: 'hatch-draw-boundary',
                commandKey: HATCH_RIBBON_KEYS.toggles.methodBoundary,
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
                id: 'hatch.gapTolerance',
                labelKey: 'ribbon.commands.hatchEditor.gapTolerance',
                commandKey: HATCH_RIBBON_KEYS.params.gapTolerance,
                comboboxWidthPx: 90,
                options: GAP_TOLERANCE_OPTIONS,
                numericInput: { editable: true, min: 0, max: 5000 },
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
              // ADR-507 — dropdown «Γραμμοσκιάσεις ορόφου» (λίστα + επιλογή + zoom).
              type: 'widget',
              size: 'small',
              widgetId: 'hatch-list',
              command: {
                id: 'hatch.list',
                labelKey: 'ribbon.commands.hatchEditor.hatchList',
                commandKey: 'hatch.list',
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
              // ADR-507 — «Επιλογή γραμμοσκίασης» (armed pick-existing· toggle = μένει
              // πατημένο όσο περιμένει κλικ σε γραμμοσκίαση, one-shot disarm μετά).
              type: 'toggle',
              size: 'small',
              command: {
                id: 'hatch.selectExisting',
                labelKey: 'ribbon.commands.hatchEditor.selectExisting',
                icon: 'hatch',
                commandKey: HATCH_RIBBON_KEYS.toggles.selectExisting,
              },
            },
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
