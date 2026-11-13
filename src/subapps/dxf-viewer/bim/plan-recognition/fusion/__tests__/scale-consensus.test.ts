/**
 * ADR-929 §6.16 #8 — η κλίμακα με συναίνεση σε πίνακες (`Float64Array`) αντί για `Map` πρέπει να δίνει **ΤΟ ΙΔΙΟ
 * αποτέλεσμα, bit προς bit**, με την προηγούμενη υλοποίηση. Το μαντείο παρακάτω είναι η προηγούμενη υλοποίηση αυτούσια
 * (ζούσε στο `scale-consensus.ts` ως το `c18226b9`): ό,τι κι αν αλλάξει στη γρήγορη, η ερώτηση μένει «ίδια απάντηση;».
 */

import { textAt, dimensionOf } from './fusion-fixture';
import { DEFAULT_PLAN_FUSION, type FaceLine, type PlanFusionOptions } from '../plan-fusion-types';
import type { BindingCandidate, DimensionTarget } from '../dimension-binding';
import { dimensionScaleConsensus, type ScaleConsensus } from '../scale-consensus';

// ─── Μαντείο: η προηγούμενη υλοποίηση, αυτούσια ────────────────────────────────

const oracleLog = (gapPx: number, valueMm: number): number => Math.log(gapPx / valueMm);

function oracleVotesOf(target: DimensionTarget, bin: number): Map<number, number> {
  const local = new Map<number, number>();
  const spread = Math.max(1, Math.ceil(target.toleranceRel / bin));
  for (const c of target.candidates) {
    const centre = Math.round(oracleLog(c.gapPx, target.dimension.valueMm) / bin);
    for (let j = centre - spread; j <= centre + spread; j++) {
      const vote = c.score * (1 - Math.abs(j - centre) / (spread + 1));
      if (vote > (local.get(j) ?? 0)) local.set(j, vote);
    }
  }
  const best = Math.max(0, ...local.values());
  if (best > 0) for (const [j, v] of local) local.set(j, v / best);
  return local;
}

function oracleModeBin(targets: readonly DimensionTarget[], bin: number): number | null {
  const density = new Map<number, number>();
  for (const t of targets) for (const [j, v] of oracleVotesOf(t, bin)) density.set(j, (density.get(j) ?? 0) + v);
  let best: number | null = null;
  let bestValue = 0;
  for (const [j, v] of density) {
    if (v > bestValue || (v === bestValue && best !== null && j < best)) [best, bestValue] = [j, v];
  }
  return best;
}

function oracleAgree(targets: readonly DimensionTarget[], logK: number) {
  let sum = 0;
  let weight = 0;
  let support = 0;
  let readingBacked = false;
  for (const t of targets) {
    const best = t.candidates
      .filter((c) => Math.abs(oracleLog(c.gapPx, t.dimension.valueMm) - logK) <= t.toleranceRel)
      .sort((a, b) => b.score - a.score)[0];
    if (!best) continue;
    const w = 1 / (t.toleranceRel * t.toleranceRel);
    sum += w * oracleLog(best.gapPx, t.dimension.valueMm);
    weight += w;
    support += 1;
    readingBacked ||= best.readingHits === 2 || best.extensionHits === 2;
  }
  return { logK: weight > 0 ? sum / weight : logK, support, readingBacked };
}

function oracle(targets: readonly DimensionTarget[], o: PlanFusionOptions): ScaleConsensus | null {
  const bin = Math.log1p(o.scaleBinRel);
  const mode = oracleModeBin(targets, bin);
  if (mode === null) return null;
  let agreement = { logK: mode * bin, support: 0, readingBacked: false };
  for (let pass = 0; pass < 2; pass++) agreement = oracleAgree(targets, agreement.logK);
  const proven = agreement.support >= 2 || (agreement.support === 1 && agreement.readingBacked);
  return proven ? { pxPerMm: Math.exp(agreement.logK), support: agreement.support } : null;
}

// ─── Γεννήτορας ───────────────────────────────────────────────────────────────

/** mulberry32: ντετερμινιστικό, ώστε κάθε αποτυχία να αναπαράγεται από τον σπόρο της. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const line = (id: string, offsetPx: number): FaceLine => ({ id, familyId: 0, offsetPx, extentMinPx: 0, extentMaxPx: 1, segmentIds: [] });

function candidate(gapPx: number, score: number, hits: 0 | 1 | 2): BindingCandidate {
  return { lineA: line('a', 0), lineB: line('b', gapPx), gapPx, score, centring: 1, readingHits: hits, extensionHits: 0 };
}

function target(id: string, valueMm: number, toleranceRel: number, candidates: readonly BindingCandidate[]): DimensionTarget {
  return { dimension: dimensionOf(id, valueMm), text: textAt(id, String(valueMm), 0, 0, 'h'), precisionMm: 10, sigmaMm: 5, toleranceRel, candidates };
}

/** Ένα σχέδιο με αληθινή κλίμακα `k` (px/mm): οι σωστές δέσεις κοντά στο `k`, πολλές λάθος σε τυχαίες κλίμακες. */
function randomPlan(seed: number): DimensionTarget[] {
  const r = rng(seed);
  const k = 0.02 + r() * 0.2;
  const quantised = (x: number) => Math.round(x * 4) / 4; // ισοβαθμίες σκορ, επίτηδες
  return Array.from({ length: 5 + Math.floor(r() * 40) }, (_, i) => {
    const valueMm = 300 + Math.round(r() * 9000);
    const toleranceRel = 0.01 + r() * 0.08;
    const truth = candidate(valueMm * k * (1 + (r() - 0.5) * toleranceRel), quantised(0.2 + r()), r() < 0.2 ? 2 : 0);
    const decoys = Array.from({ length: Math.floor(r() * 60) }, () => candidate(5 + r() * 2000, quantised(r()), 0));
    return target(`t${i}`, valueMm, toleranceRel, r() < 0.15 ? decoys : [...decoys, truth]);
  });
}

// ─── Άγκυρες ──────────────────────────────────────────────────────────────────

describe('dimensionScaleConsensus — ίδιο αποτέλεσμα με την υλοποίηση σε Map (bit προς bit)', () => {
  it.each(Array.from({ length: 200 }, (_, seed) => seed))('σπόρος %i', (seed) => {
    const targets = randomPlan(seed);
    expect(dimensionScaleConsensus(targets, DEFAULT_PLAN_FUSION)).toStrictEqual(oracle(targets, DEFAULT_PLAN_FUSION));
  });

  it('χωρίς διαστάσεις ή χωρίς υποψήφιες ⇒ null, όπως πριν', () => {
    expect(dimensionScaleConsensus([], DEFAULT_PLAN_FUSION)).toBeNull();
    const empty = [target('e', 1000, 0.05, [])];
    expect(dimensionScaleConsensus(empty, DEFAULT_PLAN_FUSION)).toStrictEqual(oracle(empty, DEFAULT_PLAN_FUSION));
  });

  it('ισοβαθμία πυκνότητας ⇒ ο μικρότερος κάδος, όπως πριν', () => {
    // Δύο μεμονωμένες δέσεις στηριγμένες από την ανάγνωση: η καθεμία «αποδεικνύει» μόνη της ⇒ ο κάδος φαίνεται στο αποτέλεσμα.
    const tie = [target('a', 1000, 0.02, [candidate(50, 1, 2)]), target('b', 1000, 0.02, [candidate(100, 1, 2)])];
    const result = dimensionScaleConsensus(tie, DEFAULT_PLAN_FUSION);
    expect(result).toStrictEqual(oracle(tie, DEFAULT_PLAN_FUSION));
    expect(result?.pxPerMm).toBeCloseTo(0.05, 6);
  });

  it('ίσο σκορ στη συμφωνία ⇒ η πρώτη υποψήφια (σταθερή ταξινόμηση), όπως πριν', () => {
    const same = [
      target('a', 1000, 0.05, [candidate(50, 1, 0), candidate(50.5, 1, 2)]),
      target('b', 2000, 0.05, [candidate(100.4, 1, 2), candidate(100, 1, 0)]),
    ];
    expect(dimensionScaleConsensus(same, DEFAULT_PLAN_FUSION)).toStrictEqual(oracle(same, DEFAULT_PLAN_FUSION));
  });
});
