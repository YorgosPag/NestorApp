/**
 * Beam reinforcement quantity compute (ADR-459 Phase 4a).
 *
 * Pure functions: BeamReinforcement + section context → derived takeoff
 * quantities (διαμήκη μήκη κάτω/άνω, πλήθος/μήκος συνδετήρων, βάρος χάλυβα, ρ).
 * NEVER stored — re-derived on demand (mirror geometry-is-SSoT, όπως η κολόνα).
 * Μήκη σε μέτρα, βάρος σε kg, ρ αδιάστατο.
 *
 * Το flat `LONGITUDINAL_LAP_FACTOR` (μάτισμα/αγκύρωση ανά ράβδο) είναι προσέγγιση
 * για μεμονωμένη δοκό· η οργανική συνέχεια (πραγματικές αγκυρώσεις σε στηρίξεις)
 * εκλεπτύνεται στο Phase 4c (`organism/reinforcement-continuity`).
 *
 * @see ./column-reinforcement-compute.ts — ο δίδυμος της κολόνας
 * @see ./beam-reinforcement-types.ts
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 4
 */

import { barAreaMm2, barMassPerMeterKg } from '../rebar-catalog';
import { STIRRUP_HOOK_EXTENSION_FACTOR } from './column-rebar-layout';
import {
  DEFAULT_BEAM_STIRRUP_LEGS,
  DEFAULT_STIRRUP_TYPE,
  type BeamReinforcement,
} from './beam-reinforcement-types';
import type { BeamSectionContext } from '../codes/structural-code-types';

const MM_TO_M = 0.001;

/** Μελετητική ενεργός διατομή d ≈ 0.9·h (για το ρ). */
const BEAM_EFFECTIVE_DEPTH_FACTOR = 0.9;

/**
 * Συντελεστής ματίσματος/αγκύρωσης διαμήκους ράβδου (× dbL) — **flat fallback**
 * μεμονωμένης δοκού. Όταν τρέχει η οργανική συνέχεια (ADR-459 Φ4c) αντικαθίσταται
 * από την πραγματική αγκύρωση στις στηρίξεις μέσω {@link BeamLongitudinalContinuity}.
 */
const LONGITUDINAL_LAP_FACTOR = 50;

/**
 * Οργανική συνέχεια διαμήκους οπλισμού δοκού (ADR-459 Φ4c, DERIVED). Η αγκύρωση
 * κάτω/άνω ράβδων στους κόμβους (δοκάρι→κολόνα, EC8 §5.6.2) αντικαθιστά το flat
 * 50·Ø ανά στρώση. Absent → flat fallback (back-compat).
 */
export interface BeamLongitudinalContinuity {
  /** Συνολική ανάπτυξη ανά κάτω ράβδο (mm) — άθροισμα αγκυρώσεων στα στηριζόμενα άκρα. */
  readonly bottomDevelopmentMm: number;
  /** Συνολική ανάπτυξη ανά άνω ράβδο (mm). */
  readonly topDevelopmentMm: number;
}

/** Derived takeoff quantities for a beam's reinforcement. */
export interface BeamReinforcementQuantities {
  /** Μήκος κάτω διαμήκων (m). */
  readonly bottomLengthM: number;
  /** Βάρος κάτω διαμήκων (kg). */
  readonly bottomWeightKg: number;
  /** Μήκος άνω διαμήκων (m). */
  readonly topLengthM: number;
  /** Βάρος άνω διαμήκων (kg). */
  readonly topWeightKg: number;
  /** Συνολικό μήκος διαμήκων (κάτω + άνω) (m). */
  readonly longitudinalLengthM: number;
  /** Συνολικό βάρος διαμήκων (kg). */
  readonly longitudinalWeightKg: number;
  /** Πλήθος συνδετήρων (τεμάχια). */
  readonly stirrupCount: number;
  /** Μήκος ενός συνδετήρα (m). */
  readonly stirrupSingleLengthM: number;
  /** Συνολικό μήκος συνδετήρων (m). */
  readonly stirrupTotalLengthM: number;
  /** Βάρος συνδετήρων (kg). */
  readonly stirrupWeightKg: number;
  /** Συνολικό βάρος χάλυβα B500C (kg). */
  readonly totalSteelWeightKg: number;
  /** Ποσοστό εφελκυόμενου (κάτω) οπλισμού ρ = As,bottom / (b·d). */
  readonly ratio: number;
}

/** Πλήθος συνδετήρων: πύκνωση σε κρίσιμες ζώνες άκρων (lcr ≈ h) + μεσαία ζώνη. */
function beamStirrupCount(ctx: BeamSectionContext, r: BeamReinforcement): number {
  const { spacingMm, spacingCriticalMm } = r.stirrups;
  if (ctx.spanMm <= 0 || spacingMm <= 0) return 0;
  const sCrit = spacingCriticalMm && spacingCriticalMm > 0 ? spacingCriticalMm : spacingMm;
  const lcr = ctx.depthMm; // EC8 §5.4.3.1.2(6) — κρίσιμη ζώνη ≈ ύψος διατομής.
  const zones = ctx.supportType === 'cantilever' ? 1 : 2;
  const criticalTotal = Math.min(ctx.spanMm, zones * lcr);
  const midZone = Math.max(0, ctx.spanMm - criticalTotal);
  return Math.ceil(criticalTotal / sCrit) + Math.ceil(midZone / spacingMm) + 1;
}

/** Μήκος ενός κλειστού συνδετήρα δοκού (mm) με `legs` σκέλη (centerline). */
function beamStirrupSingleLengthMm(ctx: BeamSectionContext, r: BeamReinforcement): number {
  const c = r.coverMm;
  const dbw = r.stirrups.diameterMm;
  const inX = Math.max(0, ctx.widthMm - 2 * c - dbw);
  const inY = Math.max(0, ctx.depthMm - 2 * c - dbw);
  const welded = (r.stirrups.type ?? DEFAULT_STIRRUP_TYPE) === 'closed-welded';
  const hook = welded ? 0 : STIRRUP_HOOK_EXTENSION_FACTOR * dbw;
  const outer = 2 * (inX + inY) + 2 * hook; // κλειστό ορθογώνιο + 2 γάντζοι 135°
  const extraLegs = Math.max(0, (r.stirrups.legs ?? DEFAULT_BEAM_STIRRUP_LEGS) - 2);
  return outer + extraLegs * (inY + 2 * hook);
}

/** Υπολογισμός όλων των ποσοτήτων οπλισμού της δοκού. Μηδενικά σε εκφυλισμένη είσοδο. */
export function computeBeamReinforcementQuantities(
  ctx: BeamSectionContext,
  r: BeamReinforcement,
  continuity?: BeamLongitudinalContinuity,
): BeamReinforcementQuantities {
  const bottomDevMm = continuity ? continuity.bottomDevelopmentMm : LONGITUDINAL_LAP_FACTOR * r.bottom.diameterMm;
  const topDevMm = continuity ? continuity.topDevelopmentMm : LONGITUDINAL_LAP_FACTOR * r.top.diameterMm;
  const bottomBarMm = ctx.spanMm + bottomDevMm;
  const topBarMm = ctx.spanMm + topDevMm;
  const bottomLengthM = r.bottom.count * bottomBarMm * MM_TO_M;
  const topLengthM = r.top.count * topBarMm * MM_TO_M;
  const bottomWeightKg = bottomLengthM * barMassPerMeterKg(r.bottom.diameterMm);
  const topWeightKg = topLengthM * barMassPerMeterKg(r.top.diameterMm);

  const stirrupCount = beamStirrupCount(ctx, r);
  const stirrupTotalLengthM = stirrupCount * beamStirrupSingleLengthMm(ctx, r) * MM_TO_M;
  const stirrupSingleLengthM = stirrupCount > 0 ? stirrupTotalLengthM / stirrupCount : 0;
  const stirrupWeightKg = stirrupTotalLengthM * barMassPerMeterKg(r.stirrups.diameterMm);

  const effectiveDepthMm = BEAM_EFFECTIVE_DEPTH_FACTOR * ctx.depthMm;
  const effectiveAreaMm2 = ctx.widthMm * effectiveDepthMm;
  const ratio = effectiveAreaMm2 > 0 ? (r.bottom.count * barAreaMm2(r.bottom.diameterMm)) / effectiveAreaMm2 : 0;

  return {
    bottomLengthM,
    bottomWeightKg,
    topLengthM,
    topWeightKg,
    longitudinalLengthM: bottomLengthM + topLengthM,
    longitudinalWeightKg: bottomWeightKg + topWeightKg,
    stirrupCount,
    stirrupSingleLengthM,
    stirrupTotalLengthM,
    stirrupWeightKg,
    totalSteelWeightKg: bottomWeightKg + topWeightKg + stirrupWeightKg,
    ratio,
  };
}

/** Σύντομη ετικέτα διαμήκων — π.χ. «κάτω 3Ø16 / άνω 2Ø14». */
export function formatBeamLongitudinalLabel(r: BeamReinforcement): string {
  return `${r.bottom.count}Ø${r.bottom.diameterMm} / ${r.top.count}Ø${r.top.diameterMm}`;
}

/** Σύντομη ετικέτα συνδετήρων — π.χ. «Ø8/100-200». */
export function formatBeamStirrupsLabel(r: BeamReinforcement): string {
  const { diameterMm, spacingMm, spacingCriticalMm } = r.stirrups;
  const spacing = spacingCriticalMm && spacingCriticalMm > 0 && spacingCriticalMm !== spacingMm
    ? `${spacingCriticalMm}-${spacingMm}`
    : `${spacingMm}`;
  return `Ø${diameterMm}/${spacing}`;
}
