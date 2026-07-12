/**
 * ADR-510 Φ2E #5 — descriptor SSoT για τα per-object πεδία της επιλεγμένης γραμμής
 * στο ΑΡΙΣΤΕΡΟ Properties palette (mirror του `column-property-fields.ts`).
 *
 * Δηλώνει ΩΣ DATA τα groups (Γενικά / Γεωμετρία / Πολυγραμμή) με τα πεδία τους:
 * `commandKey` (κοινό με το `useRibbonLineToolBridge`) + `labelKey` (τα ΥΠΑΡΧΟΝΤΑ
 * `ribbon.commands.quickStyle.*`, μηδέν νέα) + `control` (select/color/numeric) +
 * numericInput/options. Read/write γίνεται από το ΙΔΙΟ bridge (get/onComboboxChange)
 * — εδώ ΜΟΝΟ η δομή/κατανομή. Τα numeric/option specs (CELTSCALE/Διαφάνεια/Πλάτος/
 * συντεταγμένες) ζουν ΕΔΩ (panel-only μετά το ribbon-slim Φ2E #5), μηδέν διπλότυπο.
 *
 * Καθαρά data types — zero React/DOM.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-510-line-creation-system.md §Φ2E #5
 */

import {
  LINE_TOOL_RIBBON_KEYS,
  LINE_TOOL_PANEL_VISIBILITY_KEYS,
} from '../ribbon/hooks/bridge/line-tool-command-keys';
// ADR-507 Φ2 — κοινό ByLayer + ISO subset lineweight list (ίδιο με το ribbon).
import { LINEWEIGHT_RIBBON_OPTIONS } from '../ribbon/data/lineweight-ribbon-options';
// ADR-583 SSoT builder για numeric-literal option ladders (kill το hand-written clone).
import { literalNumberOptions } from '../ribbon/data/ribbon-numeric-options';
import type { RibbonNumericInputConfig } from '../ribbon/types/ribbon-types';
// ADR-507/510 — line panel descriptor τύποι = τα generic entity-property types (SSoT,
// κοινά με τη γραμμοσκίαση)· η γραμμή απλώς χρησιμοποιεί υποσύνολο των controls.
import type {
  EntityPropertyControl,
  EntityPropertyField,
  EntityPropertyGroup,
} from '../entity-properties/entity-property-fields';

export type LinePropertyControl = EntityPropertyControl;
export type LinePropertyField = EntityPropertyField;
export type LinePropertyGroup = EntityPropertyGroup;

// ── Option / numeric specs (panel-only μετά το Φ2E #5 ribbon-slim) ─────────────

const LINETYPE_SCALE_OPTIONS = literalNumberOptions(['0.25', '0.5', '1', '2', '4']);
const TRANSPARENCY_OPTIONS = literalNumberOptions(['0', '25', '50', '75', '90']);
const WIDTH_OPTIONS = literalNumberOptions(['0', '1', '2', '5', '10']);

/** Editable signed display-unit coordinate/delta (mirror του πρώην ribbon COORD_INPUT). */
const COORD_INPUT: RibbonNumericInputConfig = { editable: true, allowNegative: true, allowDecimal: true };

const L = (k: keyof typeof LINE_TOOL_RIBBON_KEYS, control: LinePropertyControl, extra: Partial<LinePropertyField> = {}): LinePropertyField => ({
  commandKey: LINE_TOOL_RIBBON_KEYS[k],
  labelKey: `ribbon.commands.quickStyle.${k}`,
  control,
  options: [],
  ...extra,
});

// ── Groups (κατανομή: full appearance + geometry → panel) ──────────────────────

export const LINE_PROPERTY_GROUPS: readonly LinePropertyGroup[] = [
  {
    // AutoCAD «General»: πλήρες appearance (το quick-set μένει ΚΑΙ στο ribbon).
    id: 'general',
    titleKey: 'panels.dimensions.linePatternEditor.inlineTab.sections.general',
    fields: [
      L('lineStyle', 'select'),
      L('layer', 'select'),
      L('color', 'color'),
      L('linetype', 'select'),
      L('lineweight', 'select', { options: LINEWEIGHT_RIBBON_OPTIONS }),
      // ADR-510 Φ2E #2 — per-object linetype scale (CELTSCALE > 0).
      L('linetypeScale', 'numeric', { options: LINETYPE_SCALE_OPTIONS, numericInput: { editable: true, min: 0.01 } }),
      // AutoCAD object transparency 0 (opaque) .. 90.
      L('transparency', 'numeric', { options: TRANSPARENCY_OPTIONS, numericInput: { editable: true, min: 0, max: 90, allowDecimal: false } }),
    ],
  },
  {
    // AutoCAD «Geometry» — line-only (self-hides for circle/arc/… via visibilityKey).
    id: 'geometry',
    titleKey: 'panels.dimensions.linePatternEditor.inlineTab.sections.geometry',
    visibilityKey: LINE_TOOL_PANEL_VISIBILITY_KEYS.geometry,
    fields: [
      L('length', 'numeric', { numericInput: { editable: true, allowDecimal: true, min: 0.0001 } }),
      L('angle', 'numeric', { numericInput: { editable: true, allowNegative: true, allowDecimal: true } }),
      L('startX', 'numeric', { numericInput: COORD_INPUT }),
      L('startY', 'numeric', { numericInput: COORD_INPUT }),
      L('endX', 'numeric', { numericInput: COORD_INPUT }),
      L('endY', 'numeric', { numericInput: COORD_INPUT }),
      L('deltaX', 'numeric', { numericInput: COORD_INPUT }),
      L('deltaY', 'numeric', { numericInput: COORD_INPUT }),
    ],
  },
  {
    // AutoCAD polyline «Global Width» — polyline-only (self-hides for a plain LINE).
    id: 'polyline',
    titleKey: 'panels.dimensions.linePatternEditor.inlineTab.sections.polyline',
    visibilityKey: LINE_TOOL_PANEL_VISIBILITY_KEYS.widthApplicable,
    fields: [
      L('width', 'numeric', { options: WIDTH_OPTIONS, numericInput: { editable: true, min: 0 } }),
    ],
  },
];

/**
 * ADR-510 Φ2E #6 — fields with NO draw-default meaning (write is selection-only in
 * the bridge). In draft mode (line tool active, no selection) they are dropped from
 * «Γενικά» so the panel shows only actionable draw-defaults (mirror του hatch
 * `HATCH_SELECTION_ONLY_KEYS`). Transparency draw-default is not wired (ADR-510 Φ4).
 */
export const LINE_SELECTION_ONLY_KEYS: ReadonlySet<string> = new Set<string>([
  LINE_TOOL_RIBBON_KEYS.transparency,
]);
