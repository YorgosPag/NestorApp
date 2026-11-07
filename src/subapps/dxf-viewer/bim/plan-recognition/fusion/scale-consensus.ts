/**
 * ADR-929 Φ4 · Δ4 #1 — **κλίμακα με συναίνεση**: ποια κλίμακα κάνει τις **περισσότερες** γραμμένες διαστάσεις να ταιριάζουν
 * σε κάποιο ζεύγος παρειών;
 *
 * 🔑 Κάθε υποψήφια δέση ψηφίζει `k = απόσταση / τιμή` (px ανά mm). Μία διάσταση μόνη της δεν λέει τίποτα (κάποιο ζεύγος
 * ταιριάζει πάντα σε κάποια κλίμακα)· **πολλές** διαστάσεις που συμφωνούν στην ίδια `k` είναι ισχυρή απόδειξη. Είναι το
 * σχήμα Hough/RANSAC πάνω σε **έναν** άγνωστο, άρα εξαντλητικό και ντετερμινιστικό: ιστόγραμμα σε **λογαριθμικό** χώρο
 * (η σχετική ανοχή γίνεται σταθερό πλάτος), όπου κάθε διάσταση δίνει **το πολύ μία ψήφο** ανά κάδο.
 * 🔑 Το πλάτος του πυρήνα κάθε ψήφου είναι η **δική της** ανοχή: ένα σκίτσο ψηφίζει «θολά», μια σάρωση «καθαρά».
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/fusion/scale-consensus
 */

import type { DimensionTarget } from './dimension-binding';
import type { PlanFusionOptions } from './plan-fusion-types';

export interface ScaleConsensus {
  /** Ευθυγραμμισμένα px ανά mm. */
  readonly pxPerMm: number;
  /** Πόσες διαστάσεις συμφωνούν. */
  readonly support: number;
}

/**
 * Λιγότερες από τόσες διαστάσεις δεν αποδεικνύουν κλίμακα, εκτός αν τη μόνη δέση τη στηρίζει **και** η ανάγνωση ή (ADR-929
 * Φ5.5) οι **γραμμές επέκτασης**: τότε το «ποιο ζεύγος» δεν είναι εικασία, μένει μόνο η τιμή.
 */
const MIN_SUPPORT = 2;
const REFINE_PASSES = 2;

const logScale = (gapPx: number, valueMm: number): number => Math.log(gapPx / valueMm);

/** Οι ψήφοι **μιας** διάστασης ανά κάδο, κανονικοποιημένες ώστε η καλύτερη να είναι 1. */
function votesOf(target: DimensionTarget, bin: number): Map<number, number> {
  const local = new Map<number, number>();
  const spread = Math.max(1, Math.ceil(target.toleranceRel / bin));
  for (const c of target.candidates) {
    const centre = Math.round(logScale(c.gapPx, target.dimension.valueMm) / bin);
    for (let j = centre - spread; j <= centre + spread; j++) {
      const vote = c.score * (1 - Math.abs(j - centre) / (spread + 1));
      if (vote > (local.get(j) ?? 0)) local.set(j, vote);
    }
  }
  const best = Math.max(0, ...local.values());
  if (best > 0) for (const [j, v] of local) local.set(j, v / best);
  return local;
}

function modeBin(targets: readonly DimensionTarget[], bin: number): number | null {
  const density = new Map<number, number>();
  for (const t of targets) for (const [j, v] of votesOf(t, bin)) density.set(j, (density.get(j) ?? 0) + v);
  let best: number | null = null;
  let bestValue = 0;
  for (const [j, v] of density) {
    if (v > bestValue || (v === bestValue && best !== null && j < best)) [best, bestValue] = [j, v];
  }
  return best;
}

interface Agreement {
  readonly logK: number;
  readonly support: number;
  readonly readingBacked: boolean;
}

/** Ο σταθμισμένος μέσος της καλύτερης συμφωνούσας δέσης κάθε διάστασης γύρω από το `logK`. */
function agreeAround(targets: readonly DimensionTarget[], logK: number): Agreement {
  let sum = 0;
  let weight = 0;
  let support = 0;
  let readingBacked = false;
  for (const t of targets) {
    const best = t.candidates
      .filter((c) => Math.abs(logScale(c.gapPx, t.dimension.valueMm) - logK) <= t.toleranceRel)
      .sort((a, b) => b.score - a.score)[0];
    if (!best) continue;
    const w = 1 / (t.toleranceRel * t.toleranceRel);
    sum += w * logScale(best.gapPx, t.dimension.valueMm);
    weight += w;
    support += 1;
    readingBacked ||= best.readingHits === 2 || best.extensionHits === 2;
  }
  return { logK: weight > 0 ? sum / weight : logK, support, readingBacked };
}

/** Η κλίμακα που στηρίζουν οι γραμμένες διαστάσεις, ή `null` όταν δεν αποδεικνύεται. */
export function dimensionScaleConsensus(targets: readonly DimensionTarget[], o: PlanFusionOptions): ScaleConsensus | null {
  const bin = Math.log1p(o.scaleBinRel);
  const mode = modeBin(targets, bin);
  if (mode === null) return null;
  let agreement: Agreement = { logK: mode * bin, support: 0, readingBacked: false };
  for (let pass = 0; pass < REFINE_PASSES; pass++) agreement = agreeAround(targets, agreement.logK);
  const proven = agreement.support >= MIN_SUPPORT || (agreement.support === 1 && agreement.readingBacked);
  return proven ? { pxPerMm: Math.exp(agreement.logK), support: agreement.support } : null;
}
