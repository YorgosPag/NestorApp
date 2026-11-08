/**
 * @fileoverview **ΑΠΟΔΟΧΗ ΚΑΤΑΓΡΑΦΗΣ CAD → ΜΕΛΑΝΙ** (SSoT, ADR-929 §6.9 #7): κριτήριο a-contrario + κάλυψη, και υπόλοιπα
 * που **δεν** κόβονται από την ακτίνα του ICP.
 * @module lib/geometry/registration/registration-acceptance
 *
 * 🔴 **Γιατί υπάρχει.** Το «p95 ≤ 2 px» πέρασε σε **τυχαίο** μελάνι (κάλυψη 0,045): ο τελευταίος γύρος του ICP βρίσκει
 * κέντρο πινελιάς μόνο μέσα στα ±3 px, άρα κάθε υπόλοιπο είναι εξ ορισμού < 3 px (§6.9 #6). Ένα κατώφλι πάνω σε κομμένη
 * ποσότητα δεν μετρά τίποτα.
 *
 * 🔑 **Μηδενική υπόθεση H0** (Desolneux–Moisan–Morel): «το σχέδιο κάθεται σε τυχαία θέση». Η καταγραφή δέχεται αν
 * NFA = N_tests · P[X ≥ k] ≤ ε, X = Σ Bernoulli(pᵢ) πάνω στα **τμήματα** (Poisson-binomial).
 * 🔴 **§6.9 #9 — μονάδα τμήμα, p εμπειρικό** ({@link segmentOutcomes}). Ως το #8 η μονάδα ήταν το **δείγμα** με
 * p = πυκνότητα μελανιού: τα δείγματα ενός τοίχου όμως δεν είναι ανεξάρτητα, και λάθος κατόψεις βγήκαν log₁₀NFA −700.
 * 🔑 **Πέρα από το NFA** ({@link measureClutter} · {@link measureBalance} · {@link parallelSeparationPx}): clutter
 * (Cognex PatMax / MVTec HALCON), balance (Autodesk ReCap) και ανάλυση. Τα κατώφλια των δύο πρώτων βαθμονομούνται σε
 * λάθος ζεύγη· ως τότε `null` ⇒ μόνο αναφορά.
 * 🔑 **N_tests = αρχές × χώρος αναζήτησης.** Το πλήθος αρχών είναι υποχρεωτικό όρισμα: όποιος δοκίμασε 96 και δηλώνει 1
 * κάνει snooping (το NFA φράζει τον **αναμενόμενο αριθμό** ψευδών αποδοχών σε όλες τις δοκιμές). Ο χώρος που ψάχνει το
 * ICP από κάθε αρχή μπαίνει από μόνος του ({@link log10SearchSpace}).
 *
 * 📐 Desolneux, Moisan & Morel, «From Gestalt Theory to Image Analysis» (2008) · Grompone von Gioi et al., LSD (2010) ·
 * Moisan & Stival, IJCV 57(3) 2004 (a-contrario για αντιστοιχίες).
 */

import { applyAffine, type Affine2x3 } from '../affine-2x3';
import { log10PoissonBinomialTail } from '../../statistics/log-binomial-tail';
import {
  chamferField,
  pickByChamfer,
  probeStrokeCentre,
  registerToInk,
  sampleSegments,
  unitNormal,
  type RegistrationSample,
} from './chamfer-register';
import { residualStats } from './fit-transform';
import { segmentOutcomes, type SegmentOutcome } from './registration-null-model';
import { measureBalance, measureClutter, parallelSeparationPx } from './registration-quality';
import type {
  AssessedRegistrationResult,
  EvaluationResiduals,
  InkMask,
  RegisterOptions,
  RegistrationAssessment,
  RegistrationQuality,
  RegistrationSegment,
  RegistrationVerdict,
  SegmentEvidence,
} from './registration-types';

/**
 * Το δείγμα είναι συνεχές σημείο, το πεδίο απόστασης μετρά από κέντρα pixel: η απόσταση του δείγματος από το μελάνι
 * διαφέρει το πολύ κατά μισή διαγώνιο. Προστίθεται, ώστε η p να μένει **άνω** φράγμα.
 */
const HALF_PIXEL_DIAGONAL = Math.SQRT2 / 2;

/** Υπόλοιπο πάνω από αυτό το κλάσμα της ακτίνας ⇒ «κοντά στο όριο» (πιθανώς κομμένο). */
const NEAR_RADIUS_FRACTION = 0.8;

const DEGREES_OF_FREEDOM = { similarity: 4, affine: 6 } as const;

/**
 * log₁₀ του πλήθους **διακρίσιμων** μετασχηματισμών που μπορεί να φτάσει το ICP από **μία** αρχή: κάθε βαθμός ελευθερίας
 * μετακινεί το σχέδιο το πολύ ±R₀ (πρώτη ακτίνα), με διακριτική ικανότητα r (τελευταία) ⇒ (2R₀/r)^βε.
 * 🔴 **Γιατί χρειάζεται:** με N_tests = 1 και ε = 1, κάθε γεγονός με P < 1 γίνεται δεκτό, μέχρι και πυκνή γραμμοσκίαση
 * (p = 0,99 ⇒ P = 0,99ⁿ < 1). Το ICP δεν δοκιμάζει **μία** θέση, ψάχνει συνεχή χώρο. Συντηρητική απαρίθμηση τύπου
 * Bonferroni, **δική μας παραγωγή** (ADR-929 §6.9 #7), όχι δανεική.
 */
export function log10SearchSpace(o: RegisterOptions): number {
  const first = o.searchRadiiPx[0] ?? 1;
  const last = o.searchRadiiPx[o.searchRadiiPx.length - 1] ?? 1;
  return DEGREES_OF_FREEDOM[o.fit.model] * Math.log10(Math.max(1, (2 * first) / last));
}

/** p υπό H0: ποσοστό των pixel της εικόνας σε απόσταση ≤ r (+ μισή διαγώνιο) από μελάνι. */
export function inkProbability(field: Float64Array, radiusPx: number): number {
  if (field.length === 0) return 1;
  const limit = radiusPx + HALF_PIXEL_DIAGONAL;
  let near = 0;
  for (const d of field) if (d <= limit) near++;
  return near / field.length;
}

/** Το υπόλοιπο (px, προσημασμένο) κάθε δείγματος κάτω από το `t`, ή `null` όταν δεν βρέθηκε πινελιά μέσα στο `radius`. */
function probeAll(samples: readonly RegistrationSample[], ink: InkMask, t: Affine2x3, radius: number): (number | null)[] {
  return samples.map((s) => {
    const n = unitNormal(t, s.seg);
    return n === null ? null : probeStrokeCentre(ink, applyAffine(t, s.p), n, radius);
  });
}

/** Υπόλοιπα με ακτίνα ≫ της τελευταίας του ICP, σε **όλα** τα δείγματα (πυκνά). */
export function evaluateResiduals(
  segments: readonly RegistrationSegment[],
  ink: InkMask,
  t: Affine2x3,
  o: RegisterOptions,
): EvaluationResiduals {
  const radiusPx = o.acceptance.evaluationRadiusPx;
  const samples = sampleSegments(segments, t, o);
  const found = probeAll(samples, ink, t, radiusPx).filter((v): v is number => v !== null);
  const near = found.filter((v) => Math.abs(v) > NEAR_RADIUS_FRACTION * radiusPx).length;
  return {
    radiusPx,
    samples: samples.length,
    found: found.length,
    residuals: residualStats(found),
    nearRadiusShare: found.length === 0 ? 0 : near / found.length,
  };
}

/**
 * Η σειρά είναι η σειρά των ερωτήσεων: πρώτα «μπορεί καν να κριθεί;» (ανάλυση), μετά «είναι σύμπτωση;» (NFA), μετά «πόσο
 * από το σχέδιο;» (κάλυψη), μετά «ορίζεται η θέση;» (balance), τέλος «εξηγεί το μελάνι;» (clutter).
 */
function verdictOf(log10Nfa: number, coverage: number, q: RegistrationQuality, o: RegisterOptions): RegistrationVerdict {
  const a = o.acceptance;
  if (q.parallelSeparationPx !== null && q.parallelSeparationPx < q.resolvablePx) return { kind: 'rejected', reason: 'unresolvable' };
  if (log10Nfa > Math.log10(a.epsilon)) return { kind: 'rejected', reason: 'not-meaningful' };
  if (coverage < a.minCoverage) return { kind: 'rejected', reason: 'low-coverage' };
  if (a.minBalance !== null && (q.balance === null || q.balance < a.minBalance)) return { kind: 'rejected', reason: 'degenerate' };
  if (a.maxClutter !== null && q.clutter !== null && q.clutter > a.maxClutter) return { kind: 'rejected', reason: 'cluttered' };
  return { kind: 'accepted' };
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** NFA + κάλυψη σε επίπεδο **τμήματος** (§6.9 #9). */
function segmentLevel(outcomes: readonly SegmentOutcome[]): { evidence: SegmentEvidence; log10Tail: number; coverage: number } {
  const ps = outcomes.map((x) => x.p);
  const hits = outcomes.filter((x) => x.hit);
  const total = outcomes.reduce((s, x) => s + x.segment.lengthPx, 0);
  const hitLength = hits.reduce((s, x) => s + x.segment.lengthPx, 0);
  return {
    evidence: { segments: outcomes.length, hits: hits.length, pMedian: median(ps), pMax: ps.length === 0 ? 0 : Math.max(...ps) },
    log10Tail: log10PoissonBinomialTail(ps, hits.length),
    coverage: total > 0 ? hitLength / total : 0,
  };
}

/**
 * **Αξιολόγησε** μια καταγραφή: NFA a-contrario ανά τμήμα (εμπειρική H0) + κάλυψη μήκους + ανάλυση + balance + clutter +
 * υπόλοιπα χωρίς αποκοπή. `hypotheses` = πόσες αρχικές υποθέσεις δοκιμάστηκαν **συνολικά** (≥ 1, χωρίς προεπιλογή).
 * `explain` = **όλα** τα τμήματα της αλήθειας για το clutter (προεπιλογή: τα ίδια με την καταγραφή).
 */
export function assessRegistration(
  segments: readonly RegistrationSegment[],
  ink: InkMask,
  transform: Affine2x3,
  hypotheses: number,
  o: RegisterOptions,
  field: Float64Array = chamferField(ink),
  explain: readonly RegistrationSegment[] = segments,
): RegistrationAssessment {
  if (!Number.isInteger(hypotheses) || hypotheses < 1) throw new RangeError(`hypotheses must be an integer ≥ 1, got ${hypotheses}`);
  const decisionRadiusPx = o.searchRadiiPx[o.searchRadiiPx.length - 1] ?? 1;
  const outcomes = segmentOutcomes(segments, ink, transform, decisionRadiusPx, o);
  const { evidence, log10Tail, coverage } = segmentLevel(outcomes);
  const searchSpace = log10SearchSpace(o);
  const log10Nfa = Math.log10(hypotheses) + searchSpace + log10Tail;
  const quality: RegistrationQuality = {
    clutter: measureClutter(explain, ink, transform, decisionRadiusPx),
    balance: measureBalance(outcomes),
    parallelSeparationPx: parallelSeparationPx(outcomes),
    resolvablePx: 2 * decisionRadiusPx + 1,
  };
  return {
    verdict: verdictOf(log10Nfa, coverage, quality, o),
    log10Nfa,
    hypotheses,
    log10SearchSpace: searchSpace,
    decisionRadiusPx,
    segments: evidence,
    inkProbability: inkProbability(field, decisionRadiusPx),
    coverage,
    quality,
    evaluation: evaluateResiduals(segments, ink, transform, o),
  };
}

/**
 * Ο **ένας** δρόμος με ετυμηγορία: χονδρή επιλογή chamfer ανάμεσα στους δηλωμένους υποψηφίους → ICP → αξιολόγηση με
 * N_tests = πλήθος υποψηφίων. Το πεδίο απόστασης υπολογίζεται **μία** φορά.
 */
export function registerAndAssess(
  segments: readonly RegistrationSegment[],
  ink: InkMask,
  candidates: readonly Affine2x3[],
  o: RegisterOptions,
  explain: readonly RegistrationSegment[] = segments,
): AssessedRegistrationResult {
  const field = chamferField(ink);
  const picked = pickByChamfer(segments, ink, candidates, o, field);
  if (picked === null) return { kind: 'not-converged', reason: 'no-candidates', round: 0 };
  const result = registerToInk(segments, ink, picked.transform, o);
  if (result.kind === 'not-converged') return result;
  const assessment = assessRegistration(segments, ink, result.fit.transform, candidates.length, o, field, explain);
  return { ...result, assessment, initial: picked.transform };
}
