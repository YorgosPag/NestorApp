/**
 * ADR-471 — SSoT descriptor των δομοστατικών παραμέτρων δοκού που ζουν στο docked
 * Properties panel (mirror του `column-property-fields.ts`).
 *
 * Δηλώνει ΩΣ DATA τα groups (Στατικά/Οπλισμός + Φορτίο Σχεδιασμού) με τα πεδία τους:
 * `commandKey` + `labelKey` + `options`. Τα option lists είναι τα ΥΠΑΡΧΟΝΤΑ κοινά
 * `_OPTIONS` consts (μηδέν διπλασιασμός — βλ. `beam-structural-param.ts`). Read/write
 * γίνεται από τους pure resolvers (`beam-structural-bridge`) — εδώ ΜΟΝΟ η δομή.
 *
 * Σε αντίθεση με την κολόνα (ενιαίος περιμετρικός), το δοκάρι έχει ΔΥΟ στρώσεις
 * διαμήκων (κάτω εφελκυσμού / άνω στηρίξεων) — γι' αυτό bottom/top πεδία.
 */

import {
  BEAM_STRUCTURAL_KEYS,
  BEAM_STRUCTURAL_READOUT_KEYS,
  BEAM_STRUCTURAL_VISIBILITY_KEYS,
} from '../ribbon/hooks/bridge/beam-command-keys';
import {
  STRUCTURAL_CODE_OPTIONS,
  CONCRETE_GRADE_OPTIONS,
  LONGITUDINAL_DIAMETER_OPTIONS,
  STIRRUP_TYPE_OPTIONS,
  STIRRUP_DIAMETER_OPTIONS,
  STIRRUP_SPACING_OPTIONS,
  STIRRUP_CRITICAL_SPACING_OPTIONS,
  COVER_OPTIONS,
  BEAM_LAYER_COUNT_OPTIONS,
  BEAM_STIRRUP_LEGS_OPTIONS,
} from '../ribbon/hooks/bridge/beam-structural-param';
import type { BimPropertyGroup } from '../bim-properties/bim-property-types';

export const BEAM_PROPERTY_GROUPS: readonly BimPropertyGroup[] = [
  {
    // ADR-471 — δομοστατικά/οπλισμός: κανονισμός + σκυρόδεμα + κάτω/άνω διαμήκης +
    // συνδετήρες + επικάλυψη + live readouts (όγκοι/βάρη/ρ%). RC δοκός μόνο.
    id: 'structural',
    titleKey: 'beamAdvancedPanel.sections.structural.title',
    visibilityKey: BEAM_STRUCTURAL_VISIBILITY_KEYS.structural,
    fields: [
      { commandKey: BEAM_STRUCTURAL_KEYS.code, labelKey: 'ribbon.commands.beamStructural.code', tooltipKey: 'ribbon.commands.beamStructural.codeTooltip', options: STRUCTURAL_CODE_OPTIONS },
      { commandKey: BEAM_STRUCTURAL_KEYS.concreteGrade, labelKey: 'ribbon.commands.beamStructural.concreteGrade', options: CONCRETE_GRADE_OPTIONS },
      { commandKey: BEAM_STRUCTURAL_KEYS.bottomDiameter, labelKey: 'ribbon.commands.beamStructural.bottomDiameter', options: LONGITUDINAL_DIAMETER_OPTIONS },
      { commandKey: BEAM_STRUCTURAL_KEYS.bottomCount, labelKey: 'ribbon.commands.beamStructural.bottomCount', options: BEAM_LAYER_COUNT_OPTIONS },
      { commandKey: BEAM_STRUCTURAL_KEYS.topDiameter, labelKey: 'ribbon.commands.beamStructural.topDiameter', options: LONGITUDINAL_DIAMETER_OPTIONS },
      { commandKey: BEAM_STRUCTURAL_KEYS.topCount, labelKey: 'ribbon.commands.beamStructural.topCount', options: BEAM_LAYER_COUNT_OPTIONS },
      { commandKey: BEAM_STRUCTURAL_KEYS.stirrupType, labelKey: 'ribbon.commands.beamStructural.stirrupType', options: STIRRUP_TYPE_OPTIONS },
      { commandKey: BEAM_STRUCTURAL_KEYS.stirrupDiameter, labelKey: 'ribbon.commands.beamStructural.stirrupDiameter', options: STIRRUP_DIAMETER_OPTIONS },
      { commandKey: BEAM_STRUCTURAL_KEYS.stirrupSpacing, labelKey: 'ribbon.commands.beamStructural.stirrupSpacing', options: STIRRUP_SPACING_OPTIONS },
      { commandKey: BEAM_STRUCTURAL_KEYS.stirrupCriticalSpacing, labelKey: 'ribbon.commands.beamStructural.stirrupCriticalSpacing', options: STIRRUP_CRITICAL_SPACING_OPTIONS },
      { commandKey: BEAM_STRUCTURAL_KEYS.stirrupLegs, labelKey: 'ribbon.commands.beamStructural.stirrupLegs', options: BEAM_STIRRUP_LEGS_OPTIONS },
      { commandKey: BEAM_STRUCTURAL_KEYS.cover, labelKey: 'ribbon.commands.beamStructural.cover', options: COVER_OPTIONS },
      // Read-only readouts (bridge δίνει value· options:[]).
      { commandKey: BEAM_STRUCTURAL_READOUT_KEYS.concreteVolumeGross, labelKey: 'ribbon.commands.beamStructural.concreteVolumeGross', options: [], readOnly: true },
      { commandKey: BEAM_STRUCTURAL_READOUT_KEYS.concreteVolumeNet, labelKey: 'ribbon.commands.beamStructural.concreteVolumeNet', options: [], readOnly: true },
      { commandKey: BEAM_STRUCTURAL_READOUT_KEYS.concreteWeight, labelKey: 'ribbon.commands.beamStructural.concreteWeight', options: [], readOnly: true },
      { commandKey: BEAM_STRUCTURAL_READOUT_KEYS.steelWeight, labelKey: 'ribbon.commands.beamStructural.steelWeight', options: [], readOnly: true },
      { commandKey: BEAM_STRUCTURAL_READOUT_KEYS.ratio, labelKey: 'ribbon.commands.beamStructural.ratio', options: [], readOnly: true },
    ],
  },
  {
    // ADR-467 — διαδρομή φορτίων: γραμμικό φορτίο σχεδιασμού (g/q/w_Ed) από το
    // `params.appliedLoad` (tributary takedown ÷ άνοιγμα). Read-only — mirror του
    // column «Φορτίο Σχεδιασμού». «—» όταν δεν έχει υπολογιστεί φορτίο (Revit-grade).
    id: 'loads',
    titleKey: 'beamAdvancedPanel.sections.loads.title',
    fields: [
      { commandKey: BEAM_STRUCTURAL_READOUT_KEYS.loadDeadLine, labelKey: 'ribbon.commands.beamStructural.loadDeadLine', options: [], readOnly: true },
      { commandKey: BEAM_STRUCTURAL_READOUT_KEYS.loadLiveLine, labelKey: 'ribbon.commands.beamStructural.loadLiveLine', options: [], readOnly: true },
      { commandKey: BEAM_STRUCTURAL_READOUT_KEYS.loadUlsLine, labelKey: 'ribbon.commands.beamStructural.loadUlsLine', options: [], readOnly: true },
    ],
  },
];
