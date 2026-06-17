/**
 * ADR-463 — SSoT descriptor των αναλυτικών παραμέτρων οπλισμού θεμελίωσης που
 * ζουν στο docked Properties panel (όχι στο ribbon· mirror του ADR-363 split για
 * την κολώνα). Επειδή το `FoundationParams` είναι **discriminated union**, ο
 * descriptor είναι **kind-aware**: `resolveFoundationPropertyGroups(kind)` δίνει
 * μόνο τα πεδία που ισχύουν για το τρέχον kind (pad σχάρα / strip εγκάρσιες+
 * διαμήκεις+συνδετήρες / tie-beam beam-like).
 *
 * Read/write γίνεται από τους κοινούς resolvers (`foundation-bridge-combobox-
 * resolvers`)· εδώ ΜΟΝΟ η δομή/κατανομή. ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΕΙ τους τύπους
 * `ColumnProperty*` + το γενικό `ColumnPropertyRow` (generic property-row, μηδέν
 * νέο component — N.0.2).
 *
 * @see ./FoundationAdvancedPanel.tsx
 */

import type { FoundationKind } from '../../bim/types/foundation-types';
import type {
  ColumnPropertyField,
  ColumnPropertyGroup,
  ColumnPropertyOption,
} from '../column-advanced-panel/column-property-fields';
import { STRUCTURAL_CODE_OPTIONS } from '../ribbon/hooks/bridge/structural-param';
import {
  FOUNDATION_DIAMETER_OPTIONS,
  FOUNDATION_MESH_SPACING_OPTIONS,
  FOUNDATION_BAR_COUNT_OPTIONS,
  FOUNDATION_STIRRUP_SPACING_OPTIONS,
  FOUNDATION_STIRRUP_CRITICAL_SPACING_OPTIONS,
  FOUNDATION_COVER_OPTIONS,
  FOUNDATION_TOGGLE_OPTIONS,
  FOUNDATION_SOIL_BEARING_OPTIONS,
  FOUNDATION_AREA_LOAD_OPTIONS,
  FOUNDATION_AXIAL_LOAD_OPTIONS,
  FOUNDATION_MOMENT_OPTIONS,
} from '../ribbon/hooks/bridge/foundation-structural-param';
import {
  FOUNDATION_STRUCTURAL_KEYS as K,
  FOUNDATION_STRUCTURAL_READOUT_KEYS as RK,
} from '../ribbon/hooks/bridge/foundation-command-keys';

const L = 'ribbon.commands.foundationStructural';

function field(
  commandKey: string,
  labelLeaf: string,
  options: readonly ColumnPropertyOption[],
): ColumnPropertyField {
  return { commandKey, labelKey: `${L}.${labelLeaf}`, options };
}

function readout(commandKey: string, labelLeaf: string): ColumnPropertyField {
  return { commandKey, labelKey: `${L}.${labelLeaf}`, options: [], readOnly: true };
}

const CODE_FIELD = field(K.code, 'code', STRUCTURAL_CODE_OPTIONS);
const COVER_FIELD = field(K.cover, 'cover', FOUNDATION_COVER_OPTIONS);

const PAD_FIELDS: readonly ColumnPropertyField[] = [
  field(K.padBottomXDiameter, 'padBottomXDiameter', FOUNDATION_DIAMETER_OPTIONS),
  field(K.padBottomXSpacing, 'padBottomXSpacing', FOUNDATION_MESH_SPACING_OPTIONS),
  field(K.padBottomYDiameter, 'padBottomYDiameter', FOUNDATION_DIAMETER_OPTIONS),
  field(K.padBottomYSpacing, 'padBottomYSpacing', FOUNDATION_MESH_SPACING_OPTIONS),
  field(K.padTopEnabled, 'padTopEnabled', FOUNDATION_TOGGLE_OPTIONS),
  field(K.padTopDiameter, 'padTopDiameter', FOUNDATION_DIAMETER_OPTIONS),
  field(K.padTopSpacing, 'padTopSpacing', FOUNDATION_MESH_SPACING_OPTIONS),
];

const STRIP_FIELDS: readonly ColumnPropertyField[] = [
  field(K.stripTransverseDiameter, 'stripTransverseDiameter', FOUNDATION_DIAMETER_OPTIONS),
  field(K.stripTransverseSpacing, 'stripTransverseSpacing', FOUNDATION_MESH_SPACING_OPTIONS),
  field(K.stripLongitudinalDiameter, 'stripLongitudinalDiameter', FOUNDATION_DIAMETER_OPTIONS),
  field(K.stripLongitudinalCount, 'stripLongitudinalCount', FOUNDATION_BAR_COUNT_OPTIONS),
  field(K.stripStirrupEnabled, 'stripStirrupEnabled', FOUNDATION_TOGGLE_OPTIONS),
  field(K.stripStirrupDiameter, 'stripStirrupDiameter', FOUNDATION_DIAMETER_OPTIONS),
  field(K.stripStirrupSpacing, 'stripStirrupSpacing', FOUNDATION_STIRRUP_SPACING_OPTIONS),
];

const TIE_BEAM_FIELDS: readonly ColumnPropertyField[] = [
  field(K.tieBottomDiameter, 'tieBottomDiameter', FOUNDATION_DIAMETER_OPTIONS),
  field(K.tieBottomCount, 'tieBottomCount', FOUNDATION_BAR_COUNT_OPTIONS),
  field(K.tieTopDiameter, 'tieTopDiameter', FOUNDATION_DIAMETER_OPTIONS),
  field(K.tieTopCount, 'tieTopCount', FOUNDATION_BAR_COUNT_OPTIONS),
  field(K.tieStirrupDiameter, 'tieStirrupDiameter', FOUNDATION_DIAMETER_OPTIONS),
  field(K.tieStirrupSpacing, 'tieStirrupSpacing', FOUNDATION_STIRRUP_SPACING_OPTIONS),
  field(K.tieStirrupCriticalSpacing, 'tieStirrupCriticalSpacing', FOUNDATION_STIRRUP_CRITICAL_SPACING_OPTIONS),
];

const READOUTS_GROUP: ColumnPropertyGroup = {
  id: 'readouts',
  titleKey: 'foundationAdvancedPanel.sections.readouts.title',
  fields: [
    readout(RK.mainLabel, 'mainLabel'),
    readout(RK.steelWeight, 'steelWeight'),
    readout(RK.ratio, 'ratio'),
  ],
};

/**
 * ADR-464 — Φορτία & έδραση (pad μόνο): σ_allow (building) + service φορτίο
 * (αξονικό/ροπές) + readouts έδρασης (p_max / αξιοποίηση). Το warning ανεπάρκειας
 * surface-άρει αυτόματα μέσω του `EntityWarningsSection` (organism diagnostics).
 */
const PAD_LOADS_GROUP: ColumnPropertyGroup = {
  id: 'loads',
  titleKey: 'foundationAdvancedPanel.sections.loads.title',
  fields: [
    field(K.soilBearing, 'soilBearing', FOUNDATION_SOIL_BEARING_OPTIONS),
    // ADR-464 Slice 4 — building-level area loads (G/Q) → tributary takedown.
    field(K.areaDeadLoad, 'areaDeadLoad', FOUNDATION_AREA_LOAD_OPTIONS),
    field(K.areaLiveLoad, 'areaLiveLoad', FOUNDATION_AREA_LOAD_OPTIONS),
    field(K.padAxialLoad, 'padAxialLoad', FOUNDATION_AXIAL_LOAD_OPTIONS),
    field(K.padMomentX, 'padMomentX', FOUNDATION_MOMENT_OPTIONS),
    field(K.padMomentY, 'padMomentY', FOUNDATION_MOMENT_OPTIONS),
    readout(RK.bearingPMax, 'bearingPMax'),
    readout(RK.bearingUtilization, 'bearingUtilization'),
  ],
};

/**
 * ADR-477 Slice 3 — «Σεισμός» (tie-beam μόνο): readout της σεισμικής αξονικής δύναμης
 * σύνδεσης N_tie (EN1998-5 §5.4.1.2), υπολογισμένης αυτόματα από τα φορτία των
 * συνδεόμενων υποστυλωμάτων + τις building-level σεισμικές παραδοχές (a_gR/ground type).
 */
const TIE_BEAM_SEISMIC_GROUP: ColumnPropertyGroup = {
  id: 'seismic',
  titleKey: 'foundationAdvancedPanel.sections.seismic.title',
  fields: [readout(RK.tieSeismicForce, 'tieSeismicForce')],
};

function kindFields(kind: FoundationKind): readonly ColumnPropertyField[] {
  switch (kind) {
    case 'pad': return PAD_FIELDS;
    case 'strip': return STRIP_FIELDS;
    case 'tie-beam': return TIE_BEAM_FIELDS;
  }
}

/** Τα Properties groups ανά foundation kind (structural editable + readouts). */
export function resolveFoundationPropertyGroups(kind: FoundationKind): readonly ColumnPropertyGroup[] {
  const structural: ColumnPropertyGroup = {
    id: 'structural',
    titleKey: 'foundationAdvancedPanel.sections.structural.title',
    fields: [CODE_FIELD, ...kindFields(kind), COVER_FIELD],
  };
  // ADR-464 — «Φορτία & Έδραση» μόνο για μεμονωμένο πέδιλο· ADR-477 — «Σεισμός» μόνο tie-beam.
  if (kind === 'pad') return [structural, PAD_LOADS_GROUP, READOUTS_GROUP];
  if (kind === 'tie-beam') return [structural, TIE_BEAM_SEISMIC_GROUP, READOUTS_GROUP];
  return [structural, READOUTS_GROUP];
}
