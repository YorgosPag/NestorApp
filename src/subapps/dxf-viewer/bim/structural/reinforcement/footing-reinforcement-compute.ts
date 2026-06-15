/**
 * Footing reinforcement quantity compute (ADR-459 Phase 4b).
 *
 * Pure functions: FootingReinforcement + section context → derived takeoff
 * quantities (μήκη κύριου/δευτερεύοντος οπλισμού, συνδετήρες, βάρος χάλυβα, ρ).
 * NEVER stored — re-derived on demand (mirror geometry-is-SSoT, όπως κολόνα/δοκάρι).
 * Μήκη σε μέτρα, βάρος σε kg, ρ αδιάστατο.
 *
 * Το flat `LONGITUDINAL_LAP_FACTOR` (μάτισμα διαμήκων strip) είναι προσέγγιση για
 * μεμονωμένο στοιχείο· η οργανική συνέχεια (dowels πεδίλου↔κολόνας, αγκυρώσεις)
 * εκλεπτύνεται στο Phase 4c (`organism/reinforcement-continuity`).
 *
 * @see ./beam-reinforcement-compute.ts — delegate για tie-beam (είναι δοκός)
 * @see ./footing-reinforcement-types.ts
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 4
 */

import { barAreaMm2, barMassPerMeterKg } from '../rebar-catalog';
import { STIRRUP_HOOK_EXTENSION_FACTOR } from './column-rebar-layout';
import { computeBeamReinforcementQuantities } from './beam-reinforcement-compute';
import { DEFAULT_STIRRUP_TYPE } from './beam-reinforcement-types';
import type {
  PadReinforcement,
  RebarMesh,
  StripReinforcement,
  TieBeamReinforcement,
  FootingReinforcement,
} from './footing-reinforcement-types';
import type {
  FootingSectionContext,
  PadSectionContext,
  StripSectionContext,
  TieBeamSectionContext,
} from '../codes/structural-code-types';

const MM_TO_M = 0.001;

/** 90° τελικός γάντζος ανάπτυξης ανά άκρο ράβδου σχάρας (× Ø). */
const MAT_END_ANCHORAGE_FACTOR = 12;

/** Συντελεστής ματίσματος διαμήκων ράβδων strip (× Ø) — flat, refined Phase 4c. */
const LONGITUDINAL_LAP_FACTOR = 50;

/** Kind-neutral derived takeoff quantities for a footing's reinforcement. */
export interface FootingReinforcementQuantities {
  /** Κύριος οπλισμός: pad κάτω σχάρα / strip εγκάρσιες / tie-beam κάτω (m). */
  readonly mainLengthM: number;
  /** Βάρος κύριου οπλισμού (kg). */
  readonly mainWeightKg: number;
  /** Δευτερεύων: pad άνω σχάρα / strip διαμήκεις διανομής / tie-beam άνω (m). */
  readonly secondaryLengthM: number;
  /** Βάρος δευτερεύοντος οπλισμού (kg). */
  readonly secondaryWeightKg: number;
  /** Πλήθος συνδετήρων (strip/tie-beam· 0 για pad). */
  readonly stirrupCount: number;
  /** Συνολικό μήκος συνδετήρων (m). */
  readonly stirrupTotalLengthM: number;
  /** Βάρος συνδετήρων (kg). */
  readonly stirrupWeightKg: number;
  /** Συνολικό βάρος χάλυβα B500C (kg). */
  readonly totalSteelWeightKg: number;
  /** Ποσοστό κύριου (καμπτικού) οπλισμού ρ. */
  readonly ratio: number;
}

/** Πλήθος ράβδων που χωρούν σε διάσταση `perpDim` με δεδομένο βήμα (+1 ακραία). */
function barsAcross(perpDimMm: number, spacingMm: number): number {
  if (perpDimMm <= 0 || spacingMm <= 0) return 0;
  return Math.floor(perpDimMm / spacingMm) + 1;
}

/** Μήκος μίας ράβδου σχάρας (mm): καθαρό άνοιγμα − 2·cover + 2 τελικοί γάντζοι. */
function meshBarLengthMm(spanDimMm: number, diameterMm: number, coverMm: number): number {
  return Math.max(0, spanDimMm - 2 * coverMm) + 2 * MAT_END_ANCHORAGE_FACTOR * diameterMm;
}

/** Ενεργό βάθος θεμελιακού στοιχείου d ≈ thickness − cover. */
function footingEffectiveDepthMm(thicknessMm: number, coverMm: number): number {
  return Math.max(0, thicknessMm - coverMm);
}

/** Μήκος+βάρος μίας διεύθυνσης σχάρας (ράβδοι // `barDim`, βήμα κατά `perpDim`). */
function meshDirectionTotals(
  mesh: RebarMesh,
  barDimMm: number,
  perpDimMm: number,
  coverMm: number,
): { lengthM: number; weightKg: number } {
  const count = barsAcross(perpDimMm, mesh.spacingMm);
  const singleMm = meshBarLengthMm(barDimMm, mesh.diameterMm, coverMm);
  const lengthM = count * singleMm * MM_TO_M;
  return { lengthM, weightKg: lengthM * barMassPerMeterKg(mesh.diameterMm) };
}

/** Pad — δι-διευθυντική κάτω σχάρα + προαιρετική άνω σχάρα. */
function computePadQuantities(
  ctx: PadSectionContext,
  r: PadReinforcement,
): FootingReinforcementQuantities {
  const cover = r.coverMm;
  // bottomMeshX: ράβδοι // X (μήκος=width), βήμα κατά Y (count από length).
  const xDir = meshDirectionTotals(r.bottomMeshX, ctx.widthMm, ctx.lengthMm, cover);
  const yDir = meshDirectionTotals(r.bottomMeshY, ctx.lengthMm, ctx.widthMm, cover);
  const mainLengthM = xDir.lengthM + yDir.lengthM;
  const mainWeightKg = xDir.weightKg + yDir.weightKg;

  let secondaryLengthM = 0;
  let secondaryWeightKg = 0;
  if (r.topMesh) {
    const tx = meshDirectionTotals(r.topMesh, ctx.widthMm, ctx.lengthMm, cover);
    const ty = meshDirectionTotals(r.topMesh, ctx.lengthMm, ctx.widthMm, cover);
    secondaryLengthM = tx.lengthM + ty.lengthM;
    secondaryWeightKg = tx.weightKg + ty.weightKg;
  }

  const dEff = footingEffectiveDepthMm(ctx.thicknessMm, cover);
  const ratio = dEff > 0 && r.bottomMeshX.spacingMm > 0
    ? barAreaMm2(r.bottomMeshX.diameterMm) / (r.bottomMeshX.spacingMm * dEff)
    : 0;

  return {
    mainLengthM,
    mainWeightKg,
    secondaryLengthM,
    secondaryWeightKg,
    stirrupCount: 0,
    stirrupTotalLengthM: 0,
    stirrupWeightKg: 0,
    totalSteelWeightKg: mainWeightKg + secondaryWeightKg,
    ratio,
  };
}

/** Μήκος ενός κλειστού συνδετήρα strip (mm) — ορθογώνιο centerline + 2 γάντζοι 135°. */
function stripStirrupSingleLengthMm(ctx: StripSectionContext, r: StripReinforcement): number {
  if (!r.stirrups) return 0;
  const c = r.coverMm;
  const dbw = r.stirrups.diameterMm;
  const inX = Math.max(0, ctx.widthMm - 2 * c - dbw);
  const inY = Math.max(0, ctx.thicknessMm - 2 * c - dbw);
  const welded = (r.stirrups.type ?? DEFAULT_STIRRUP_TYPE) === 'closed-welded';
  const hook = welded ? 0 : STIRRUP_HOOK_EXTENSION_FACTOR * dbw;
  return 2 * (inX + inY) + 2 * hook;
}

/** Strip — εγκάρσιες (κύριος) + διαμήκεις διανομής + προαιρετικοί συνδετήρες. */
function computeStripQuantities(
  ctx: StripSectionContext,
  r: StripReinforcement,
): FootingReinforcementQuantities {
  const cover = r.coverMm;
  // Εγκάρσιες: ράβδοι // width, βήμα κατά τον άξονα (count από span).
  const transverse = meshDirectionTotals(r.transverse, ctx.widthMm, ctx.spanMm, cover);

  const longSingleMm = ctx.spanMm + LONGITUDINAL_LAP_FACTOR * r.longitudinal.diameterMm;
  const secondaryLengthM = r.longitudinal.count * longSingleMm * MM_TO_M;
  const secondaryWeightKg = secondaryLengthM * barMassPerMeterKg(r.longitudinal.diameterMm);

  const stirrupCount = r.stirrups ? barsAcross(ctx.spanMm, r.stirrups.spacingMm) : 0;
  const stirrupTotalLengthM = stirrupCount * stripStirrupSingleLengthMm(ctx, r) * MM_TO_M;
  const stirrupWeightKg = r.stirrups
    ? stirrupTotalLengthM * barMassPerMeterKg(r.stirrups.diameterMm)
    : 0;

  const dEff = footingEffectiveDepthMm(ctx.thicknessMm, cover);
  const ratio = dEff > 0 && r.transverse.spacingMm > 0
    ? barAreaMm2(r.transverse.diameterMm) / (r.transverse.spacingMm * dEff)
    : 0;

  return {
    mainLengthM: transverse.lengthM,
    mainWeightKg: transverse.weightKg,
    secondaryLengthM,
    secondaryWeightKg,
    stirrupCount,
    stirrupTotalLengthM,
    stirrupWeightKg,
    totalSteelWeightKg: transverse.weightKg + secondaryWeightKg + stirrupWeightKg,
    ratio,
  };
}

/** Tie-beam — ΕΙΝΑΙ δοκός → delegate στον beam compute (μηδέν duplicate, N.0.2). */
function computeTieBeamQuantities(
  ctx: TieBeamSectionContext,
  r: TieBeamReinforcement,
): FootingReinforcementQuantities {
  const q = computeBeamReinforcementQuantities(ctx, r);
  return {
    mainLengthM: q.bottomLengthM,
    mainWeightKg: q.bottomWeightKg,
    secondaryLengthM: q.topLengthM,
    secondaryWeightKg: q.topWeightKg,
    stirrupCount: q.stirrupCount,
    stirrupTotalLengthM: q.stirrupTotalLengthM,
    stirrupWeightKg: q.stirrupWeightKg,
    totalSteelWeightKg: q.totalSteelWeightKg,
    ratio: q.ratio,
  };
}

/**
 * Υπολογισμός όλων των ποσοτήτων οπλισμού θεμελίωσης. Διασπά ανά kind (το ctx και
 * το reinforcement έχουν συμβατό discriminator). Μηδενικά σε εκφυλισμένη είσοδο.
 */
export function computeFootingReinforcementQuantities(
  ctx: FootingSectionContext,
  r: FootingReinforcement,
): FootingReinforcementQuantities {
  if (ctx.kind === 'pad' && r.kind === 'pad') return computePadQuantities(ctx, r);
  if (ctx.kind === 'strip' && r.kind === 'strip') return computeStripQuantities(ctx, r);
  if (ctx.kind === 'tie-beam' && r.kind === 'tie-beam') return computeTieBeamQuantities(ctx, r);
  throw new Error(`Footing reinforcement kind mismatch: ctx=${ctx.kind} r=${r.kind}`);
}

/** Σύντομη ετικέτα κύριου οπλισμού θεμελίωσης ανά kind. */
export function formatFootingMainLabel(r: FootingReinforcement): string {
  switch (r.kind) {
    case 'pad':
      return `Ø${r.bottomMeshX.diameterMm}/${r.bottomMeshX.spacingMm}`;
    case 'strip':
      return `Ø${r.transverse.diameterMm}/${r.transverse.spacingMm}`;
    case 'tie-beam':
      return `${r.bottom.count}Ø${r.bottom.diameterMm} / ${r.top.count}Ø${r.top.diameterMm}`;
  }
}
