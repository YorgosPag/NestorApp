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

import type { BindingCandidate, DimensionTarget } from './dimension-binding';
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

/** Ο κάδος του κέντρου μιας ψήφου· μη πεπερασμένος (κενό ή τιμή μηδέν) ⇒ η ψήφος δεν μετρά. */
const centreBin = (gapPx: number, valueMm: number, bin: number): number => Math.round(logScale(gapPx, valueMm) / bin);
const spreadOf = (target: DimensionTarget, bin: number): number => Math.max(1, Math.ceil(target.toleranceRel / bin));

/** Το εύρος κάδων που αγγίζει οποιαδήποτε ψήφος: `[lo, lo + size)`. */
interface BinRange {
  readonly lo: number;
  readonly size: number;
}

function binRange(targets: readonly DimensionTarget[], bin: number): BinRange | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const t of targets) {
    const spread = spreadOf(t, bin);
    for (const c of t.candidates) {
      const centre = centreBin(c.gapPx, t.dimension.valueMm, bin);
      if (!Number.isFinite(centre)) continue;
      lo = Math.min(lo, centre - spread);
      hi = Math.max(hi, centre + spread);
    }
  }
  return lo <= hi ? { lo, size: hi - lo + 1 } : null;
}

/**
 * Οι ψήφοι **μιας** διάστασης (ο καλύτερος πυρήνας ανά κάδο), κανονικοποιημένες ώστε η καλύτερη να είναι 1, προστίθενται
 * στην πυκνότητα. Το `scratch` είναι μηδενικό στην είσοδο και ξαναγίνεται μηδενικό στην έξοδο (μόνο στο εύρος που αγγίχτηκε).
 * 🔑 Πίνακες αντί για `Map` (ADR-929 §6.16 #8: 1 477 ms μετρημένα)· **ίδιο αποτέλεσμα bit προς bit** — ίδια σειρά
 * αθροισμάτων ανά κάδο, ίδιο σύνολο κάδων (μόνο θετικές ψήφοι).
 */
function addVotesOf(target: DimensionTarget, bin: number, range: BinRange, scratch: Float64Array, density: Float64Array): void {
  const spread = spreadOf(target, bin);
  let first = range.size;
  let last = -1;
  let best = 0;
  for (const c of target.candidates) {
    const centre = centreBin(c.gapPx, target.dimension.valueMm, bin);
    if (!Number.isFinite(centre)) continue;
    const k0 = centre - range.lo;
    for (let d = -spread; d <= spread; d++) {
      const vote = c.score * (1 - Math.abs(d) / (spread + 1));
      const k = k0 + d;
      if (vote <= scratch[k]) continue;
      scratch[k] = vote;
      if (vote > best) best = vote;
      if (k < first) first = k;
      if (k > last) last = k;
    }
  }
  for (let k = first; k <= last; k++) {
    if (scratch[k] > 0) density[k] += scratch[k] / best;
    scratch[k] = 0;
  }
}

/** Ο κάδος με τη μεγαλύτερη πυκνότητα· σε ισοβαθμία ο **μικρότερος**. `null` χωρίς καμία θετική ψήφο. */
function modeBin(targets: readonly DimensionTarget[], bin: number): number | null {
  const range = binRange(targets, bin);
  if (range === null) return null;
  const density = new Float64Array(range.size);
  const scratch = new Float64Array(range.size);
  for (const t of targets) addVotesOf(t, bin, range, scratch, density);
  let best = -1;
  let bestValue = 0;
  for (let k = 0; k < range.size; k++) {
    if (density[k] > bestValue) [best, bestValue] = [k, density[k]];
  }
  return best < 0 ? null : best + range.lo;
}

interface Agreement {
  readonly logK: number;
  readonly support: number;
  readonly readingBacked: boolean;
}

/** Η δέση με το μεγαλύτερο σκορ μέσα στην ανοχή γύρω από το `logK`· σε ισοβαθμία η **πρώτη** (όπως η σταθερή ταξινόμηση). */
function bestAgreeing(t: DimensionTarget, logK: number): BindingCandidate | undefined {
  let best: BindingCandidate | undefined;
  for (const c of t.candidates) {
    if (!(Math.abs(logScale(c.gapPx, t.dimension.valueMm) - logK) <= t.toleranceRel)) continue;
    if (best === undefined || c.score > best.score) best = c;
  }
  return best;
}

/** Ο σταθμισμένος μέσος της καλύτερης συμφωνούσας δέσης κάθε διάστασης γύρω από το `logK`. */
function agreeAround(targets: readonly DimensionTarget[], logK: number): Agreement {
  let sum = 0;
  let weight = 0;
  let support = 0;
  let readingBacked = false;
  for (const t of targets) {
    const best = bestAgreeing(t, logK);
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
