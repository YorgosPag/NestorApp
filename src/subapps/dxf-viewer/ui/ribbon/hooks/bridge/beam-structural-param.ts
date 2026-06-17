/**
 * ADR-471 — Beam structural/reinforcement panel helper SSoT.
 *
 * Mirror του `structural-param.ts` (κολόνα) για **δοκάρια**: combobox options
 * (επαναχρησιμοποιεί τα κοινά Ø/βήματα/επικάλυψη/κανονισμός/σκυρόδεμα από το column
 * SSoT — μηδέν διπλό κατάλογο) + pure read/patch helpers πάνω στο `BeamReinforcement`
 * (δύο στρώσεις κάτω/άνω + συνδετήρες) + readout formatting. ΟΛΑ τα μαθηματικά/μεγέθη
 * προέρχονται από το `bim/structural/` — ΜΗΔΕΝ inline στατική λογική στο panel.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-471-unified-member-reinforcement.md §3
 */

import { concreteWeightKg } from '../../../../bim/structural/concrete-grades';
import { REBAR_STEEL_DENSITY_KGM3 } from '../../../../bim/structural/rebar-catalog';
import { computeBeamReinforcementQuantities } from '../../../../bim/structural/reinforcement/beam-reinforcement-compute';
import type { BeamReinforcement } from '../../../../bim/structural/reinforcement/beam-reinforcement-types';
import type { BeamSectionContext } from '../../../../bim/structural/codes';
import {
  BEAM_STRUCTURAL_READOUT_KEYS,
  type BeamStructuralReinforcementField,
} from './beam-command-keys';
// Κοινά option lists με την κολόνα (ΕΝΑ SSoT — προστίθεται κατάλογος εκεί, εμφανίζεται εδώ).
import {
  STRUCTURAL_CODE_OPTIONS,
  CONCRETE_GRADE_OPTIONS,
  LONGITUDINAL_DIAMETER_OPTIONS,
  STIRRUP_TYPE_OPTIONS,
  STIRRUP_DIAMETER_OPTIONS,
  STIRRUP_SPACING_OPTIONS,
  STIRRUP_CRITICAL_SPACING_OPTIONS,
  COVER_OPTIONS,
} from './structural-param';

interface ComboboxOption {
  readonly value: string;
  readonly labelKey: string;
  readonly isLiteralLabel: boolean;
}

/** Helper — αριθμητικός κατάλογος → literal-label options. */
function numericOptions(values: readonly number[]): readonly ComboboxOption[] {
  return values.map((v) => ({ value: String(v), labelKey: String(v), isLiteralLabel: true }));
}

// ─── Re-export κοινών option lists (κολόνα↔δοκάρι) + beam-specific ─────────────

export {
  STRUCTURAL_CODE_OPTIONS,
  CONCRETE_GRADE_OPTIONS,
  LONGITUDINAL_DIAMETER_OPTIONS,
  STIRRUP_TYPE_OPTIONS,
  STIRRUP_DIAMETER_OPTIONS,
  STIRRUP_SPACING_OPTIONS,
  STIRRUP_CRITICAL_SPACING_OPTIONS,
  COVER_OPTIONS,
};

/** Πλήθος ράβδων ανά στρώση διαμήκων (τυπικό εύρος δοκού ανά παρειά). */
export const BEAM_LAYER_COUNT_OPTIONS = numericOptions([2, 3, 4, 5, 6, 8]);

/** Πλήθος σκελών συνδετήρα (δίτμητος/τρίτμητος/τετράτμητος). */
export const BEAM_STIRRUP_LEGS_OPTIONS = numericOptions([2, 3, 4]);

// ─── Pure read/patch πάνω στο BeamReinforcement ───────────────────────────────

/** Τρέχουσα τιμή ενός αριθμητικού πεδίου οπλισμού δοκού (για το combobox value). */
export function readBeamReinforcementField(
  r: BeamReinforcement,
  field: BeamStructuralReinforcementField,
): number {
  switch (field) {
    case 'bottomDiameter': return r.bottom.diameterMm;
    case 'bottomCount': return r.bottom.count;
    case 'topDiameter': return r.top.diameterMm;
    case 'topCount': return r.top.count;
    case 'stirrupDiameter': return r.stirrups.diameterMm;
    case 'stirrupSpacing': return r.stirrups.spacingMm;
    case 'stirrupCriticalSpacing': return r.stirrups.spacingCriticalMm ?? r.stirrups.spacingMm;
    case 'stirrupLegs': return r.stirrups.legs ?? 2;
    case 'cover': return r.coverMm;
  }
}

/** Νέο `BeamReinforcement` με ενημερωμένο ένα αριθμητικό πεδίο (immutable). */
export function patchBeamReinforcementField(
  r: BeamReinforcement,
  field: BeamStructuralReinforcementField,
  value: number,
): BeamReinforcement {
  switch (field) {
    case 'bottomDiameter':
      return { ...r, bottom: { ...r.bottom, diameterMm: value } };
    case 'bottomCount':
      return { ...r, bottom: { ...r.bottom, count: value } };
    case 'topDiameter':
      return { ...r, top: { ...r.top, diameterMm: value } };
    case 'topCount':
      return { ...r, top: { ...r.top, count: value } };
    case 'stirrupDiameter':
      return { ...r, stirrups: { ...r.stirrups, diameterMm: value } };
    case 'stirrupSpacing':
      return { ...r, stirrups: { ...r.stirrups, spacingMm: value } };
    case 'stirrupCriticalSpacing':
      return { ...r, stirrups: { ...r.stirrups, spacingCriticalMm: value } };
    case 'stirrupLegs':
      return { ...r, stirrups: { ...r.stirrups, legs: value } };
    case 'cover':
      return { ...r, coverMm: value };
  }
}

// ─── Readout formatting (number-only — μονάδα ζει στο i18n label, N.11-safe) ───

const MM3_TO_M3 = 1e-9;

/**
 * Υπολογισμένη τιμή ενός readout (όγκοι/βάρη/ρ%) ως αριθμός-string. Επιστρέφει
 * `null` αν το key δεν είναι structural readout. Μονάδες (kg/m³/%) ζουν στις
 * ετικέτες i18n, όχι μέσα στην τιμή. Geometry-is-SSoT: ο όγκος = b·h·span από το
 * ctx (ίδιο SSoT με τις ποσότητες). Τα φορτία ζουν στο `beam-structural-bridge`.
 */
export function resolveBeamStructuralReadout(
  readoutKey: string,
  ctx: BeamSectionContext,
  r: BeamReinforcement,
): string | null {
  const grossVolumeM3 = ctx.grossAreaMm2 * ctx.spanMm * MM3_TO_M3;
  if (readoutKey === BEAM_STRUCTURAL_READOUT_KEYS.concreteVolumeGross) {
    return grossVolumeM3.toFixed(3);
  }
  const quantities = (): ReturnType<typeof computeBeamReinforcementQuantities> =>
    computeBeamReinforcementQuantities(ctx, r);
  if (readoutKey === BEAM_STRUCTURAL_READOUT_KEYS.concreteVolumeNet) {
    const steelVolumeM3 = quantities().totalSteelWeightKg / REBAR_STEEL_DENSITY_KGM3;
    return Math.max(0, grossVolumeM3 - steelVolumeM3).toFixed(3);
  }
  if (readoutKey === BEAM_STRUCTURAL_READOUT_KEYS.concreteWeight) {
    return String(Math.round(concreteWeightKg(grossVolumeM3)));
  }
  if (readoutKey === BEAM_STRUCTURAL_READOUT_KEYS.steelWeight) {
    return String(Math.round(quantities().totalSteelWeightKg));
  }
  if (readoutKey === BEAM_STRUCTURAL_READOUT_KEYS.ratio) {
    return (quantities().ratio * 100).toFixed(2);
  }
  return null;
}
