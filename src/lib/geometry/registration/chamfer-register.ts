/**
 * @fileoverview **ΚΑΤΑΓΡΑΦΗ CAD → ΜΕΛΑΝΙ** (SSoT, ADR-929 §6.9): χονδρή επιλογή με απόσταση chamfer, λεπτή με ICP
 * σημείου-προς-γραμμή και ακτίνα που στενεύει, τελικός γύρος με data snooping Baarda.
 * @module lib/geometry/registration/chamfer-register
 *
 * 🔑 **Κέντρο πινελιάς, όχι άκρη.** Κατά μήκος της καθέτου βρίσκονται οι **συνεχείς διαδρομές** μελανιού και κρατιέται το
 * **μέσο** της πλησιέστερης. Μια πινελιά 3 px δίνει έτσι το κέντρο της, όχι μεροληψία 1,5 px προς τη μεριά του δείγματος.
 * 🔑 **Αμφίσημο ⇒ καμία παρατήρηση.** Διαδρομή που ακουμπά το όριο αναζήτησης (κομμένη, άρα λάθος μέσο) ή που είναι πιο
 * μακριά από την ακτίνα (γεμάτη επιφάνεια, π.χ. γραμμοσκίαση) **δεν** δίνει αντιστοιχία. Καλύτερα λιγότερες και σωστές.
 * 🔑 **Χονδρή αρχή = δηλωμένη, ποτέ μαντεμένη.** Ο καλών δίνει υποψήφιους αρχικούς μετασχηματισμούς (κλίμακα εκτύπωσης,
 * βαθμονόμηση, 2 σημεία)· η απόσταση chamfer διαλέγει τον καλύτερο. Χωρίς σύγκλιση ⇒ `not-converged` με λόγο.
 *
 * 📐 Barrow et al. 1977 (chamfer matching) · Borgefors 1988 (ιεραρχικό chamfer) · Chen & Medioni 1992 (point-to-plane ICP).
 */

import { applyAffine, invertAffine, type Affine2x3, type AffinePoint } from '../affine-2x3';
import { median } from '../../statistics/median';
import { quantile } from '../../market/market-statistics';
import { squaredDistanceTransform } from '../raster/distance-transform';
import { inkThicknessAcross } from '../raster/ink-probe';
import { fitTransform } from './fit-transform';
import type {
  FitOptions,
  InkMask,
  LineCorrespondence,
  RegisterOptions,
  RegistrationResult,
  RegistrationSegment,
} from './registration-types';

/** Βήμα δειγματοληψίας κατά μήκος της καθέτου (px). */
const PROBE_STEP_PX = 0.5;

/** Δείγμα: σημείο σχεδίου + το τμήμα του (για την κάθετο στον τρέχοντα μετασχηματισμό). */
export interface RegistrationSample {
  readonly p: AffinePoint;
  readonly seg: RegistrationSegment;
}

/** Δείγματα κατά μήκος των τμημάτων, πυκνότητα **στην εικόνα** του `t`· ντετερμινιστική αραίωση στο `maxSamples`. */
export function sampleSegments(segments: readonly RegistrationSegment[], t: Affine2x3, o: RegisterOptions): RegistrationSample[] {
  const all: RegistrationSample[] = [];
  for (const seg of segments) {
    const qa = applyAffine(t, seg.a);
    const qb = applyAffine(t, seg.b);
    const len = Math.hypot(qb.x - qa.x, qb.y - qa.y);
    if (len < o.minSegmentPx) continue;
    const n = Math.max(1, Math.floor(len / o.sampleStepPx));
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      all.push({ p: { x: seg.a.x + k * (seg.b.x - seg.a.x), y: seg.a.y + k * (seg.b.y - seg.a.y) }, seg });
    }
  }
  if (all.length <= o.maxSamples) return all;
  const stride = all.length / o.maxSamples;
  return Array.from({ length: o.maxSamples }, (_, i) => all[Math.floor(i * stride)]);
}

function isInk(ink: InkMask, x: number, y: number): boolean {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  return ix >= 0 && iy >= 0 && ix < ink.width && iy < ink.height && ink.mask[iy * ink.width + ix] === 1;
}

/**
 * Η θέση (κατά μήκος της καθέτου, px) του **μέσου** της πλησιέστερης διαδρομής μελανιού με κέντρο μέσα στο `±radius`, ή
 * `null` όταν δεν υπάρχει ή είναι αμφίσημη (κομμένη στο όριο του παραθύρου / μακρύτερη από την πινελιά).
 * 🔴 **§6.9 #15 — ακτίνα αναζήτησης ≠ πάχος πινελιάς.** Ως το #14 η ίδια ακτίνα έκανε και τα δύο: στα 185 dpi ένας τοίχος
 * 0,5 mm (5 px) ήταν «πολύ μακρύς» για ακτίνα 3 ⇒ κάλυψη 0,01 σε **σωστή** θέση (#13). Τώρα W′ = max(r, W), παράθυρο
 * ±(r + W′) ώστε μια πινελιά με κέντρο μέσα στο ±r να μην κόβεται ποτέ, μήκος ≤ W′, |κέντρο| ≤ r (#14: θετικά 13 → 26/26).
 */
export function probeStrokeCentre(ink: InkMask, q: AffinePoint, n: AffinePoint, radius: number, maxStrokePx = radius): number | null {
  const stroke = Math.max(radius, maxStrokePx);
  const steps = Math.round((radius + stroke) / PROBE_STEP_PX);
  let best: number | null = null;
  let runStart: number | null = null;
  for (let i = -steps; i <= steps + 1; i++) {
    const inside = i <= steps && isInk(ink, q.x + n.x * i * PROBE_STEP_PX, q.y + n.y * i * PROBE_STEP_PX);
    if (inside && runStart === null) runStart = i;
    if (inside || runStart === null) continue;
    const end = i - 1;
    const clipped = runStart === -steps || end === steps;
    const tooLong = (end - runStart) * PROBE_STEP_PX > stroke;
    const mid = ((runStart + end) / 2) * PROBE_STEP_PX;
    const near = Math.abs(mid) <= radius;
    if (!clipped && !tooLong && near && (best === null || Math.abs(mid) < Math.abs(best))) best = mid;
    runStart = null;
  }
  return best;
}

/**
 * **Πάχος πινελιάς** (px) στο αποτύπωμα του `t`: διάμεσος του `inkThicknessAcross` στο κέντρο της πλησιέστερης πινελιάς
 * κάθε δείγματος, με ακτίνα αναζήτησης την **πρώτη** του ICP (η αρχή μπορεί να απέχει τόσο) και φράγμα το
 * `evaluationRadiusPx`. Κανένα δείγμα ⇒ η τελευταία ακτίνα (= η συμπεριφορά χωρίς μέτρηση).
 * 🔑 **Τοπικά, όχι σε όλη τη σελίδα**: το p90 της σελίδας έφτασε 32–64 px σε σαρώσεις με γέμισμα (poché, §6.9 #14).
 */
export function estimateStrokeWidthPx(segments: readonly RegistrationSegment[], ink: InkMask, t: Affine2x3, o: RegisterOptions): number {
  const widths = strokeWidthsAt(segments, ink, t, o);
  return widths.length === 0 ? lastRadius(o) : median(widths);
}

/**
 * **Πάχος πινελιάς του ΚΡΙΤΗ** (px): το `strokeWidthQuantile` (p90) των ίδιων παχών με το `estimateStrokeWidthPx`, μετρημένο
 * στη **θέση που κρίνεται** (την τελική του ICP, όχι την αρχή του).
 * 🔴 **§6.9 #21 — ο διάμεσος ως όριο μήκους ρίχνει τα μισά δείγματα εξ ορισμού.** Ο θόρυβος σάρωσης ανοίγει την κατανομή
 * του πάχους ⇒ ~½ των δειγμάτων ξεπερνούν τον διάμεσο ⇒ `too-long` σε σωστή θέση (κάλυψη 0,331). Με p90: θετικά ≥ 0,771,
 * λάθος ζεύγη 0/33 — το φαρδύτερο probe ανεβάζει και την p της H0, άρα το NFA αυτοβαθμονομείται (min NFA λάθους −1,02 → +0,10).
 * ⚠️ Το ICP κρατά τον **διάμεσο** (`estimateStrokeWidthPx`): εκεί δεν μετρήθηκε αντιπαράδειγμα.
 */
export function judgeStrokeWidthPx(segments: readonly RegistrationSegment[], ink: InkMask, t: Affine2x3, o: RegisterOptions): number {
  const widths = strokeWidthsAt(segments, ink, t, o);
  return widths.length === 0 ? lastRadius(o) : quantile([...widths].sort((x, y) => x - y), o.acceptance.strokeWidthQuantile);
}

const lastRadius = (o: RegisterOptions): number => o.searchRadiiPx[o.searchRadiiPx.length - 1] ?? 1;

/** Τα πάχη (px) στο κέντρο της πλησιέστερης πινελιάς κάθε δείγματος — η **μία** μέτρηση πίσω από ICP και κριτή. */
function strokeWidthsAt(segments: readonly RegistrationSegment[], ink: InkMask, t: Affine2x3, o: RegisterOptions): number[] {
  const search = o.searchRadiiPx[0] ?? 1;
  const cap = o.acceptance.evaluationRadiusPx;
  const view = { mask: ink.mask, cols: ink.width, rows: ink.height };
  const widths: number[] = [];
  for (const s of sampleSegments(segments, t, o)) {
    const n = unitNormal(t, s.seg);
    if (n === null) continue;
    const q = applyAffine(t, s.p);
    const along = probeStrokeCentre(ink, q, n, search, cap);
    if (along === null) continue;
    const w = inkThicknessAcross(view, { x: q.x + n.x * along, y: q.y + n.y * along }, n, cap);
    if (w > 0) widths.push(w);
  }
  return widths;
}

/** Μοναδιαίο κάθετο του τμήματος **στην εικόνα** του `t` (px)· `null` για εκφυλισμένο τμήμα. */
export function unitNormal(t: Affine2x3, seg: RegistrationSegment): AffinePoint | null {
  const qa = applyAffine(t, seg.a);
  const qb = applyAffine(t, seg.b);
  const len = Math.hypot(qb.x - qa.x, qb.y - qa.y);
  return len > 0 ? { x: -(qb.y - qa.y) / len, y: (qb.x - qa.x) / len } : null;
}

/** Αντιστοιχίες του γύρου: για κάθε δείγμα, η γραμμή μελανιού πάνω στην κάθετο του τρέχοντος `t`. */
export function correspondencesFor(
  samples: readonly RegistrationSample[],
  ink: InkMask,
  t: Affine2x3,
  radius: number,
  strokeWidthPx = radius,
): LineCorrespondence[] {
  const out: LineCorrespondence[] = [];
  for (const s of samples) {
    const normal = unitNormal(t, s.seg);
    if (normal === null) continue;
    const q = applyAffine(t, s.p);
    const along = probeStrokeCentre(ink, q, normal, radius, strokeWidthPx);
    if (along === null) continue;
    out.push({ drawing: s.p, normal, offset: normal.x * q.x + normal.y * q.y + along });
  }
  return out;
}

/** Πεδίο απόστασης (px) από το μελάνι — η βάση του chamfer. */
export function chamferField(ink: InkMask): Float64Array {
  const sq = squaredDistanceTransform(ink.mask, ink.width, ink.height);
  return sq.map(Math.sqrt);
}

/** Μέση **κομμένη** απόσταση chamfer των δειγμάτων (px)· έξω από την εικόνα μετρά ως `truncPx`. Μικρότερο = καλύτερο. */
export function chamferScore(field: Float64Array, ink: InkMask, samples: readonly RegistrationSample[], t: Affine2x3, truncPx: number): number {
  if (samples.length === 0) return truncPx;
  let sum = 0;
  for (const s of samples) {
    const q = applyAffine(t, s.p);
    const ix = Math.floor(q.x);
    const iy = Math.floor(q.y);
    const inside = ix >= 0 && iy >= 0 && ix < ink.width && iy < ink.height;
    sum += inside ? Math.min(field[iy * ink.width + ix], truncPx) : truncPx;
  }
  return sum / samples.length;
}

/** Η χονδρή επιλογή, με τον **δεύτερο διακριτό** υποψήφιο για τον έλεγχο αμφισημίας (Lowe ratio). */
export interface ChamferPick {
  readonly transform: Affine2x3;
  readonly score: number;
  /** Chamfer του καλύτερου υποψηφίου που μετακινεί κάποιο δείγμα > R₀ από τον νικητή· `null` ⇒ κανένας τέτοιος. */
  readonly runnerUpScore: number | null;
}

/** Μέγιστη απόσταση (px) στην εικόνα ανάμεσα στις θέσεις των ίδιων σημείων κάτω από δύο μετασχηματισμούς. */
function maxDisplacementPx(points: readonly AffinePoint[], t1: Affine2x3, t2: Affine2x3): number {
  let worst = 0;
  for (const p of points) {
    const a = applyAffine(t1, p);
    const b = applyAffine(t2, p);
    worst = Math.max(worst, Math.hypot(a.x - b.x, a.y - b.y));
  }
  return worst;
}

/**
 * Ο υποψήφιος αρχικός μετασχηματισμός με τη μικρότερη απόσταση chamfer (ισοβαθμία ⇒ ο πρώτος, δηλωμένη σειρά), και ο
 * καλύτερος **διακριτός** δεύτερος: «διακριτός» = θέση που το ICP **δεν** φτάνει από τον νικητή (κάποιο δείγμα > R₀).
 * 🔑 Lowe (SIFT, 2004) / ambiguity check του template matching: λάθος κατόψεις έδωσαν «1ο ≈ 2ο» (§6.9 #10).
 * `field`: το πεδίο απόστασης, όταν ο καλών το έχει ήδη (το ξαναχρησιμοποιεί η αξιολόγηση a-contrario).
 */
export function pickByChamfer(
  segments: readonly RegistrationSegment[],
  ink: InkMask,
  candidates: readonly Affine2x3[],
  o: RegisterOptions,
  field: Float64Array = chamferField(ink),
): ChamferPick | null {
  const trunc = o.searchRadiiPx[0] ?? 1;
  const scored = candidates.map((t, order) => ({ t, order, score: chamferScore(field, ink, sampleSegments(segments, t, o), t, trunc) }));
  if (scored.length === 0) return null;
  scored.sort((p, q) => p.score - q.score || p.order - q.order);
  const best = scored[0];
  const points = sampleSegments(segments, best.t, o).map((s) => s.p);
  const runnerUp = scored.slice(1).find((c) => maxDisplacementPx(points, best.t, c.t) > trunc);
  return { transform: best.t, score: best.score, runnerUpScore: runnerUp?.score ?? null };
}

function roundFit(o: RegisterOptions, last: boolean): FitOptions {
  return { ...o.fit, snoop: last && o.fit.snoop };
}

/**
 * **Κατέγραψε** το σχέδιο πάνω στο μελάνι, ξεκινώντας από το `initial` (σχέδιο → px).
 * ⚠️ **Μη αξιολογημένο**: τα υπόλοιπα εδώ είναι κομμένα από την τελευταία ακτίνα. Για ετυμηγορία ⇒ `registerAndAssess`
 * (`registration-acceptance.ts`).
 */
export function registerToInk(
  segments: readonly RegistrationSegment[],
  ink: InkMask,
  initial: Affine2x3,
  o: RegisterOptions,
): RegistrationResult {
  let t = initial;
  const samples = sampleSegments(segments, initial, o);
  // Ένα πάχος για όλους τους γύρους και για την αξιολόγηση: δηλωμένο, ή μετρημένο μία φορά στην αρχή.
  const strokeWidthPx = o.strokeWidthPx ?? estimateStrokeWidthPx(segments, ink, initial, o);
  for (let round = 0; round < o.searchRadiiPx.length; round++) {
    const last = round === o.searchRadiiPx.length - 1;
    const corr = correspondencesFor(samples, ink, t, o.searchRadiiPx[round], strokeWidthPx);
    if (corr.length < o.minCorrespondences) return { kind: 'not-converged', reason: 'too-few-correspondences', round };
    const fit = fitTransform(corr, roundFit(o, last));
    if (fit.kind === 'singular') return { kind: 'not-converged', reason: 'singular', round };
    if (invertAffine(fit.transform) === null) return { kind: 'not-converged', reason: 'degenerate-transform', round };
    t = fit.transform;
    if (last) {
      return { kind: 'registered', fit, coverage: corr.length / Math.max(1, samples.length), samples: samples.length, strokeWidthPx };
    }
  }
  return { kind: 'not-converged', reason: 'too-few-correspondences', round: 0 };
}
