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
import { median } from '../../statistics/median';
import {
  chamferField,
  estimateStrokeWidthPx,
  pickByChamfer,
  probeStrokeCentre,
  registerToInk,
  sampleSegments,
  unitNormal,
  type RegistrationSample,
} from './chamfer-register';
import { residualStats } from './fit-transform';
import { segmentOutcomes, segmentProbe, type SegmentOutcome } from './registration-null-model';
import { measureBalance, measureClutter, parallelSeparationPx } from './registration-quality';
import { shiftNull } from './registration-shift-null';
import type {
  AssessedRegistrationResult,
  EvaluationResiduals,
  InkMask,
  RegisterOptions,
  RegistrationAssessment,
  RegistrationQuality,
  RegistrationSegment,
  RegistrationVerdict,
  RejectionReason,
  SearchDeclaration,
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

/** Βαθμοί μετάθεσης (x, y) — αυτοί που μπορεί να απαριθμήσει ο χονδρός με βήμα. */
const TRANSLATION_DOF = 2;

/**
 * log₁₀ του πλήθους **διακρίσιμων** μετασχηματισμών που μπορεί να φτάσει το ICP από **μία** αρχή και **δεν** απαριθμήθηκαν
 * ήδη: κάθε βαθμός ελευθερίας μετακινεί το σχέδιο το πολύ ±R₀ (πρώτη ακτίνα), με διακριτική ικανότητα r (τελευταία) ⇒
 * 2R₀/r ανά βαθμό. Για τους 2 βαθμούς μετάθεσης, όταν ο χονδρός απαρίθμησε θέσεις με βήμα s (και κάθε θέση μετρά ήδη στις
 * `hypotheses`), το ICP ψάχνει μόνο **μέσα σε ένα κελί** ⇒ min(s, 2R₀)/r.
 * 🔴 **Γιατί χρειάζεται:** με N_tests = 1 και ε = 1, κάθε γεγονός με P < 1 γίνεται δεκτό, μέχρι και πυκνή γραμμοσκίαση
 * (p = 0,99 ⇒ P = 0,99ⁿ < 1). Το ICP δεν δοκιμάζει **μία** θέση, ψάχνει συνεχή χώρο. Συντηρητική απαρίθμηση τύπου
 * Bonferroni, **δική μας παραγωγή** (ADR-929 §6.9 #7), όχι δανεική.
 * 🔴 **§6.9 #19 — η μετάθεση μετριέται ΜΙΑ φορά.** Ως το #18 το (2R₀/r)² προστίθονταν και πάνω σε θέσεις που ήταν ήδη στις
 * `hypotheses`· υπερμέτρηση (2R₀/s)², μετρημένη ανά περίπτωση (log₁₀ 1,56 στο βήμα 8).
 */
export function log10SearchSpace(o: RegisterOptions, translationStepPx: number | null): number {
  const first = o.searchRadiiPx[0] ?? 1;
  const last = o.searchRadiiPx[o.searchRadiiPx.length - 1] ?? 1;
  const reach = 2 * first;
  const perDof = (span: number) => Math.log10(Math.max(1, span / last));
  const translationSpan = translationStepPx === null ? reach : Math.min(translationStepPx, reach);
  return TRANSLATION_DOF * perDof(translationSpan) + (DEGREES_OF_FREEDOM[o.fit.model] - TRANSLATION_DOF) * perDof(reach);
}

/** Έλεγχος της δήλωσης αναζήτησης: λάθος δήλωση ⇒ σφάλμα, ποτέ σιωπηλά λάθος N_tests. */
function assertSearch(search: SearchDeclaration): void {
  const { hypotheses, translationStepPx } = search;
  if (!Number.isInteger(hypotheses) || hypotheses < 1) throw new RangeError(`hypotheses must be an integer ≥ 1, got ${hypotheses}`);
  if (translationStepPx !== null && !(Number.isFinite(translationStepPx) && translationStepPx > 0)) {
    throw new RangeError(`translationStepPx must be null or a finite number > 0, got ${translationStepPx}`);
  }
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
function probeAll(samples: readonly RegistrationSample[], ink: InkMask, t: Affine2x3, radius: number, strokeWidthPx: number): (number | null)[] {
  return samples.map((s) => {
    const n = unitNormal(t, s.seg);
    return n === null ? null : probeStrokeCentre(ink, applyAffine(t, s.p), n, radius, strokeWidthPx);
  });
}

/** Υπόλοιπα με ακτίνα ≫ της τελευταίας του ICP, σε **όλα** τα δείγματα (πυκνά). */
export function evaluateResiduals(
  segments: readonly RegistrationSegment[],
  ink: InkMask,
  t: Affine2x3,
  o: RegisterOptions,
  strokeWidthPx = o.acceptance.evaluationRadiusPx,
): EvaluationResiduals {
  const radiusPx = o.acceptance.evaluationRadiusPx;
  const samples = sampleSegments(segments, t, o);
  const found = probeAll(samples, ink, t, radiusPx, strokeWidthPx).filter((v): v is number => v !== null);
  const near = found.filter((v) => Math.abs(v) > NEAR_RADIUS_FRACTION * radiusPx).length;
  return {
    radiusPx,
    samples: samples.length,
    found: found.length,
    residuals: residualStats(found),
    nearRadiusShare: found.length === 0 ? 0 : near / found.length,
  };
}

/** Ό,τι κρίνεται, μαζεμένο: η ετυμηγορία είναι **καθαρή** συνάρτηση αυτού και των επιλογών. */
interface VerdictInputs {
  readonly log10Nfa: number;
  readonly shiftZ: number | null;
  readonly ambiguityRatio: number | null;
  readonly positionSigmaPx: number | null;
  readonly coverage: number;
  readonly quality: RegistrationQuality;
}

/**
 * Η σειρά είναι η σειρά των ερωτήσεων: «ορίζεται η θέση;» (αβεβαιότητα) → «είναι σύμπτωση;» (NFA τοπικής H0) →
 * «ξεχωρίζει από τους γείτονες;» (PSR) → «είναι μοναδική;» (Lowe) → «πόσο από το σχέδιο;» (κάλυψη) → balance → clutter.
 * Κάθε κατώφλι `null` ⇒ η ερώτηση **μόνο αναφέρεται** (κανένα «με το μάτι», §6.9 #15 βήμα 7).
 */
function verdictOf(v: VerdictInputs, o: RegisterOptions): RegistrationVerdict {
  const a = o.acceptance;
  const reject = (reason: RejectionReason): RegistrationVerdict => ({ kind: 'rejected', reason });
  if (a.maxPositionSigmaPx !== null && v.positionSigmaPx !== null && v.positionSigmaPx > a.maxPositionSigmaPx) return reject('unresolvable');
  if (v.log10Nfa > Math.log10(a.epsilon)) return reject('not-meaningful');
  if (a.minShiftZ !== null && (v.shiftZ === null || v.shiftZ < a.minShiftZ)) return reject('not-distinct');
  if (a.maxAmbiguity !== null && v.ambiguityRatio !== null && v.ambiguityRatio > a.maxAmbiguity) return reject('ambiguous');
  if (v.coverage < a.minCoverage) return reject('low-coverage');
  if (a.minBalance !== null && (v.quality.balance === null || v.quality.balance < a.minBalance)) return reject('degenerate');
  if (a.maxClutter !== null && v.quality.clutter !== null && v.quality.clutter > a.maxClutter) return reject('cluttered');
  return { kind: 'accepted' };
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

/** Ό,τι ξέρει ήδη ο καλών και η αξιολόγηση δεν πρέπει να ξαναμαντέψει. Όλα προαιρετικά. */
export interface AssessContext {
  /** Το πεδίο απόστασης, αν υπολογίστηκε ήδη. */
  readonly field?: Float64Array;
  /** **Όλα** τα τμήματα της αλήθειας για το clutter (προεπιλογή: τα ίδια με την καταγραφή). */
  readonly explain?: readonly RegistrationSegment[];
  /** Το πάχος πινελιάς της καταγραφής (προεπιλογή: δηλωμένο ή μετρημένο στο `transform`). */
  readonly strokeWidthPx?: number;
  /** Λόγος chamfer καλύτερου / δεύτερου διακριτού (από το `pickByChamfer`). */
  readonly ambiguityRatio?: number | null;
  /** Αβεβαιότητα θέσης της προσαρμογής (από το `fitTransform`). */
  readonly positionSigmaPx?: number | null;
}

/** Οι μετρήσεις πέρα από το NFA (clutter · balance · ανάλυση) για μία θέση. */
function qualityOf(
  explain: readonly RegistrationSegment[], outcomes: readonly SegmentOutcome[], ink: InkMask, transform: Affine2x3, radius: number,
): RegistrationQuality {
  return {
    clutter: measureClutter(explain, ink, transform, radius),
    balance: measureBalance(outcomes),
    parallelSeparationPx: parallelSeparationPx(outcomes),
    resolvablePx: 2 * radius + 1,
  };
}

/** Λόγος Lowe από τη χονδρή επιλογή: ∈ [0, 1], 1 ⇒ ο δεύτερος ταιριάζει εξίσου· `null` ⇒ κανένας διακριτός δεύτερος. */
export function ambiguityRatioOf(score: number, runnerUpScore: number | null): number | null {
  if (runnerUpScore === null) return null;
  return runnerUpScore > 0 ? Math.min(1, score / runnerUpScore) : 1;
}

/**
 * **Αξιολόγησε** μια καταγραφή: NFA a-contrario με **τοπική** H0 (μετατόπιση όλου του σχεδίου, §6.9 #15) + PSR + αμφισημία
 * + αβεβαιότητα θέσης + κάλυψη μήκους + balance + clutter + υπόλοιπα χωρίς αποκοπή. `search` = τι απαρίθμησε ο καλών
 * (πλήθος υποθέσεων + βήμα θέσεων), χωρίς προεπιλογή.
 */
export function assessRegistration(
  segments: readonly RegistrationSegment[],
  ink: InkMask,
  transform: Affine2x3,
  search: SearchDeclaration,
  o: RegisterOptions,
  ctx: AssessContext = {},
): RegistrationAssessment {
  assertSearch(search);
  const { hypotheses, translationStepPx } = search;
  const decisionRadiusPx = o.searchRadiiPx[o.searchRadiiPx.length - 1] ?? 1;
  const strokeWidthPx = ctx.strokeWidthPx ?? o.strokeWidthPx ?? estimateStrokeWidthPx(segments, ink, transform, o);
  const outcomes = segmentOutcomes(segments, ink, transform, decisionRadiusPx, o, strokeWidthPx);
  const { evidence, log10Tail, coverage } = segmentLevel(outcomes);
  const local = shiftNull(outcomes, segmentProbe(ink, decisionRadiusPx, strokeWidthPx, o), o);
  const searchSpace = log10SearchSpace(o, translationStepPx);
  const prior = Math.log10(hypotheses) + searchSpace;
  const quality = qualityOf(ctx.explain ?? segments, outcomes, ink, transform, decisionRadiusPx);
  const ambiguityRatio = ctx.ambiguityRatio ?? null;
  const positionSigmaPx = ctx.positionSigmaPx ?? null;
  const log10Nfa = prior + local.log10Tail;
  return {
    verdict: verdictOf({ log10Nfa, shiftZ: local.z, ambiguityRatio, positionSigmaPx, coverage, quality }, o),
    log10Nfa,
    log10NfaGlobal: prior + log10Tail,
    shiftNull: local,
    strokeWidthPx,
    ambiguityRatio,
    positionSigmaPx,
    hypotheses,
    translationStepPx,
    log10SearchSpace: searchSpace,
    decisionRadiusPx,
    segments: evidence,
    inkProbability: inkProbability(ctx.field ?? chamferField(ink), decisionRadiusPx),
    coverage,
    quality,
    evaluation: evaluateResiduals(segments, ink, transform, o, strokeWidthPx),
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
  const search: SearchDeclaration = { hypotheses: candidates.length, translationStepPx: null };
  const assessment = assessRegistration(segments, ink, result.fit.transform, search, o, {
    field,
    explain,
    strokeWidthPx: result.strokeWidthPx,
    ambiguityRatio: ambiguityRatioOf(picked.score, picked.runnerUpScore),
    positionSigmaPx: result.fit.positionSigmaPx,
  });
  return { ...result, assessment, initial: picked.transform };
}
