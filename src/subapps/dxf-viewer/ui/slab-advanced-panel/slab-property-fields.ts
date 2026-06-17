/**
 * ADR-476 — SSoT descriptor των δομοστατικών παραμέτρων πλάκας που ζουν στο docked
 * Properties panel (mirror του `beam-property-fields.ts`).
 *
 * Δηλώνει ΩΣ DATA τα groups (Στατικά/Οπλισμός + Φορτίο Σχεδιασμού) με τα πεδία τους:
 * `commandKey` + `labelKey` + `options`. Τα option lists είναι τα ΥΠΑΡΧΟΝΤΑ κοινά
 * `_OPTIONS` consts — η πλάκα μοιράζεται το **ίδιο μοντέλο σχάρας** με το πέδιλο, οπότε
 * reuse-άρει τα `FOUNDATION_*` options (μηδέν διπλασιασμός — N.0.2). Read/write γίνεται
 * από τους pure resolvers (`slab-structural-bridge`) — εδώ ΜΟΝΟ η δομή.
 *
 * Σε αντίθεση με δοκό/κολόνα (διαμήκεις + συνδετήρες), η πλάκα έχει ΔΥΟ σχάρες
 * (κάτω καμπτική / άνω στηρίξεων) — γι' αυτό bottom/top mesh πεδία (ένα ζεύγος Ø+βήμα
 * ανά στρώση· X/Y ίδια στο default UI).
 */

import {
  SLAB_STRUCTURAL_KEYS,
  SLAB_STRUCTURAL_READOUT_KEYS,
  SLAB_STRUCTURAL_VISIBILITY_KEYS,
} from '../ribbon/hooks/bridge/slab-command-keys';
import {
  STRUCTURAL_CODE_OPTIONS,
  CONCRETE_GRADE_OPTIONS,
} from '../ribbon/hooks/bridge/structural-param';
import {
  FOUNDATION_DIAMETER_OPTIONS,
  FOUNDATION_MESH_SPACING_OPTIONS,
  FOUNDATION_COVER_OPTIONS,
} from '../ribbon/hooks/bridge/foundation-structural-param';
import type { BimPropertyGroup } from '../bim-properties/bim-property-types';

export const SLAB_PROPERTY_GROUPS: readonly BimPropertyGroup[] = [
  {
    // ADR-476 — δομοστατικά/οπλισμός: κανονισμός + σκυρόδεμα + κάτω/άνω σχάρα +
    // επικάλυψη + live readouts (labels σχάρας / βάρος / ρ%). RC πλάκα μόνο.
    id: 'structural',
    titleKey: 'slabAdvancedPanel.sections.structural.title',
    visibilityKey: SLAB_STRUCTURAL_VISIBILITY_KEYS.structural,
    fields: [
      { commandKey: SLAB_STRUCTURAL_KEYS.code, labelKey: 'ribbon.commands.slabStructural.code', tooltipKey: 'ribbon.commands.slabStructural.codeTooltip', options: STRUCTURAL_CODE_OPTIONS },
      { commandKey: SLAB_STRUCTURAL_KEYS.concreteGrade, labelKey: 'ribbon.commands.slabStructural.concreteGrade', options: CONCRETE_GRADE_OPTIONS },
      { commandKey: SLAB_STRUCTURAL_KEYS.bottomMeshDiameter, labelKey: 'ribbon.commands.slabStructural.bottomMeshDiameter', options: FOUNDATION_DIAMETER_OPTIONS },
      { commandKey: SLAB_STRUCTURAL_KEYS.bottomMeshSpacing, labelKey: 'ribbon.commands.slabStructural.bottomMeshSpacing', options: FOUNDATION_MESH_SPACING_OPTIONS },
      { commandKey: SLAB_STRUCTURAL_KEYS.topMeshDiameter, labelKey: 'ribbon.commands.slabStructural.topMeshDiameter', options: FOUNDATION_DIAMETER_OPTIONS },
      { commandKey: SLAB_STRUCTURAL_KEYS.topMeshSpacing, labelKey: 'ribbon.commands.slabStructural.topMeshSpacing', options: FOUNDATION_MESH_SPACING_OPTIONS },
      { commandKey: SLAB_STRUCTURAL_KEYS.cover, labelKey: 'ribbon.commands.slabStructural.cover', options: FOUNDATION_COVER_OPTIONS },
      // Read-only readouts (bridge δίνει value· options:[]).
      { commandKey: SLAB_STRUCTURAL_READOUT_KEYS.bottomLabel, labelKey: 'ribbon.commands.slabStructural.bottomLabel', options: [], readOnly: true },
      { commandKey: SLAB_STRUCTURAL_READOUT_KEYS.topLabel, labelKey: 'ribbon.commands.slabStructural.topLabel', options: [], readOnly: true },
      { commandKey: SLAB_STRUCTURAL_READOUT_KEYS.steelWeight, labelKey: 'ribbon.commands.slabStructural.steelWeight', options: [], readOnly: true },
      { commandKey: SLAB_STRUCTURAL_READOUT_KEYS.ratio, labelKey: 'ribbon.commands.slabStructural.ratio', options: [], readOnly: true },
    ],
  },
  {
    // ADR-467 — διαδρομή φορτίων: επιφανειακό φορτίο σχεδιασμού (g/q/q_Ed) από το
    // `params.appliedLoad` (tributary ÷ εμβαδό). Read-only — mirror του δοκαριού
    // «Φορτίο Σχεδιασμού». «—» όταν δεν έχει υπολογιστεί φορτίο (Revit-grade).
    id: 'loads',
    titleKey: 'slabAdvancedPanel.sections.loads.title',
    fields: [
      { commandKey: SLAB_STRUCTURAL_READOUT_KEYS.loadDeadArea, labelKey: 'ribbon.commands.slabStructural.loadDeadArea', options: [], readOnly: true },
      { commandKey: SLAB_STRUCTURAL_READOUT_KEYS.loadLiveArea, labelKey: 'ribbon.commands.slabStructural.loadLiveArea', options: [], readOnly: true },
      { commandKey: SLAB_STRUCTURAL_READOUT_KEYS.loadUlsArea, labelKey: 'ribbon.commands.slabStructural.loadUlsArea', options: [], readOnly: true },
    ],
  },
];
