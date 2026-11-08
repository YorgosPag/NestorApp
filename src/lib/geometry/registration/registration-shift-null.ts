/**
 * @fileoverview **ΤΟΠΙΚΗ ΜΗΔΕΝΙΚΗ ΥΠΟΘΕΣΗ ΜΕ ΜΕΤΑΤΟΠΙΣΗ ΟΛΟΥ ΤΟΥ ΣΧΕΔΙΟΥ** (SSoT, ADR-929 §6.9 #15 — η Π1 του #11).
 * @module lib/geometry/registration/registration-shift-null
 *
 * 🔴 **Γιατί υπάρχει.** Η H0 του #9 μετρά την p κάθε τμήματος σε **όλη** τη σελίδα. Ένα λάθος ζεύγος όμως κάθεται σε πυκνή
 * περιοχή (1,5% της σελίδας, πυκνότητα μελανιού 3,7×, §6.9 #10 Υ2), και τα τμήματα ενός σχεδίου **δεν** είναι ανεξάρτητα
 * (παρειές, αλυσίδες, Υ3). Αποτέλεσμα: NFA < 1 σε 5/33 λάθος ζεύγη, και 14/33 με το σωστό probe (#14).
 *
 * 🔑 **H0 = «το ίδιο σχέδιο, ίδια κλίμακα και στροφή, σε άλλη θέση κοντά».** Το σχέδιο μετατοπίζεται ως **ένα σώμα** σε
 * πλέγμα θέσεων στο παράθυρο ±`shiftWindow`·αποτύπωμα, εκτός του δακτυλίου ±R₀ που φτάνει το ICP. Έτσι η p κάθε τμήματος
 * είναι **τοπική** (λύνει την Υ2), και η συσχέτιση των τμημάτων μένει μέσα στο σώμα (μετριέται, λύνει την Υ3).
 * Είναι ο έλεγχος **peak-to-sidelobe** των correlation filters (κορυφή έναντι γειτόνων) και το circular-shift null
 * (shiftR): μετατόπιση που κρατά την τοπική εξάρτηση, αντί για παραμετρικό τεστ που τη θεωρεί ανεξαρτησία.
 *
 * 🔑 **Δύο αναγνώσεις, μία μέτρηση.**
 * - **z** = (k − διάμεσος)/max(1,4826·MAD, √Σp(1−p)) — εύρωστο PSR. Ο παρονομαστής δεν πέφτει κάτω από τη διασπορά
 *   ανεξαρτησίας, ώστε μια επίπεδη γειτονιά (MAD = 0) να μη δίνει άπειρο.
 * - **NFA**: η εμπειρική p δεν πέφτει κάτω από 1/(M+1), ενώ N_tests ~ 10¹². Γι' αυτό ουρά Poisson-binomial με p **τοπικά**,
 *   πάνω στις **ανεξάρτητες μονάδες** του `registration-units` (§6.9 #19, E4): οι παρειές ενός τοίχου μετρούν μία φορά.
 *   🔴 Ως το #18 η ουρά ανά τμήμα διαιρούνταν με τον συντελεστή Kish deff = Var(k_j)/Σpᵢ(1−pᵢ)· επικυρώθηκε μόνο 16/26
 *   σωστά, και μένει **μόνο αναφορά** (`designEffect`).
 *
 * 📐 Grimson & Huttenlocher, IEEE PAMI 13(12) 1991 · Mostafavi & Smith (PSR) · Bolme et al., CVPR 2010 (MOSSE) ·
 * Kish, «Survey Sampling» 1965 · Ehret, Davy, Morel & Delbracio, arXiv 1808.02564 (τοπικά μοντέλα υποβάθρου).
 */

import type { AffinePoint } from '../affine-2x3';
import { log10PoissonBinomialTail } from '../../statistics/log-binomial-tail';
import { median, medianAbsoluteDeviation } from '../../statistics/median';
import { segmentHits, type ImageSegment, type SegmentOutcome, type SegmentProbe } from './registration-null-model';
import type { RegisterOptions, ShiftNullEvidence } from './registration-types';
import { independentUnits, unitSucceeded } from './registration-units';

/** MAD → τυπική απόκλιση για κανονική κατανομή. */
const MAD_TO_SIGMA = 1.4826;

/** Το ορθογώνιο περίγραμμα των τμημάτων στην εικόνα: πλάτος, ύψος (px, ≥ 1). */
function footprintSize(segs: readonly ImageSegment[]): { readonly w: number; readonly h: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of segs) {
    const bx = s.a.x + s.dir.x * s.lengthPx;
    const by = s.a.y + s.dir.y * s.lengthPx;
    minX = Math.min(minX, s.a.x, bx); maxX = Math.max(maxX, s.a.x, bx);
    minY = Math.min(minY, s.a.y, by); maxY = Math.max(maxY, s.a.y, by);
  }
  return segs.length === 0 ? { w: 1, h: 1 } : { w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

/**
 * Οι μετατοπίσεις (px) της H0: πλέγμα στο ±`shiftWindow`·(w, h), βήμα ≥ 2r+1 (ανεξάρτητες θέσεις ως προς το probe) και
 * τέτοιο ώστε το πλήθος ≈ `maxShifts`· εξαιρείται ό,τι απέχει ≤ R₀ και στους δύο άξονες (το ICP το φτάνει, άρα **δεν** είναι
 * «άλλη θέση»). Ντετερμινιστικό.
 */
export function shiftGrid(segs: readonly ImageSegment[], radius: number, o: RegisterOptions): AffinePoint[] {
  const { w, h } = footprintSize(segs);
  const hx = o.acceptance.shiftWindow * w;
  const hy = o.acceptance.shiftWindow * h;
  const reach = o.searchRadiiPx[0] ?? radius;
  const step = Math.max(2 * radius + 1, Math.sqrt((4 * hx * hy) / Math.max(1, o.acceptance.maxShifts)));
  const out: AffinePoint[] = [];
  for (let dy = -hy; dy <= hy + 1e-9; dy += step) {
    for (let dx = -hx; dx <= hx + 1e-9; dx += step) {
      if (Math.abs(dx) <= reach && Math.abs(dy) <= reach) continue;
      out.push({ x: dx, y: dy });
    }
  }
  return out;
}

/** Δειγματική διασπορά (n − 1)· < 2 τιμές ⇒ 0. */
function sampleVariance(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
}

/**
 * **Μία** μέτρηση του πίνακα «τμήμα × μετατόπιση» (`hits[i·M + j]`), και από αυτόν οι επιτυχίες ανά μετατόπιση (k_j) και ανά
 * τμήμα. Τον ξαναδιαβάζουν οι μονάδες — κανένα probe δεν τρέχει δεύτερη φορά.
 */
function countShiftHits(segs: readonly ImageSegment[], shifts: readonly AffinePoint[], q: SegmentProbe) {
  const m = shifts.length;
  const hits = new Uint8Array(segs.length * m);
  const perSegment = new Array<number>(segs.length).fill(0);
  const perShift = shifts.map((d, j) => {
    let k = 0;
    segs.forEach((s, i) => {
      if (!segmentHits(s, { x: s.a.x + d.x, y: s.a.y + d.y }, q, true)) return;
      hits[i * m + j] = 1;
      perSegment[i]++;
      k++;
    });
    return k;
  });
  return { hits, perSegment, perShift };
}

/** Ουρά πάνω στις ανεξάρτητες μονάδες (E4): p ανά μονάδα = (1 + #μετατοπίσεων όπου πέτυχε) / (1 + M). */
function unitTail(outcomes: readonly SegmentOutcome[], hits: Uint8Array, m: number, q: SegmentProbe, o: RegisterOptions) {
  const segs = outcomes.map((x) => x.segment);
  const units = independentUnits(segs, q, o);
  const p = units.map((u) => {
    let h = 0;
    for (let j = 0; j < m; j++) if (unitSucceeded(u, segs, (i) => hits[i * m + j] === 1, q.share)) h++;
    return (1 + h) / (1 + m);
  });
  const unitHits = units.filter((u) => unitSucceeded(u, segs, (i) => outcomes[i].hit, q.share)).length;
  return { units: units.length, unitHits, log10Tail: log10PoissonBinomialTail(p, unitHits) };
}

/**
 * Η τοπική H0 για τα `outcomes` της καταγραφής (ίδια τμήματα, ίδιο probe `q`). Κόστος M·S probes τμήματος, με πρόωρη
 * έξοδο ανά τμήμα.
 */
export function shiftNull(outcomes: readonly SegmentOutcome[], q: SegmentProbe, o: RegisterOptions): ShiftNullEvidence {
  const segs = outcomes.map((x) => x.segment);
  const shifts = shiftGrid(segs, q.radius, o);
  const { hits, perSegment, perShift } = countShiftHits(segs, shifts, q);
  const m = shifts.length;
  const tail = unitTail(outcomes, hits, m, q, o);
  const p = perSegment.map((h) => (1 + h) / (1 + m));
  const observedHits = outcomes.filter((x) => x.hit).length;
  const independentVariance = p.reduce((s, v) => s + v * (1 - v), 0);
  const designEffect = independentVariance > 0 ? Math.max(1, sampleVariance(perShift) / independentVariance) : 1;
  const medianHits = median(perShift);
  const madHits = medianAbsoluteDeviation(perShift);
  const scale = Math.max(MAD_TO_SIGMA * madHits, Math.sqrt(independentVariance));
  return {
    shifts: m,
    observedHits,
    medianHits,
    madHits,
    z: scale > 0 ? (observedHits - medianHits) / scale : null,
    empiricalP: (1 + perShift.filter((k) => k >= observedHits).length) / (1 + m),
    designEffect,
    units: tail.units,
    unitHits: tail.unitHits,
    log10Tail: tail.log10Tail,
  };
}
