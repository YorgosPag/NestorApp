/**
 * ADR-363 Phase 4 / Properties-palette split — SSoT descriptor των αναλυτικών
 * παραμέτρων κολώνας που ζουν στο docked Properties panel (όχι στο ribbon).
 *
 * Δηλώνει ΩΣ DATA τα groups (Στατικά/Οπλισμός, Σοβάς, Κέλυφος, Υλικό) με τα
 * πεδία τους: `commandKey` + `labelKey` + `options`. Τα option lists είναι τα
 * ΥΠΑΡΧΟΝΤΑ `_OPTIONS` consts των ribbon bridges (μηδέν διπλασιασμός). Read/write
 * γίνεται από τους κοινούς pure resolvers (`column-bridge-combobox-resolvers`) —
 * εδώ ΜΟΝΟ η δομή/κατανομή. Mirror του ribbon `contextual-column-tab.ts` pattern.
 *
 * Διατηρεί τις προσθήκες ADR-456 (cross-tie selector + concrete-volume readouts)
 * — απλώς ζουν πλέον στο panel αντί στο ribbon.
 */

import {
  COLUMN_STRUCTURAL_KEYS,
  COLUMN_STRUCTURAL_READOUT_KEYS,
  COLUMN_FINISH_KEYS,
  COLUMN_RIBBON_KEYS,
  COLUMN_RIBBON_VISIBILITY_KEYS,
} from '../ribbon/hooks/bridge/column-command-keys';
import {
  STRUCTURAL_CODE_OPTIONS,
  CONCRETE_GRADE_OPTIONS,
  LONGITUDINAL_DIAMETER_OPTIONS,
  LONGITUDINAL_COUNT_OPTIONS,
  STIRRUP_TYPE_OPTIONS,
  CROSS_TIE_PATTERN_OPTIONS,
  STIRRUP_DIAMETER_OPTIONS,
  STIRRUP_SPACING_OPTIONS,
  STIRRUP_CRITICAL_SPACING_OPTIONS,
  COVER_OPTIONS,
} from '../ribbon/hooks/bridge/structural-param';
import {
  FINISH_ENABLED_OPTIONS,
  FINISH_MATERIAL_OPTIONS,
  FINISH_THICKNESS_OPTIONS,
} from '../ribbon/hooks/bridge/finish-param';
// ADR-404 Φ5 — reuse των ribbon tilt option lists (μηδέν διπλό list).
import {
  TILT_ENABLED_OPTIONS,
  TILT_ANGLE_DEG_OPTIONS,
  TILT_DIRECTION_DEG_OPTIONS,
} from '../ribbon/data/contextual-column-tab';
import { ENVELOPE_FUNCTION_OPTIONS } from '../ribbon/hooks/bridge/envelope-function-param';
// ADR-471 (boy-scout, N.0.2) — οι row/field τύποι ενοποιήθηκαν στο member-agnostic
// `bim-property-types` (κοινά κολόνα + δοκάρι). Εδώ μένουν ως aliases (μηδέν διπλότυπο).
import type {
  BimPropertyOption,
  BimPropertyField,
  BimPropertyGroup,
} from '../bim-properties/bim-property-types';

/** Combobox option για row του panel (alias του {@link BimPropertyOption}). */
export type ColumnPropertyOption = BimPropertyOption;

/** Ένα editable πεδίο ή read-only readout μέσα σε group (alias του {@link BimPropertyField}). */
export type ColumnPropertyField = BimPropertyField;

/** Λογικό group (= section) μέσα στο panel (alias του {@link BimPropertyGroup}). */
export type ColumnPropertyGroup = BimPropertyGroup;

// ── Υλικό (μετακινήθηκε από contextual-column-tab.ts — μόνο εδώ πλέον) ──────────

/**
 * ADR-363 Phase 4.5d — material library ID (4 options: rc/steel/masonry/wood).
 * Lookup case-insensitive· unknown → 'rc' fallback (βλ. `resolveMaterialKey`).
 */
export const COLUMN_MATERIAL_OPTIONS: readonly ColumnPropertyOption[] = [
  { value: 'rc',      labelKey: 'ribbon.commands.columnEditor.material.rc',      isLiteralLabel: false },
  { value: 'steel',   labelKey: 'ribbon.commands.columnEditor.material.steel',   isLiteralLabel: false },
  { value: 'masonry', labelKey: 'ribbon.commands.columnEditor.material.masonry', isLiteralLabel: false },
  { value: 'wood',    labelKey: 'ribbon.commands.columnEditor.material.wood',    isLiteralLabel: false },
];

// ── Groups (κατανομή «αναλυτικά → panel») ──────────────────────────────────────

export const COLUMN_PROPERTY_GROUPS: readonly ColumnPropertyGroup[] = [
  {
    // ADR-456 — δομοστατικά/οπλισμός: κανονισμός + σκυρόδεμα + διαμήκης/εγκάρσιος
    // οπλισμός + επικάλυψη + live readouts (βάρη/ρ%/περίσφιγξη). RC kinds μόνο.
    id: 'structural',
    titleKey: 'columnAdvancedPanel.sections.structural.title',
    visibilityKey: COLUMN_RIBBON_VISIBILITY_KEYS.structural,
    fields: [
      { commandKey: COLUMN_STRUCTURAL_KEYS.code, labelKey: 'ribbon.commands.columnStructural.code', tooltipKey: 'ribbon.commands.columnStructural.codeTooltip', options: STRUCTURAL_CODE_OPTIONS },
      { commandKey: COLUMN_STRUCTURAL_KEYS.concreteGrade, labelKey: 'ribbon.commands.columnStructural.concreteGrade', options: CONCRETE_GRADE_OPTIONS },
      { commandKey: COLUMN_STRUCTURAL_KEYS.longitudinalDiameter, labelKey: 'ribbon.commands.columnStructural.longitudinalDiameter', options: LONGITUDINAL_DIAMETER_OPTIONS },
      { commandKey: COLUMN_STRUCTURAL_KEYS.longitudinalCount, labelKey: 'ribbon.commands.columnStructural.longitudinalCount', options: LONGITUDINAL_COUNT_OPTIONS },
      { commandKey: COLUMN_STRUCTURAL_KEYS.stirrupType, labelKey: 'ribbon.commands.columnStructural.stirrupType', options: STIRRUP_TYPE_OPTIONS },
      { commandKey: COLUMN_STRUCTURAL_KEYS.crossTiePattern, labelKey: 'ribbon.commands.columnStructural.crossTiePattern', options: CROSS_TIE_PATTERN_OPTIONS },
      { commandKey: COLUMN_STRUCTURAL_KEYS.stirrupDiameter, labelKey: 'ribbon.commands.columnStructural.stirrupDiameter', options: STIRRUP_DIAMETER_OPTIONS },
      { commandKey: COLUMN_STRUCTURAL_KEYS.stirrupSpacing, labelKey: 'ribbon.commands.columnStructural.stirrupSpacing', options: STIRRUP_SPACING_OPTIONS },
      { commandKey: COLUMN_STRUCTURAL_KEYS.stirrupCriticalSpacing, labelKey: 'ribbon.commands.columnStructural.stirrupCriticalSpacing', options: STIRRUP_CRITICAL_SPACING_OPTIONS },
      { commandKey: COLUMN_STRUCTURAL_KEYS.cover, labelKey: 'ribbon.commands.columnStructural.cover', options: COVER_OPTIONS },
      // Read-only readouts (bridge δίνει value· options:[]).
      { commandKey: COLUMN_STRUCTURAL_READOUT_KEYS.concreteVolumeGross, labelKey: 'ribbon.commands.columnStructural.concreteVolumeGross', options: [], readOnly: true },
      { commandKey: COLUMN_STRUCTURAL_READOUT_KEYS.concreteVolumeNet, labelKey: 'ribbon.commands.columnStructural.concreteVolumeNet', options: [], readOnly: true },
      { commandKey: COLUMN_STRUCTURAL_READOUT_KEYS.concreteWeight, labelKey: 'ribbon.commands.columnStructural.concreteWeight', options: [], readOnly: true },
      { commandKey: COLUMN_STRUCTURAL_READOUT_KEYS.steelWeight, labelKey: 'ribbon.commands.columnStructural.steelWeight', options: [], readOnly: true },
      { commandKey: COLUMN_STRUCTURAL_READOUT_KEYS.ratio, labelKey: 'ribbon.commands.columnStructural.ratio', options: [], readOnly: true },
      { commandKey: COLUMN_STRUCTURAL_READOUT_KEYS.confinement, labelKey: 'ribbon.commands.columnStructural.confinement', options: [], readOnly: true },
    ],
  },
  {
    // ADR-467 — διαδρομή φορτίων: αξονικό φορτίο σχεδιασμού (G/Q/N_Ed) από το
    // `params.appliedLoad` (tributary takedown). Read-only — mirror του foundation
    // «Φορτία & Έδραση». «—» όταν δεν έχει υπολογιστεί φορτίο (Revit-grade).
    id: 'loads',
    titleKey: 'columnAdvancedPanel.sections.loads.title',
    fields: [
      { commandKey: COLUMN_STRUCTURAL_READOUT_KEYS.loadDeadAxial, labelKey: 'ribbon.commands.columnStructural.loadDeadAxial', options: [], readOnly: true },
      { commandKey: COLUMN_STRUCTURAL_READOUT_KEYS.loadLiveAxial, labelKey: 'ribbon.commands.columnStructural.loadLiveAxial', options: [], readOnly: true },
      { commandKey: COLUMN_STRUCTURAL_READOUT_KEYS.loadUlsAxial, labelKey: 'ribbon.commands.columnStructural.loadUlsAxial', options: [], readOnly: true },
    ],
  },
  {
    // ADR-404 Φ5 — κεκλιμένη κολώνα (Revit «Slanted Column»): on/off + γωνία + φορά.
    // Εφαρμόζεται σε ΟΛΟΥΣ τους τύπους διατομής. Γράφει `params.tilt` μέσω
    // UpdateColumnParamsCommand (ίδιο SSoT με το 3D gizmo, ADR-404 Φ2).
    id: 'tilt',
    titleKey: 'columnAdvancedPanel.sections.tilt.title',
    fields: [
      { commandKey: COLUMN_RIBBON_KEYS.stringParams.tiltEnabled, labelKey: 'ribbon.commands.columnEditor.tilt.enabled', options: TILT_ENABLED_OPTIONS },
      { commandKey: COLUMN_RIBBON_KEYS.params.tiltAngle, labelKey: 'ribbon.commands.columnEditor.tilt.angle', options: TILT_ANGLE_DEG_OPTIONS },
      { commandKey: COLUMN_RIBBON_KEYS.params.tiltDirection, labelKey: 'ribbon.commands.columnEditor.tilt.direction', options: TILT_DIRECTION_DEG_OPTIONS },
    ],
  },
  {
    // ADR-449 — σοβάς (structural finish skin) per-element override.
    id: 'finish',
    titleKey: 'columnAdvancedPanel.sections.finish.title',
    fields: [
      { commandKey: COLUMN_FINISH_KEYS.enabled, labelKey: 'ribbon.commands.finishEditor.enabled.section.title', options: FINISH_ENABLED_OPTIONS },
      { commandKey: COLUMN_FINISH_KEYS.interiorMaterialId, labelKey: 'ribbon.commands.finishEditor.interiorMaterial', options: FINISH_MATERIAL_OPTIONS },
      { commandKey: COLUMN_FINISH_KEYS.exteriorMaterialId, labelKey: 'ribbon.commands.finishEditor.exteriorMaterial', options: FINISH_MATERIAL_OPTIONS },
      { commandKey: COLUMN_FINISH_KEYS.thickness, labelKey: 'ribbon.commands.finishEditor.thickness', options: FINISH_THICKNESS_OPTIONS },
    ],
  },
  {
    // ADR-396 v2 Φ6a — ETICS envelope-function override (auto/exterior/interior).
    id: 'envelope',
    titleKey: 'columnAdvancedPanel.sections.envelope.title',
    fields: [
      { commandKey: COLUMN_RIBBON_KEYS.stringParams.envelopeFunction, labelKey: 'ribbon.commands.envelopeFunction.section.title', tooltipKey: 'ribbon.commands.envelopeFunction.tooltip', options: ENVELOPE_FUNCTION_OPTIONS },
    ],
  },
  {
    // ADR-363 Phase 4.5d — material picker (rc/steel/masonry/wood).
    id: 'material',
    titleKey: 'columnAdvancedPanel.sections.material.title',
    fields: [
      { commandKey: COLUMN_RIBBON_KEYS.stringParams.material, labelKey: 'ribbon.commands.columnEditor.material.section.title', options: COLUMN_MATERIAL_OPTIONS },
    ],
  },
];
