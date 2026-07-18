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
  closedPolylineLengthMm,
  computeColumnRebarLayout,
  computeStirrupLevelsMm,
  stirrupCenterlinePerimeterMm,
  STIRRUP_HOOK_EXTENSION_FACTOR,
  type ColumnRebarLayout,
} from './column-rebar-layout';
import { buildColumnCrossTies, crossTieCenterlineLengthMm } from './column-cross-ties';
import { resolveColumnRebarLayout, resolveColumnCrossTies } from './column-rebar-layout-resolve';
import { isWallReinforcementMode, type ColumnReinforcementSection } from './column-section-outline';

const MM_TO_M = 0.001;

/**
 * Επιπλέον στροφές αγκύρωσης σπείρας στα δύο άκρα (× περίμετρος). EC2: ~1.5
 * επιπλέον στροφές για ανάπτυξη της συνεχούς ράβδου στα άκρα του θώρακα.
 */
const SPIRAL_END_ANCHORAGE_TURNS = 1.5;

/**
 * Συντελεστής μήκους ματίσματος/αναμονής διαμήκους ράβδου (× dbL) — **flat
 * fallback μεμονωμένης κολώνας**. Τυπικό μάτισμα RC κολώνας ~50·Ø. Όταν τρέχει η
 * οργανική συνέχεια (ADR-459 Φ4c) αντικαθίσταται από το πραγματικό μήκος των
 * συνδέσεων μέσω του {@link ColumnLongitudinalContinuity}.
 */
const LONGITUDINAL_LAP_FACTOR = 50;

/**
 * Οργανική συνέχεια διαμήκους οπλισμού κολώνας (ADR-459 Φ4c, DERIVED). Παράγεται
 * από το `organism/reinforcement-continuity` και αντικαθιστά το flat 50·Ø με το
 * πραγματικό άθροισμα ματίσματος/αγκύρωσης στις συνδέσεις (βάση↔πέδιλο, κορυφή↔
 * όροφος). Absent → flat fallback (μεμονωμένη κολώνα, back-compat).
 */
export interface ColumnLongitudinalContinuity {
  /** Συνολική ανάπτυξη ανά διαμήκη ράβδο (mm) — αθροισμένη και στα δύο άκρα. */
  readonly developmentMm: number;
}


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
  // ADR-460 — μέγιστη διάσταση: maxDimensionMm (shape-aware) ή max(width,depth).
  const bMax = ctx.maxDimensionMm ?? Math.max(ctx.widthMm, ctx.depthMm);
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
function stirrupSingleLengthMm(perimeterMm: number, r: ColumnReinforcement): number {
  const type = r.stirrups.type ?? DEFAULT_STIRRUP_TYPE;
  if (type === 'closed-welded') return perimeterMm; // χωρίς γάντζους — λιγότερο σίδερο
  const hooks = 2 * STIRRUP_HOOK_EXTENSION_FACTOR * r.stirrups.diameterMm; // 2 × γάντζος 135° (EC8 10·dbw)
  return perimeterMm + hooks;
}

/**
 * Σπειροειδής (θώρακας): συνολικό μήκος συνεχούς ράβδου = άθροισμα μηκών στροφών
 * (μία ανά κενό σταθμών — reuse `computeStirrupLevelsMm` ⇒ πύκνωση άκρων) +
 * αγκύρωση άκρων. Κάθε στροφή ≈ √(περίμετρος² + βήμα²) (ελικοειδές μήκος).
 */
function spiralTotals(perimeterMm: number, levels: readonly number[]): { turns: number; totalMm: number } {
  if (perimeterMm <= 0) return { turns: 0, totalMm: 0 };
  let totalMm = 0;
  for (let i = 1; i < levels.length; i++) {
    const pitch = levels[i] - levels[i - 1];
    totalMm += Math.hypot(perimeterMm, pitch);
  }
  totalMm += SPIRAL_END_ANCHORAGE_TURNS * perimeterMm;
  return { turns: Math.max(0, levels.length - 1), totalMm };
}

/**
 * Διαμήκης χάλυβας (As, μήκος, βάρος): **wall** → boundary (2 κρυφοκολώνες) + web
 * (μικτές Ø)· αλλιώς n·dbL (perimeter/circular). ADR-460.
 */
function longitudinalSteel(
  r: ColumnReinforcement,
  layout: ColumnRebarLayout | null,
  barLengthMm: number,
  isWall: boolean,
): { areaMm2: number; lengthM: number; weightKg: number } {
  if (isWall && r.wall && layout) {
    const nB = 2 * r.wall.boundary.count;
    const dB = r.wall.boundary.diameterMm;
    const dW = r.wall.webVertical.diameterMm;
    const nW = Math.max(0, layout.longitudinalBarsMm.length - nB);
    const areaMm2 = nB * barAreaMm2(dB) + nW * barAreaMm2(dW);
    const lengthM = (nB + nW) * barLengthMm * MM_TO_M;
    const weightKg =
      (nB * barLengthMm * barMassPerMeterKg(dB) + nW * barLengthMm * barMassPerMeterKg(dW)) * MM_TO_M;
    return { areaMm2, lengthM, weightKg };
  }
  // Geometry-is-SSoT: μέτρα τις **πραγματικές** ράβδους του layout (multihoop spacing-
  // derived → πιο πολλές από το intent count)· fallback στο intent count όταν δεν υπάρχει
  // layout. Ορθογωνικό fast-path: layout bars === floor(count) → ίδιοι αριθμοί (μηδέν regression).
  const n = layout ? layout.longitudinalBarsMm.length : r.longitudinal.count;
  const d = r.longitudinal.diameterMm;
  const lengthM = n * barLengthMm * MM_TO_M;
  return { areaMm2: n * barAreaMm2(d), lengthM, weightKg: lengthM * barMassPerMeterKg(d) };
}

/**
 * Υπολογισμός όλων των ποσοτήτων οπλισμού της κολώνας **οποιουδήποτε σχήματος**
 * (ADR-460). `section` παρόν → shape-aware (dispatcher: perimeter/circular/wall)·
 * absent → ορθογωνικό fast-path (back-compat, ίδιοι αριθμοί). `continuity` (ADR-459
 * Φ4c) αντικαθιστά το flat 50·Ø. Επιστρέφει μηδενικά αν διατομή/ύψος εκφυλισμένα.
 */
export function computeColumnReinforcementQuantities(
  ctx: ColumnSectionContext,
  r: ColumnReinforcement,
  continuity?: ColumnLongitudinalContinuity,
  section?: ColumnReinforcementSection,
): ColumnReinforcementQuantities {
  const dbL = r.longitudinal.diameterMm;
  const dbw = r.stirrups.diameterMm;
  const developmentMm = continuity ? continuity.developmentMm : LONGITUDINAL_LAP_FACTOR * dbL;
  const barLengthMm = ctx.heightMm + developmentMm;

  // Geometry-is-SSoT: ΙΔΙΑ διάταξη με 2Δ/3Δ μέσω του dispatcher (ή rect fast-path).
  const layout = section ? resolveColumnRebarLayout(r, section) : computeColumnRebarLayout(r, ctx.widthMm, ctx.depthMm);
  const isWall = isWallReinforcementMode(section?.mode);
  const lng = longitudinalSteel(r, layout, barLengthMm, isWall);

  // Εγκάρσιος οπλισμός ανά τύπο: spiral = συνεχής· closed-hooked/welded = N κλειστά.
  const perimeterMm = layout?.stirrupCenterlineLengthMm ?? stirrupPerimeterMm(ctx, r);
  const levels = computeStirrupLevelsMm(
    r,
    section ? section.bboxWidthMm : ctx.widthMm,
    section ? section.bboxDepthMm : ctx.depthMm,
    ctx.heightMm,
  );
  const isSpiral = (r.stirrups.type ?? DEFAULT_STIRRUP_TYPE) === 'spiral';
  const spiral = isSpiral ? spiralTotals(perimeterMm, levels) : null;
  const stirrupCount = spiral ? spiral.turns : computeStirrupCount(ctx, r);
  // Boundary/extra hoops (extra closed loops) — επαναλαμβάνονται ανά στάθμη. ADR-456: προτίμα το
  // **αναλυτικό** (arc-aware, decoupled) μήκος ανά hoop· fallback σε μέτρηση tessellated path όταν
  // ο builder δεν το παρέχει (adaptive → <0,1% σφάλμα). ΠΟΤΕ display polyline όταν υπάρχει analytic.
  const extraHoopMm =
    layout?.extraStirrupCenterlineLengthsMm?.reduce((s, l) => s + l, 0)
    ?? layout?.extraStirrupPathsMm?.reduce((s, p) => s + closedPolylineLengthMm(p), 0)
    ?? 0;
  const stirrupTotalLengthM =
    (spiral ? spiral.totalMm : stirrupCount * (stirrupSingleLengthMm(perimeterMm, r) + extraHoopMm)) * MM_TO_M;
  const stirrupSingleLengthM = stirrupCount > 0 ? stirrupTotalLengthM / stirrupCount : 0;
  const stirrupWeightKg = stirrupTotalLengthM * barMassPerMeterKg(dbw);

  // Εσωτερικά συνδετήρια (cross-ties): shape-aware dispatch όταν υπάρχει section.
  const crossTies = layout
    ? section
      ? resolveColumnCrossTies(layout, section, r)
      : buildColumnCrossTies(layout.longitudinalBarsMm, dbw, dbL, r.crossTiePattern)
    : [];
  const crossTieSingleSetLengthMm = crossTies.reduce((sum, t) => sum + crossTieCenterlineLengthMm(t), 0);
  const crossTieCount = crossTies.length * stirrupCount;
  const crossTieTotalLengthM = crossTieSingleSetLengthMm * stirrupCount * MM_TO_M;
  const crossTieWeightKg = crossTieTotalLengthM * barMassPerMeterKg(dbw);

  const ratio = ctx.grossAreaMm2 > 0 ? lng.areaMm2 / ctx.grossAreaMm2 : 0;

  return {
    longitudinalLengthM: lng.lengthM,
    longitudinalWeightKg: lng.weightKg,
    stirrupCount,
    stirrupSingleLengthM,
    stirrupTotalLengthM,
    stirrupWeightKg,
    crossTieCount,
    crossTieTotalLengthM,
    crossTieWeightKg,
    totalSteelWeightKg: lng.weightKg + stirrupWeightKg + crossTieWeightKg,
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
