/**
 * Column reinforcement quantity compute (ADR-456 — Στατικά, Slice 1B).
 *
 * Pure functions: ColumnReinforcement + section context → derived takeoff
 * quantities (bar lengths, stirrup count/length, steel weight, ρ). NEVER stored
 * — re-derived on demand (mirror of geometry-is-SSoT). Lengths in metres, weight
 * in kg, ratio dimensionless.
 *
 * @see ./column-reinforcement-types.ts
 * @see docs/centralized-systems/reference/adrs/ADR-456-structural-quantities-reinforcement.md
 */

import { barAreaMm2, barMassPerMeterKg } from '../rebar-catalog';
import type { ColumnSectionContext } from '../codes/structural-code-types';
import type { ColumnReinforcement } from './column-reinforcement-types';

const MM_TO_M = 0.001;

/**
 * Συντελεστής μήκους ματίσματος/αναμονής διαμήκους ράβδου (× dbL). Τυπικό μάτισμα
 * RC κολώνας ~50·Ø — προστίθεται στο καθαρό ύψος για ρεαλιστικό μήκος αγοράς.
 */
const LONGITUDINAL_LAP_FACTOR = 50;

/** Μήκος ενός γάντζου συνδετήρα (× dbw). 135° γάντζος EC8 ≥ 10·dbw, ×2 γάντζοι. */
const STIRRUP_HOOK_FACTOR = 10;

/** Derived takeoff quantities for a column's reinforcement. */
export interface ColumnReinforcementQuantities {
  /** Συνολικό μήκος διαμήκων ράβδων (m). */
  readonly longitudinalLengthM: number;
  /** Βάρος διαμήκους οπλισμού (kg). */
  readonly longitudinalWeightKg: number;
  /** Πλήθος συνδετήρων (τεμάχια). */
  readonly stirrupCount: number;
  /** Μήκος ενός συνδετήρα (m). */
  readonly stirrupSingleLengthM: number;
  /** Συνολικό μήκος συνδετήρων (m). */
  readonly stirrupTotalLengthM: number;
  /** Βάρος εγκάρσιου οπλισμού (kg). */
  readonly stirrupWeightKg: number;
  /** Συνολικό βάρος χάλυβα οπλισμού B500C (kg). */
  readonly totalSteelWeightKg: number;
  /** Ποσοστό διαμήκους οπλισμού ρ = As/Ac. */
  readonly ratio: number;
}

/**
 * Μήκος κρίσιμης περιοχής άκρου lcr (mm). EC8 §5.4.3.2.2(4):
 * lcr = max(μέγιστη διάσταση διατομής, ύψος/6, 450mm).
 */
function criticalZoneLengthMm(ctx: ColumnSectionContext): number {
  const bMax = Math.max(ctx.widthMm, ctx.depthMm);
  return Math.max(bMax, ctx.heightMm / 6, 450);
}

/** Πλήθος συνδετήρων με πύκνωση 2 κρίσιμων ζωνών + μεσαίας ζώνης. */
function computeStirrupCount(ctx: ColumnSectionContext, r: ColumnReinforcement): number {
  const { spacingMm, spacingCriticalMm } = r.stirrups;
  if (ctx.heightMm <= 0 || spacingMm <= 0) return 0;
  const sCrit = spacingCriticalMm && spacingCriticalMm > 0 ? spacingCriticalMm : spacingMm;
  const criticalTotal = Math.min(ctx.heightMm, 2 * criticalZoneLengthMm(ctx));
  const midZone = Math.max(0, ctx.heightMm - criticalTotal);
  return Math.ceil(criticalTotal / sCrit) + Math.ceil(midZone / spacingMm) + 1;
}

/** Μήκος ενός κλειστού συνδετήρα (mm): περίμετρος εσωτ. ορθογωνίου + 2 γάντζοι. */
function stirrupSingleLengthMm(ctx: ColumnSectionContext, r: ColumnReinforcement): number {
  const innerW = Math.max(0, ctx.widthMm - 2 * r.coverMm);
  const innerD = Math.max(0, ctx.depthMm - 2 * r.coverMm);
  const perimeter = 2 * (innerW + innerD);
  const hooks = 2 * STIRRUP_HOOK_FACTOR * r.stirrups.diameterMm;
  return perimeter + hooks;
}

/**
 * Υπολογισμός όλων των ποσοτήτων οπλισμού της κολώνας. Επιστρέφει μηδενικά αν η
 * διατομή/ύψος είναι εκφυλισμένα.
 */
export function computeColumnReinforcementQuantities(
  ctx: ColumnSectionContext,
  r: ColumnReinforcement,
): ColumnReinforcementQuantities {
  const dbL = r.longitudinal.diameterMm;
  const nBars = r.longitudinal.count;

  const barLengthMm = ctx.heightMm + LONGITUDINAL_LAP_FACTOR * dbL;
  const longitudinalLengthM = nBars * barLengthMm * MM_TO_M;
  const longitudinalWeightKg = longitudinalLengthM * barMassPerMeterKg(dbL);

  const stirrupCount = computeStirrupCount(ctx, r);
  const stirrupSingleLengthM = stirrupSingleLengthMm(ctx, r) * MM_TO_M;
  const stirrupTotalLengthM = stirrupCount * stirrupSingleLengthM;
  const stirrupWeightKg = stirrupTotalLengthM * barMassPerMeterKg(r.stirrups.diameterMm);

  const ratio = ctx.grossAreaMm2 > 0 ? (nBars * barAreaMm2(dbL)) / ctx.grossAreaMm2 : 0;

  return {
    longitudinalLengthM,
    longitudinalWeightKg,
    stirrupCount,
    stirrupSingleLengthM,
    stirrupTotalLengthM,
    stirrupWeightKg,
    totalSteelWeightKg: longitudinalWeightKg + stirrupWeightKg,
    ratio,
  };
}

/** Σύντομη ετικέτα διαμήκους οπλισμού — π.χ. «4Ø16» (Revit/μελετητική σύμβαση). */
export function formatLongitudinalLabel(r: ColumnReinforcement): string {
  return `${r.longitudinal.count}Ø${r.longitudinal.diameterMm}`;
}

/** Σύντομη ετικέτα συνδετήρων — π.χ. «Ø8/100-200» ή «Ø8/200» χωρίς πύκνωση. */
export function formatStirrupsLabel(r: ColumnReinforcement): string {
  const { diameterMm, spacingMm, spacingCriticalMm } = r.stirrups;
  const spacing = spacingCriticalMm && spacingCriticalMm > 0 && spacingCriticalMm !== spacingMm
    ? `${spacingCriticalMm}-${spacingMm}`
    : `${spacingMm}`;
  return `Ø${diameterMm}/${spacing}`;
}
