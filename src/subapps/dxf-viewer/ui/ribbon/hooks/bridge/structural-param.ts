/**
 * ADR-456 Slice 2 — Column structural/reinforcement ribbon helper SSoT.
 *
 * Combobox options (κανονισμός / κατηγορία σκυροδέματος / Ø ράβδων-συνδετήρων /
 * βήματα / επικάλυψη) + pure read/patch helpers πάνω στο `ColumnReinforcement`
 * + readout formatting. ΟΛΑ τα μεγέθη/κατάλογοι/μαθηματικά προέρχονται από το
 * `bim/structural/` — ΜΗΔΕΝ inline στατική λογική στο ribbon (mirror του
 * `finish-param.ts`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-456-structural-quantities-reinforcement.md
 */

import {
  CONCRETE_GRADE_ORDER,
  concreteWeightKg,
} from '../../../../bim/structural/concrete-grades';
import { REBAR_DIAMETERS_MM, REBAR_STEEL_DENSITY_KGM3 } from '../../../../bim/structural/rebar-catalog';
import {
  STIRRUP_TYPE_ORDER,
  CROSS_TIE_PATTERN_ORDER,
} from '../../../../bim/structural/reinforcement/column-reinforcement-types';
import {
  STRUCTURAL_CODE_ORDER,
  resolveStructuralCode,
  type ColumnSectionContext,
} from '../../../../bim/structural/codes';
import { computeColumnReinforcementQuantities } from '../../../../bim/structural/reinforcement/column-reinforcement-compute';
import { computeColumnConfinement } from '../../../../bim/structural/reinforcement/column-confinement';
import { resolveColumnRebarLayout } from '../../../../bim/structural/reinforcement/column-rebar-layout-resolve';
import type { ColumnReinforcementSection } from '../../../../bim/structural/reinforcement/column-section-outline';
import type { ColumnReinforcement } from '../../../../bim/structural/reinforcement/column-reinforcement-types';
import {
  COLUMN_STRUCTURAL_READOUT_KEYS,
  type StructuralReinforcementField,
} from './column-command-keys';

interface ComboboxOption {
  readonly value: string;
  readonly labelKey: string;
  readonly isLiteralLabel: boolean;
}

/** Helper — αριθμητικός κατάλογος → literal-label options. */
function numericOptions(values: readonly number[]): readonly ComboboxOption[] {
  return values.map((v) => ({ value: String(v), labelKey: String(v), isLiteralLabel: true }));
}

// ─── Combobox option lists (ΟΛΕΣ generated από τα structural SSoT) ─────────────

/** Κανονισμός — label από τον provider (i18n key, π.χ. «Ευρωκώδικες»). */
export const STRUCTURAL_CODE_OPTIONS: readonly ComboboxOption[] = STRUCTURAL_CODE_ORDER.map((id) => ({
  value: id,
  labelKey: resolveStructuralCode(id).labelKey,
  isLiteralLabel: false,
}));

/** Κατηγορία σκυροδέματος — literal labels (π.χ. «C25/30»). */
export const CONCRETE_GRADE_OPTIONS: readonly ComboboxOption[] = CONCRETE_GRADE_ORDER.map((g) => ({
  value: g,
  labelKey: g,
  isLiteralLabel: true,
}));

/** Εμπορικές διάμετροι διαμήκους ράβδου (mm). */
export const LONGITUDINAL_DIAMETER_OPTIONS = numericOptions(REBAR_DIAMETERS_MM);

/** Πλήθος διαμήκων ράβδων (τυπικά ορθογωνικής κολώνας). */
export const LONGITUDINAL_COUNT_OPTIONS = numericOptions([4, 6, 8, 10, 12]);

/** Τύπος συνδετήρα — i18n labels (κλειστός γάντζων/συγκολλητός/σπειροειδής). */
export const STIRRUP_TYPE_OPTIONS: readonly ComboboxOption[] = STIRRUP_TYPE_ORDER.map((t) => ({
  value: t,
  labelKey: `ribbon.commands.columnStructural.stirrupTypeOption.${t}`,
  isLiteralLabel: false,
}));

/** Μοτίβο εσωτερικών συνδετηρίων — i18n labels (Αυτόματο/Διαμάντι/Πλέγμα). */
export const CROSS_TIE_PATTERN_OPTIONS: readonly ComboboxOption[] = CROSS_TIE_PATTERN_ORDER.map((p) => ({
  value: p,
  labelKey: `ribbon.commands.columnStructural.crossTiePatternOption.${p}`,
  isLiteralLabel: false,
}));

/** Διάμετροι συνδετήρων (mm). */
export const STIRRUP_DIAMETER_OPTIONS = numericOptions([6, 8, 10, 12]);

/** Βήμα συνδετήρων μεσαίας ζώνης (mm). */
export const STIRRUP_SPACING_OPTIONS = numericOptions([100, 150, 200, 250, 300]);

/** Κρίσιμο βήμα συνδετήρων άκρων (mm). */
export const STIRRUP_CRITICAL_SPACING_OPTIONS = numericOptions([50, 75, 100, 125, 150]);

/** Επικάλυψη cnom (mm). */
export const COVER_OPTIONS = numericOptions([20, 25, 30, 35, 40]);

// ─── Pure read/patch πάνω στο ColumnReinforcement ─────────────────────────────

/** Τρέχουσα τιμή ενός αριθμητικού πεδίου οπλισμού (για το combobox value). */
export function readReinforcementField(
  r: ColumnReinforcement,
  field: StructuralReinforcementField,
): number {
  switch (field) {
    case 'longitudinalDiameter': return r.longitudinal.diameterMm;
    case 'longitudinalCount': return r.longitudinal.count;
    case 'stirrupDiameter': return r.stirrups.diameterMm;
    case 'stirrupSpacing': return r.stirrups.spacingMm;
    case 'stirrupCriticalSpacing': return r.stirrups.spacingCriticalMm ?? r.stirrups.spacingMm;
    case 'cover': return r.coverMm;
  }
}

/** Νέο `ColumnReinforcement` με ενημερωμένο ένα αριθμητικό πεδίο (immutable). */
export function patchReinforcementField(
  r: ColumnReinforcement,
  field: StructuralReinforcementField,
  value: number,
): ColumnReinforcement {
  switch (field) {
    case 'longitudinalDiameter':
      return { ...r, longitudinal: { ...r.longitudinal, diameterMm: value } };
    case 'longitudinalCount':
      return { ...r, longitudinal: { ...r.longitudinal, count: value } };
    case 'stirrupDiameter':
      return { ...r, stirrups: { ...r.stirrups, diameterMm: value } };
    case 'stirrupSpacing':
      return { ...r, stirrups: { ...r.stirrups, spacingMm: value } };
    case 'stirrupCriticalSpacing':
      return { ...r, stirrups: { ...r.stirrups, spacingCriticalMm: value } };
    case 'cover':
      return { ...r, coverMm: value };
  }
}

// ─── Readout formatting (number-only — μονάδα ζει στο i18n label, N.11-safe) ───

/**
 * Υπολογισμένη τιμή ενός readout (kg βάρος σκυρ./χάλυβα ή ρ%) ως αριθμός-string.
 * Επιστρέφει `null` αν το key δεν είναι structural readout. Μονάδες (kg/%) ζουν
 * στις ετικέτες i18n, όχι μέσα στην τιμή.
 */
export function resolveStructuralReadout(
  readoutKey: string,
  volumeM3: number,
  ctx: ColumnSectionContext,
  effectiveReinforcement: ColumnReinforcement,
  section?: ColumnReinforcementSection,
): string | null {
  // ADR-460 — shape-aware ποσότητες/περίσφιγξη όταν δίνεται section (dispatcher).
  const quantities = (): ReturnType<typeof computeColumnReinforcementQuantities> =>
    computeColumnReinforcementQuantities(ctx, effectiveReinforcement, undefined, section);
  if (readoutKey === COLUMN_STRUCTURAL_READOUT_KEYS.concreteVolumeGross) {
    return volumeM3.toFixed(3); // μικτός όγκος (συμβατική επιμέτρηση)
  }
  if (readoutKey === COLUMN_STRUCTURAL_READOUT_KEYS.concreteVolumeNet) {
    const steelVolumeM3 = quantities().totalSteelWeightKg / REBAR_STEEL_DENSITY_KGM3;
    return Math.max(0, volumeM3 - steelVolumeM3).toFixed(3); // καθαρός = μικτός − χάλυβας
  }
  if (readoutKey === COLUMN_STRUCTURAL_READOUT_KEYS.concreteWeight) {
    return String(Math.round(concreteWeightKg(volumeM3)));
  }
  if (readoutKey === COLUMN_STRUCTURAL_READOUT_KEYS.steelWeight) {
    return String(Math.round(quantities().totalSteelWeightKg));
  }
  if (readoutKey === COLUMN_STRUCTURAL_READOUT_KEYS.ratio) {
    return (quantities().ratio * 100).toFixed(2);
  }
  if (readoutKey === COLUMN_STRUCTURAL_READOUT_KEYS.confinement) {
    const layout = section ? resolveColumnRebarLayout(effectiveReinforcement, section) : null;
    return computeColumnConfinement(ctx, effectiveReinforcement, layout).alpha.toFixed(2);
  }
  return null;
}
