/**
 * @fileoverview **ΠΟΙΟΤΗΤΑ ΚΑΤΑΓΡΑΦΗΣ ΠΕΡΑ ΑΠΟ ΤΟ NFA** (SSoT, ADR-929 §6.9 #9) — όσα μετρούν οι βιομηχανικοί αντιστοιχιστές
 * σχήματος και οι καταγραφείς σαρώσεων, και που το «είναι σύμπτωση;» δεν βλέπει.
 * @module lib/geometry/registration/registration-quality
 *
 * 🔑 **Clutter (Cognex PatMax, MVTec HALCON).** Η κάλυψη ρωτά «βρέθηκε το σχέδιο στην εικόνα;». Μια **λάθος** κάτοψη πάνω σε
 * πυκνή εικόνα απαντά «ναι», γιατί παντού υπάρχει μελάνι. Η αντίστροφη ερώτηση, «εξηγεί το σχέδιο το μελάνι που καλύπτει;»,
 * τη διαψεύδει. Εδώ: ανεξήγητο μελάνι / μελάνι μέσα στο περίγραμμα του σχεδίου, με **όλα** τα τμήματα της αλήθειας (και
 * διαστάσεις, σημειώσεις), όχι μόνο τους τοίχους.
 * 🔑 **Balance (Autodesk ReCap).** λ_min/(λ₁+λ₂) του Σ ℓ·n nᵀ των τμημάτων που πέτυχαν. 0 ⇒ όλα παράλληλα: η ολίσθηση κατά
 * μήκος τους είναι ελεύθερη, και μια «επιτυχία» μπορεί να είναι οποιαδήποτε θέση πάνω σε αυτή τη γραμμή.
 * 🔑 **Ανάλυση.** Οι δύο παρειές ενός τοίχου απέχουν όσο το πάχος του. Αν στην εικόνα απέχουν < 2r+1 px, η ερώτηση «βρήκε
 * η παρειά το **δικό** της μελάνι;» δεν ορίζεται: η μία παρειά βρίσκει το μελάνι της άλλης. Μετρήθηκε (§6.9 #8): σελίδες
 * 10 DPI, όπου 1 m στο 1:50 = 7,9 px, έγιναν «δεκτές».
 *
 * ⚠️ Τα κατώφλια clutter/balance **δεν** μπαίνουν με το μάτι: βαθμονομούνται σε λάθος ζεύγη (§6.9 #9 Δ).
 */

import { applyAffine, type Affine2x3 } from '../affine-2x3';
import type { SegmentOutcome } from './registration-null-model';
import type { InkMask, RegistrationSegment } from './registration-types';

const HALF_PIXEL_DIAGONAL = Math.SQRT2 / 2;
/** Μέγιστη γωνία (rad) για «παράλληλα» στη μέτρηση ανάλυσης. */
const PARALLEL_TOL_RAD = (2 * Math.PI) / 180;
/** Κάτω από αυτό (px) δύο τμήματα είναι συνευθειακά/διπλά, όχι δύο παρειές. */
const COLLINEAR_PX = 0.5;

/** Βήμα (px) κατά μήκος του τμήματος στο σημάδεμα· σφάλμα του περιβλήματος ≤ βήμα/2. */
const MARK_STEP_PX = 0.5;

/**
 * Σημαδεύει τα pixel (κέντρο) σε απόσταση ≤ `tol` από το τμήμα `a→b`: δίσκοι ανά `MARK_STEP_PX` κατά μήκος του.
 * Κόστος γραμμικό στο μήκος, και για **λοξά** τμήματα (το ορθογώνιο περίγραμμά τους θα ήταν τετραγωνικό).
 */
function markNear(mark: Uint8Array, w: number, h: number, a: { x: number; y: number }, b: { x: number; y: number }, tol: number): void {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(len / MARK_STEP_PX));
  const r = Math.ceil(tol);
  for (let s = 0; s <= steps; s++) {
    const cx = a.x + ((b.x - a.x) * s) / steps;
    const cy = a.y + ((b.y - a.y) * s) / steps;
    const x0 = Math.max(0, Math.floor(cx) - r), x1 = Math.min(w - 1, Math.floor(cx) + r);
    const y0 = Math.max(0, Math.floor(cy) - r), y1 = Math.min(h - 1, Math.floor(cy) + r);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= tol) mark[y * w + x] = 1;
    }
  }
}

/**
 * **Clutter** = μελάνι μέσα στο ορθογώνιο περίγραμμα του μετασχηματισμένου σχεδίου που **δεν** απέχει ≤ r (+ μισή διαγώνιο)
 * από κανένα τμήμα, διά το μελάνι του περιγράμματος. `null` ⇒ κανένα μελάνι στο περίγραμμα.
 */
export function measureClutter(explain: readonly RegistrationSegment[], ink: InkMask, t: Affine2x3, radius: number): number | null {
  const { width: w, height: h } = ink;
  const tol = radius + HALF_PIXEL_DIAGONAL;
  const explained = new Uint8Array(w * h);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of explain) {
    const a = applyAffine(t, s.a);
    const b = applyAffine(t, s.b);
    minX = Math.min(minX, a.x, b.x); maxX = Math.max(maxX, a.x, b.x);
    minY = Math.min(minY, a.y, b.y); maxY = Math.max(maxY, a.y, b.y);
    markNear(explained, w, h, a, b, tol);
  }
  const x0 = Math.max(0, Math.floor(minX)), x1 = Math.min(w - 1, Math.ceil(maxX));
  const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(h - 1, Math.ceil(maxY));
  let total = 0, unexplained = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * w + x;
      if (ink.mask[i] !== 1) continue;
      total++;
      if (explained[i] !== 1) unexplained++;
    }
  }
  return total === 0 ? null : unexplained / total;
}

/** **Balance** = λ_min/(λ₁+λ₂) του Σ ℓ·n nᵀ πάνω στα τμήματα που πέτυχαν (κλειστός τύπος 2×2). `null` ⇒ κανένα. */
export function measureBalance(outcomes: readonly SegmentOutcome[]): number | null {
  let sxx = 0, sxy = 0, syy = 0;
  for (const { segment: s, hit } of outcomes) {
    if (!hit) continue;
    sxx += s.lengthPx * s.normal.x * s.normal.x;
    sxy += s.lengthPx * s.normal.x * s.normal.y;
    syy += s.lengthPx * s.normal.y * s.normal.y;
  }
  const trace = sxx + syy;
  if (!(trace > 0)) return null;
  const lambdaMin = (trace - Math.sqrt((sxx - syy) ** 2 + 4 * sxy * sxy)) / 2;
  return Math.max(0, lambdaMin) / trace;
}

/** Η απόσταση (px) του `j` από το `i`, αν είναι παράλληλα και επικαλύπτονται κατά μήκος· αλλιώς `null`. */
function parallelGap(i: SegmentOutcome['segment'], j: SegmentOutcome['segment']): number | null {
  const cos = Math.abs(i.dir.x * j.dir.x + i.dir.y * j.dir.y);
  if (cos < Math.cos(PARALLEL_TOL_RAD)) return null;
  const rel = (p: { x: number; y: number }) => ({ along: (p.x - i.a.x) * i.dir.x + (p.y - i.a.y) * i.dir.y, off: (p.x - i.a.x) * i.normal.x + (p.y - i.a.y) * i.normal.y });
  const ja = rel(j.a);
  const jb = rel({ x: j.a.x + j.dir.x * j.lengthPx, y: j.a.y + j.dir.y * j.lengthPx });
  const overlap = Math.min(i.lengthPx, Math.max(ja.along, jb.along)) - Math.max(0, Math.min(ja.along, jb.along));
  if (overlap <= 0) return null;
  const gap = Math.abs((ja.off + jb.off) / 2);
  return gap > COLLINEAR_PX ? gap : null;
}

/**
 * Διάμεσος (βάρος μήκους) της απόστασης κάθε τμήματος από τον **πλησιέστερο** παράλληλο, επικαλυπτόμενο γείτονα, στην εικόνα.
 * Για παρειές τοίχων = το πάχος του τοίχου σε px. `null` ⇒ κανένα τέτοιο ζεύγος.
 */
export function parallelSeparationPx(outcomes: readonly SegmentOutcome[]): number | null {
  const gaps: { gap: number; weight: number }[] = [];
  for (const a of outcomes) {
    let best: number | null = null;
    for (const b of outcomes) {
      if (a === b) continue;
      const g = parallelGap(a.segment, b.segment);
      if (g !== null && (best === null || g < best)) best = g;
    }
    if (best !== null) gaps.push({ gap: best, weight: a.segment.lengthPx });
  }
  if (gaps.length === 0) return null;
  gaps.sort((p, q) => p.gap - q.gap);
  const half = gaps.reduce((s, g) => s + g.weight, 0) / 2;
  let acc = 0;
  for (const g of gaps) {
    acc += g.weight;
    if (acc >= half) return g.gap;
  }
  return gaps[gaps.length - 1].gap;
}
