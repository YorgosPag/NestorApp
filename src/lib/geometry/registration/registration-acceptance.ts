/**
 * @fileoverview **ΑΠΟΔΟΧΗ ΚΑΤΑΓΡΑΦΗΣ CAD → ΜΕΛΑΝΙ** (SSoT, ADR-929 §6.9 #7): κριτήριο a-contrario + κάλυψη, και υπόλοιπα
 * που **δεν** κόβονται από την ακτίνα του ICP.
 * @module lib/geometry/registration/registration-acceptance
 *
 * 🔴 **Γιατί υπάρχει.** Το «p95 ≤ 2 px» πέρασε σε **τυχαίο** μελάνι (κάλυψη 0,045): ο τελευταίος γύρος του ICP βρίσκει
 * κέντρο πινελιάς μόνο μέσα στα ±3 px, άρα κάθε υπόλοιπο είναι εξ ορισμού < 3 px (§6.9 #6). Ένα κατώφλι πάνω σε κομμένη
 * ποσότητα δεν μετρά τίποτα.
 *
 * 🔑 **Μηδενική υπόθεση H0** (Desolneux–Moisan–Morel): «το σχέδιο κάθεται σε τυχαία θέση». Τότε κάθε ανεξάρτητο δείγμα
 * βρίσκει μελάνι με πιθανότητα το πολύ p = ποσοστό των pixel της εικόνας κοντά σε μελάνι. Η καταγραφή δέχεται αν
 * NFA = N_tests · P[B(n, p) ≥ k] ≤ ε. Η p βγαίνει από **την ίδια την εικόνα**: πυκνή γραμμοσκίαση ή σχέδιο που έγινε
 * κουκκίδα πάνω σε γεμάτο μελάνι ⇒ p → 1 ⇒ καμία καταγραφή δεν είναι σημαντική. Καμία σταθερά να ρυθμιστεί.
 * 🔑 **Ανεξαρτησία, τίμια.** Τα δείγματα του ICP απέχουν 6 px και τα παράθυρά τους (±3 px) σχεδόν αγγίζονται. Εδώ το
 * βήμα είναι ≥ 2·ακτίνα, ώστε κανένα pixel να μη μετρά σε δύο δοκιμές.
 * 🔑 **N_tests = αρχές × χώρος αναζήτησης.** Το πλήθος αρχών είναι υποχρεωτικό όρισμα: όποιος δοκίμασε 96 και δηλώνει 1
 * κάνει snooping (το NFA φράζει τον **αναμενόμενο αριθμό** ψευδών αποδοχών σε όλες τις δοκιμές). Ο χώρος που ψάχνει το
 * ICP από κάθε αρχή μπαίνει από μόνος του ({@link log10SearchSpace}).
 *
 * 📐 Desolneux, Moisan & Morel, «From Gestalt Theory to Image Analysis» (2008) · Grompone von Gioi et al., LSD (2010) ·
 * Moisan & Stival, IJCV 57(3) 2004 (a-contrario για αντιστοιχίες).
 */

import { applyAffine, type Affine2x3 } from '../affine-2x3';
import { log10BinomialTail } from '../../statistics/log-binomial-tail';
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
import type {
  AssessedRegistrationResult,
  EvaluationResiduals,
  InkMask,
  RegisterOptions,
  RegistrationAssessment,
  RegistrationSegment,
  RegistrationVerdict,
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

function verdictOf(log10Nfa: number, coverage: number, o: RegisterOptions): RegistrationVerdict {
  if (log10Nfa > Math.log10(o.acceptance.epsilon)) return { kind: 'rejected', reason: 'not-meaningful' };
  if (coverage < o.acceptance.minCoverage) return { kind: 'rejected', reason: 'low-coverage' };
  return { kind: 'accepted' };
}

/**
 * **Αξιολόγησε** μια καταγραφή: NFA a-contrario + κάλυψη ανεξάρτητων δειγμάτων + υπόλοιπα χωρίς αποκοπή.
 * `hypotheses` = πόσες αρχικές υποθέσεις δοκιμάστηκαν **συνολικά** για αυτό το ζεύγος (≥ 1, χωρίς προεπιλογή).
 */
export function assessRegistration(
  segments: readonly RegistrationSegment[],
  ink: InkMask,
  transform: Affine2x3,
  hypotheses: number,
  o: RegisterOptions,
  field: Float64Array = chamferField(ink),
): RegistrationAssessment {
  if (!Number.isInteger(hypotheses) || hypotheses < 1) throw new RangeError(`hypotheses must be an integer ≥ 1, got ${hypotheses}`);
  const decisionRadiusPx = o.searchRadiiPx[o.searchRadiiPx.length - 1] ?? 1;
  const step = Math.max(o.sampleStepPx, 2 * decisionRadiusPx);
  const independent = sampleSegments(segments, transform, { ...o, sampleStepPx: step });
  const hits = probeAll(independent, ink, transform, decisionRadiusPx).filter((v) => v !== null).length;
  const p = inkProbability(field, decisionRadiusPx);
  const searchSpace = log10SearchSpace(o);
  const log10Nfa = Math.log10(hypotheses) + searchSpace + log10BinomialTail(independent.length, hits, p);
  const coverage = independent.length === 0 ? 0 : hits / independent.length;
  return {
    verdict: verdictOf(log10Nfa, coverage, o),
    log10Nfa,
    hypotheses,
    log10SearchSpace: searchSpace,
    decisionRadiusPx,
    independentSamples: independent.length,
    hits,
    inkProbability: p,
    coverage,
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
): AssessedRegistrationResult {
  const field = chamferField(ink);
  const picked = pickByChamfer(segments, ink, candidates, o, field);
  if (picked === null) return { kind: 'not-converged', reason: 'no-candidates', round: 0 };
  const result = registerToInk(segments, ink, picked.transform, o);
  if (result.kind === 'not-converged') return result;
  const assessment = assessRegistration(segments, ink, result.fit.transform, candidates.length, o, field);
  return { ...result, assessment, initial: picked.transform };
}
