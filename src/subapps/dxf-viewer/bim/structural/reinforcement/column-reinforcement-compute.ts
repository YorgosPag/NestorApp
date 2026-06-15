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
import { DEFAULT_STIRRUP_TYPE } from './column-reinforcement-types';
import {
  computeColumnRebarLayout,
  computeStirrupLevelsMm,
  stirrupCenterlinePerimeterMm,
  STIRRUP_HOOK_EXTENSION_FACTOR,
} from './column-rebar-layout';
import { buildColumnCrossTies, crossTieCenterlineLengthMm } from './column-cross-ties';

const MM_TO_M = 0.001;

/**
 * Επιπλέον στροφές αγκύρωσης σπείρας στα δύο άκρα (× περίμετρος). EC2: ~1.5
 * επιπλέον στροφές για ανάπτυξη της συνεχούς ράβδου στα άκρα του θώρακα.
 */
const SPIRAL_END_ANCHORAGE_TURNS = 1.5;

/**
 * Συντελεστής μήκους ματίσματος/αναμονής διαμήκους ράβδου (× dbL). Τυπικό μάτισμα
 * RC κολώνας ~50·Ø — προστίθεται στο καθαρό ύψος για ρεαλιστικό μήκος αγοράς.
 */
const LONGITUDINAL_LAP_FACTOR = 50;


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
  /** Πλήθος τεμαχίων εσωτερικών συνδετηρίων (cross-ties) σε όλο το ύψος. */
  readonly crossTieCount: number;
  /** Συνολικό μήκος εσωτερικών συνδετηρίων (m). */
  readonly crossTieTotalLengthM: number;
  /** Βάρος εσωτερικών συνδετηρίων (kg). */
  readonly crossTieWeightKg: number;
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

/**
 * Περίμετρος **άξονα** (centerline) συνδετήρα (mm). Geometry-is-SSoT: delegate στο
 * ΙΔΙΟ `stirrupCenterlinePerimeterMm` του layout (centerline inset = cover + dbw/2 +
 * στρογγυλεμένες γωνίες EC2) → το βάρος χάλυβα ταιριάζει ΑΚΡΙΒΩΣ με τη σχεδίαση
 * 2Δ/3Δ (αντί για το παλιό cover-based ορθογώνιο που αγνοούσε Ø_συνδ + κάμψη).
 */
function stirrupPerimeterMm(ctx: ColumnSectionContext, r: ColumnReinforcement): number {
  return stirrupCenterlinePerimeterMm(r, ctx.widthMm, ctx.depthMm);
}

/**
 * Μήκος ενός κλειστού συνδετήρα (mm) ανά τύπο: περίμετρος + (γάντζοι 135° μόνο
 * στον `closed-hooked`). Ο `closed-welded` = περίμετρος μόνο (η ραφή αμελητέα).
 * Ο `spiral` δεν έχει «μεμονωμένο» μήκος — υπολογίζεται συνολικά αλλού.
 */
function stirrupSingleLengthMm(ctx: ColumnSectionContext, r: ColumnReinforcement): number {
  const perimeter = stirrupPerimeterMm(ctx, r);
  const type = r.stirrups.type ?? DEFAULT_STIRRUP_TYPE;
  if (type === 'closed-welded') return perimeter; // χωρίς γάντζους — λιγότερο σίδερο
  const hooks = 2 * STIRRUP_HOOK_EXTENSION_FACTOR * r.stirrups.diameterMm; // 2 × γάντζος 135° (EC8 10·dbw)
  return perimeter + hooks;
}

/**
 * Σπειροειδής (θώρακας): συνολικό μήκος συνεχούς ράβδου = άθροισμα μηκών στροφών
 * (μία ανά κενό σταθμών — reuse `computeStirrupLevelsMm` ⇒ πύκνωση άκρων) +
 * αγκύρωση άκρων. Κάθε στροφή ≈ √(περίμετρος² + βήμα²) (ελικοειδές μήκος).
 */
function spiralTotals(ctx: ColumnSectionContext, r: ColumnReinforcement): { turns: number; totalMm: number } {
  const perimeter = stirrupPerimeterMm(ctx, r);
  if (perimeter <= 0) return { turns: 0, totalMm: 0 };
  const levels = computeStirrupLevelsMm(r, ctx.widthMm, ctx.depthMm, ctx.heightMm);
  let totalMm = 0;
  for (let i = 1; i < levels.length; i++) {
    const pitch = levels[i] - levels[i - 1];
    totalMm += Math.hypot(perimeter, pitch);
  }
  totalMm += SPIRAL_END_ANCHORAGE_TURNS * perimeter;
  return { turns: Math.max(0, levels.length - 1), totalMm };
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

  // Εγκάρσιος οπλισμός ανά τύπο: spiral = συνεχής (turns × ελικοειδές μήκος)·
  // closed-hooked/welded = N μεμονωμένα κλειστά (με/χωρίς γάντζους).
  const isSpiral = (r.stirrups.type ?? DEFAULT_STIRRUP_TYPE) === 'spiral';
  const spiral = isSpiral ? spiralTotals(ctx, r) : null;
  const stirrupCount = spiral ? spiral.turns : computeStirrupCount(ctx, r);
  const stirrupTotalLengthM = (spiral ? spiral.totalMm : stirrupCount * stirrupSingleLengthMm(ctx, r)) * MM_TO_M;
  const stirrupSingleLengthM = stirrupCount > 0 ? stirrupTotalLengthM / stirrupCount : 0;
  const stirrupWeightKg = stirrupTotalLengthM * barMassPerMeterKg(r.stirrups.diameterMm);

  // Εσωτερικά συνδετήρια (cross-ties / διαμάντι, EC8): μία διάταξη ανά στάθμη
  // στεφανιού (ίδιο πλήθος `stirrupCount`). Geometry-is-SSoT — ΙΔΙΑ γεωμετρία με
  // τη σχεδίαση 2Δ/3Δ. Διάμετρος = αυτή των συνδετήρων.
  const dbw = r.stirrups.diameterMm;
  const layout = computeColumnRebarLayout(r, ctx.widthMm, ctx.depthMm);
  const crossTies = layout ? buildColumnCrossTies(layout.longitudinalBarsMm, dbw, dbL, r.crossTiePattern) : [];
  const crossTieSingleSetLengthMm = crossTies.reduce((sum, t) => sum + crossTieCenterlineLengthMm(t), 0);
  const crossTieCount = crossTies.length * stirrupCount;
  const crossTieTotalLengthM = crossTieSingleSetLengthMm * stirrupCount * MM_TO_M;
  const crossTieWeightKg = crossTieTotalLengthM * barMassPerMeterKg(dbw);

  const ratio = ctx.grossAreaMm2 > 0 ? (nBars * barAreaMm2(dbL)) / ctx.grossAreaMm2 : 0;

  return {
    longitudinalLengthM,
    longitudinalWeightKg,
    stirrupCount,
    stirrupSingleLengthM,
    stirrupTotalLengthM,
    stirrupWeightKg,
    crossTieCount,
    crossTieTotalLengthM,
    crossTieWeightKg,
    totalSteelWeightKg: longitudinalWeightKg + stirrupWeightKg + crossTieWeightKg,
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
