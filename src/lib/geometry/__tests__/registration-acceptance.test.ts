/**
 * ADR-929 §6.9 #7 + #9 + #15 — αποδοχή καταγραφής: NFA a-contrario **ανά τμήμα** με **τοπική** H0 (μετατόπιση όλου του
 * σχεδίου), PSR, Lowe, αβεβαιότητα θέσης, probe κατά πάχος, κάλυψη μήκους, clutter, balance, υπόλοιπα χωρίς αποκοπή.
 * 🔴 Τα σενάρια που έδειξε η μέτρηση: §6.9 #6 «p95 ≤ 2 px» πάνω σε τυχαίο μελάνι · §6.9 #8 το NFA ανά δείγμα δεχόταν
 * λάθος κατόψεις (τα δείγματα ενός τοίχου δεν είναι ανεξάρτητα) και σελίδες 10 DPI (παρειές < 2r+1 px).
 */

import { describe, it, expect } from '@jest/globals';
import type { Affine2x3 } from '../affine-2x3';
import { log10BinomialTail } from '../../statistics/log-binomial-tail';
import {
  ambiguityRatioOf,
  assessRegistration,
  inkProbability,
  log10SearchSpace,
  registerAndAssess,
} from '../registration/registration-acceptance';
import { chamferField, sampleSegments } from '../registration/chamfer-register';
import { segmentProbe, toImageSegment, type ImageSegment, type SegmentOutcome } from '../registration/registration-null-model';
import { measureBalance, measureClutter, parallelSeparationPx } from '../registration/registration-quality';
import {
  DEFAULT_REGISTER,
  type InkMask,
  type RegistrationSegment,
  type SearchDeclaration,
} from '../registration/registration-types';
import { independentUnits } from '../registration/registration-units';
import { H, PERTURBED, planSegments, rasterize, TILED, tiledPlan, TRUTH, W } from './registration-fixtures';

const IDENTITY: Affine2x3 = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
/** Μία υπόθεση, καμία απαρίθμηση θέσεων. */
const ONE: SearchDeclaration = { hypotheses: 1, translationStepPx: null };

/** Ντετερμινιστικές «τυχαίες» γραμμές (LCG): μελάνι που ΔΕΝ είναι το σχέδιο. */
function randomSegments(count: number, seed: number): RegistrationSegment[] {
  let s = seed;
  const next = (): number => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return Array.from({ length: count }, () => ({ a: { x: next() * W, y: next() * H }, b: { x: next() * W, y: next() * H } }));
}

function randomInk(count: number, seed: number): InkMask {
  return rasterize(randomSegments(count, seed), IDENTITY, 2);
}

function union(p: InkMask, q: InkMask): InkMask {
  return { mask: p.mask.map((v, i) => v | q.mask[i]), width: W, height: H };
}

/** Πυκνή γραμμοσκίαση: κατακόρυφες γραμμές 1 px κάθε 5 px σε όλη την εικόνα. */
function hatching(): InkMask {
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x += 5) mask[y * W + x] = 1;
  return { mask, width: W, height: H };
}

/** «Ριγέ χαρτί»: οριζόντιες γραμμές πλάτους 2 px κάθε 20 px — δομή που ΔΕΝ είναι το σχέδιο. */
function linedPaper(): InkMask {
  const lines: RegistrationSegment[] = [];
  for (let y = 0; y < H; y += 20) lines.push({ a: { x: 0, y }, b: { x: W, y } });
  return rasterize(lines, IDENTITY, 2);
}

/**
 * Σελίδα 2000 × 2000 σχεδόν κενή, με **μία** πυκνή περιοχή 500 × 400 (πλέγμα γραμμών 1 px κάθε 8 px) — το σχήμα του λάθος
 * ζεύγους του §6.9 #10: αποτύπωμα ≈ 1–5% της σελίδας, πυκνότητα πολλαπλάσια της σελίδας.
 */
function densePatchPage(): InkMask {
  const size = 2000;
  const mask = new Uint8Array(size * size);
  for (let y = 800; y < 1200; y++) {
    for (let x = 750; x < 1250; x++) if ((x - 750) % 8 === 0 || (y - 800) % 8 === 0) mask[y * size + x] = 1;
  }
  return { mask, width: size, height: size };
}

function outcome(seg: RegistrationSegment, hit: boolean): SegmentOutcome {
  const segment = toImageSegment(IDENTITY, seg);
  if (segment === null) throw new Error('degenerate test segment');
  return { segment, hit, p: 0.1 };
}

describe('registerAndAssess', () => {
  const segments = planSegments();
  const ink = rasterize(segments, TRUTH, 3);

  it('σωστή καταγραφή ⇒ accepted, με υπόλοιπα που ΔΕΝ ακουμπούν την ακτίνα και χωρίς clutter', () => {
    const r = registerAndAssess(segments, ink, [PERTURBED], DEFAULT_REGISTER);
    if (r.kind !== 'registered') throw new Error(`expected registered, got ${r.reason}`);
    const a = r.assessment;
    expect(a.verdict).toEqual({ kind: 'accepted' });
    expect(a.log10Nfa).toBeLessThan(0);
    expect(a.segments.hits).toBe(a.segments.segments);
    expect(a.coverage).toBeGreaterThan(0.9);
    expect(a.quality.clutter).toBeLessThan(0.05);
    expect(a.quality.parallelSeparationPx).toBeGreaterThanOrEqual(a.quality.resolvablePx);
    expect(a.evaluation.residuals.p95Px).toBeLessThan(1);
    expect(a.evaluation.nearRadiusShare).toBe(0);
    expect(r.initial).toBe(PERTURBED);
    // §6.9 #15: η αξιολόγηση παίρνει ό,τι ήξερε η καταγραφή — ποτέ δεύτερη, διαφορετική μαντεψιά.
    expect(a.strokeWidthPx).toBe(r.strokeWidthPx);
    expect(a.positionSigmaPx).toBe(r.fit.positionSigmaPx);
    expect(a.ambiguityRatio).toBeNull();
    expect(a.log10Nfa).toBeLessThan(0);
  });

  it('καμία υποψήφια αρχή ⇒ not-converged με λόγο', () => {
    expect(registerAndAssess(segments, ink, [], DEFAULT_REGISTER)).toEqual({ kind: 'not-converged', reason: 'no-candidates', round: 0 });
  });
});

describe('assessRegistration', () => {
  const segments = planSegments();

  it('τυχαίο μελάνι (το σενάριο του §6.9 #6) ⇒ not-meaningful', () => {
    const a = assessRegistration(segments, randomInk(40, 7), TRUTH, ONE, DEFAULT_REGISTER);
    expect(a.segments.segments).toBe(segments.length);
    expect(a.verdict).toEqual({ kind: 'rejected', reason: 'not-meaningful' });
  });

  it('πυκνή γραμμοσκίαση (p → 1) ⇒ not-meaningful, όσα κι αν «βρει»', () => {
    const a = assessRegistration(segments, hatching(), TRUTH, ONE, DEFAULT_REGISTER);
    expect(a.inkProbability).toBeGreaterThan(0.95);
    expect(a.segments.pMax).toBeGreaterThan(0.9);
    expect(a.verdict).toEqual({ kind: 'rejected', reason: 'not-meaningful' });
  });

  it('🔴 §6.9 #8: συσχετισμένα δείγματα — λάθος σχέδιο πάνω σε δομή ⇒ not-meaningful, ενώ το NFA ανά δείγμα θα το δεχόταν', () => {
    // Τρεις οριζόντιοι «τοίχοι» που πέφτουν πάνω σε γραμμές ριγέ χαρτιού: κάθε δείγμα πετυχαίνει, αλλά είναι ΤΡΙΑ γεγονότα.
    const walls: RegistrationSegment[] = [0, 50, 100].map((y) => ({ a: { x: 0, y }, b: { x: 150, y } }));
    const t: Affine2x3 = { a: 2, b: 0, c: 0, d: 2, e: 20, f: 20 };
    const ink = linedPaper();
    const a = assessRegistration(walls, ink, t, ONE, DEFAULT_REGISTER);
    expect(a.segments.hits).toBe(3);
    expect(a.verdict).toEqual({ kind: 'rejected', reason: 'not-meaningful' });
    // Το κριτήριο του #7: ανεξάρτητα δείγματα με βήμα ≥ 2r, p = πυκνότητα μελανιού.
    const independent = sampleSegments(walls, t, { ...DEFAULT_REGISTER, sampleStepPx: 6 });
    const oldNfa = log10SearchSpace(DEFAULT_REGISTER, null) + log10BinomialTail(independent.length, independent.length, a.inkProbability);
    expect(oldNfa).toBeLessThan(0);
  });

  it('§6.9 #19 χαρακτηρισμός: μόνο το εξωτερικό πλαίσιο (43% του μήκους) ⇒ το κόβει το NFA, ΟΧΙ η κάλυψη', () => {
    const frameOnly = rasterize(segments.slice(0, 4), TRUTH, 3);
    const a = assessRegistration(segments, frameOnly, TRUTH, ONE, DEFAULT_REGISTER);
    // Με κάλυψη 0,30 το πλαίσιο περνά την πύλη κάλυψης· την απόρριψη τη φέρνουν οι λίγες ανεξάρτητες μονάδες.
    expect(a.coverage).toBeGreaterThanOrEqual(DEFAULT_REGISTER.acceptance.minCoverage);
    expect(a.verdict).toEqual({ kind: 'rejected', reason: 'not-meaningful' });
  });

  it('§6.9 #19: σωστό κομμάτι, λίγο από το όλον — 2/9 διαμερίσματα ⇒ low-coverage παρά σημαντικό NFA · 3/9 ⇒ accepted', () => {
    const blocks = tiledPlan();
    const cad = blocks.flat();
    const shown = (n: number) => assessRegistration(cad, rasterize(blocks.slice(0, n).flat(), TILED, 3), TILED, ONE, DEFAULT_REGISTER);
    const two = shown(2);
    expect(two.log10Nfa).toBeLessThan(0);
    expect(two.coverage).toBeLessThan(DEFAULT_REGISTER.acceptance.minCoverage);
    expect(two.verdict).toEqual({ kind: 'rejected', reason: 'low-coverage' });
    const three = shown(3);
    expect(three.coverage).toBeGreaterThanOrEqual(DEFAULT_REGISTER.acceptance.minCoverage);
    expect(three.verdict).toEqual({ kind: 'accepted' });
  });

  it('🔴 §6.9 #12/#15: παρειές 6 px < 2r+1 ⇒ ΜΟΝΟ αναφορά· unresolvable αποφασίζει η αβεβαιότητα ΘΕΣΗΣ', () => {
    const small: Affine2x3 = { a: 1, b: 0, c: 0, d: 1, e: 30, f: 30 };
    const ink = rasterize(segments, small, 1);
    const a = assessRegistration(segments, ink, small, ONE, DEFAULT_REGISTER);
    expect(a.quality.parallelSeparationPx).toBeCloseTo(6, 6);
    expect(a.quality.resolvablePx).toBe(7);
    expect(a.verdict).not.toEqual({ kind: 'rejected', reason: 'unresolvable' });
    const gate = { ...DEFAULT_REGISTER, acceptance: { ...DEFAULT_REGISTER.acceptance, maxPositionSigmaPx: 0.5 } };
    expect(assessRegistration(segments, ink, small, ONE, gate, { positionSigmaPx: 0.4 }).verdict).not.toEqual({ kind: 'rejected', reason: 'unresolvable' });
    expect(assessRegistration(segments, ink, small, ONE, gate, { positionSigmaPx: 0.6 }).verdict).toEqual({ kind: 'rejected', reason: 'unresolvable' });
  });

  it('🔴 §6.9 #13/#15: πινελιά 7 px σε ΣΩΣΤΗ θέση ⇒ κάλυψη ≈ 1 (ως το #14: ≈ 0, «πολύ μακριά» για ακτίνα 3)', () => {
    const thick = rasterize(segments, TRUTH, 7);
    const measured = assessRegistration(segments, thick, TRUTH, ONE, DEFAULT_REGISTER);
    expect(measured.strokeWidthPx).toBeGreaterThan(6);
    expect(measured.coverage).toBeGreaterThan(0.9);
    expect(measured.verdict).toEqual({ kind: 'accepted' });
    expect(assessRegistration(segments, thick, TRUTH, ONE, DEFAULT_REGISTER, { strokeWidthPx: 3 }).coverage).toBeLessThan(0.5);
  });

  it('🔴 §6.9 #10 Υ2/#15: λάθος σχέδιο σε ΠΥΚΝΗ περιοχή αραιής σελίδας ⇒ η H0 σελίδας δέχεται, η τοπική απορρίπτει', () => {
    const page = densePatchPage();
    const t: Affine2x3 = { a: 1.6, b: 0, c: 0, d: 1.6, e: 880, f: 912 };
    const a = assessRegistration(segments, page, t, ONE, DEFAULT_REGISTER);
    expect(a.log10NfaGlobal).toBeLessThan(0);
    expect(a.shiftNull.shifts).toBeGreaterThan(50);
    expect(a.log10Nfa).toBeGreaterThan(0);
    expect(a.verdict).toEqual({ kind: 'rejected', reason: 'not-meaningful' });
  });

  it('§6.9 #15: σωστή θέση σε καθαρή εικόνα ⇒ ξεχωρίζει από τις μετατοπίσεις (z ≫ 0, εμπειρική p = 1/(M+1))', () => {
    const a = assessRegistration(segments, rasterize(segments, TRUTH, 3), TRUTH, ONE, DEFAULT_REGISTER);
    expect(a.shiftNull.z ?? 0).toBeGreaterThan(3);
    expect(a.shiftNull.empiricalP).toBeCloseTo(1 / (1 + a.shiftNull.shifts), 12);
    expect(a.shiftNull.designEffect).toBeGreaterThanOrEqual(1);
  });

  it('§6.9 #15: οι πύλες PSR και Lowe αποφασίζουν μόνο όταν έχουν κατώφλι', () => {
    const ink = rasterize(segments, TRUTH, 3);
    const withGates = (minShiftZ: number | null, maxAmbiguity: number | null) =>
      ({ ...DEFAULT_REGISTER, acceptance: { ...DEFAULT_REGISTER.acceptance, minShiftZ, maxAmbiguity } });
    expect(assessRegistration(segments, ink, TRUTH, ONE, withGates(null, null), { ambiguityRatio: 0.99 }).verdict).toEqual({ kind: 'accepted' });
    expect(assessRegistration(segments, ink, TRUTH, ONE, withGates(null, 0.9), { ambiguityRatio: 0.99 }).verdict).toEqual({ kind: 'rejected', reason: 'ambiguous' });
    expect(assessRegistration(segments, ink, TRUTH, ONE, withGates(null, 0.9), { ambiguityRatio: 0.5 }).verdict).toEqual({ kind: 'accepted' });
    expect(assessRegistration(segments, ink, TRUTH, ONE, withGates(1e9, null)).verdict).toEqual({ kind: 'rejected', reason: 'not-distinct' });
  });

  it('ambiguityRatioOf: ίδιο σκορ ⇒ 1 · κανένας δεύτερος ⇒ null · διπλάσιο ⇒ ½', () => {
    expect(ambiguityRatioOf(0, 0)).toBe(1);
    expect(ambiguityRatioOf(1, null)).toBeNull();
    expect(ambiguityRatioOf(1, 2)).toBeCloseTo(0.5, 12);
  });

  it('επιπλέον μελάνι που το σχέδιο δεν εξηγεί ⇒ μεγάλο clutter· με κατώφλι ⇒ η καθαρή εικόνα μένει accepted', () => {
    const clean = rasterize(segments, TRUTH, 3);
    const noisy = union(clean, randomInk(40, 7));
    const c = assessRegistration(segments, clean, TRUTH, ONE, DEFAULT_REGISTER);
    const n = assessRegistration(segments, noisy, TRUTH, ONE, DEFAULT_REGISTER);
    expect(c.quality.clutter).toBeLessThan(0.05);
    expect(n.quality.clutter).toBeGreaterThan(0.3);
    const strict = { ...DEFAULT_REGISTER, acceptance: { ...DEFAULT_REGISTER.acceptance, maxClutter: 0.2 } };
    expect(assessRegistration(segments, clean, TRUTH, ONE, strict).verdict).toEqual({ kind: 'accepted' });
  });

  it('μετατόπιση 5 px ⇒ τα υπόλοιπα αξιολόγησης λένε ~5 px (το κομμένο ICP θα έλεγε < 3)', () => {
    // Μία γραμμή κάθετη στη μετατόπιση: χωρίς άκρα που να «βρίσκουν» γειτονική γραμμή.
    const line: RegistrationSegment[] = [{ a: { x: 50, y: 10 }, b: { x: 50, y: 120 } }];
    const ink = rasterize(line, TRUTH, 3);
    const shifted: Affine2x3 = { ...TRUTH, e: TRUTH.e + 5 };
    const { evaluation } = assessRegistration(line, ink, shifted, ONE, DEFAULT_REGISTER);
    expect(evaluation.found).toBe(evaluation.samples);
    expect(evaluation.residuals.p95Px).toBeGreaterThan(4.5);
    expect(evaluation.residuals.maxPx).toBeLessThan(5.5);
    expect(evaluation.nearRadiusShare).toBe(0);
  });

  it('περισσότερες αρχές ⇒ NFA μεγαλύτερο ακριβώς κατά log₁₀ του λόγου', () => {
    const ink = rasterize(segments, TRUTH, 3);
    const one = assessRegistration(segments, ink, TRUTH, ONE, DEFAULT_REGISTER);
    const many = assessRegistration(segments, ink, TRUTH, { hypotheses: 1000, translationStepPx: null }, DEFAULT_REGISTER);
    expect(many.log10Nfa - one.log10Nfa).toBeCloseTo(3, 10);
  });

  it('πλήθος αρχών < 1 ή μη ακέραιο ⇒ RangeError, ποτέ σιωπηλό', () => {
    const ink = rasterize(segments, TRUTH, 3);
    expect(() => assessRegistration(segments, ink, TRUTH, { hypotheses: 0, translationStepPx: null }, DEFAULT_REGISTER)).toThrow(RangeError);
    expect(() => assessRegistration(segments, ink, TRUTH, { hypotheses: 1.5, translationStepPx: null }, DEFAULT_REGISTER)).toThrow(RangeError);
  });

  it('§6.9 #19: βήμα θέσεων 0 / αρνητικό / NaN / άπειρο ⇒ RangeError, ποτέ σιωπηλά λάθος N_tests', () => {
    const ink = rasterize(segments, TRUTH, 3);
    for (const translationStepPx of [0, -8, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => assessRegistration(segments, ink, TRUTH, { hypotheses: 1, translationStepPx }, DEFAULT_REGISTER)).toThrow(RangeError);
    }
  });

  it('§6.9 #19: απαρίθμηση θέσεων με βήμα 8 ⇒ NFA μικρότερο ακριβώς κατά 2·log₁₀(2R₀/8) (η μετάθεση μετρά ΜΙΑ φορά)', () => {
    const ink = rasterize(segments, TRUTH, 3);
    const plain = assessRegistration(segments, ink, TRUTH, ONE, DEFAULT_REGISTER);
    const stepped = assessRegistration(segments, ink, TRUTH, { hypotheses: 1, translationStepPx: 8 }, DEFAULT_REGISTER);
    expect(stepped.translationStepPx).toBe(8);
    expect(plain.log10Nfa - stepped.log10Nfa).toBeCloseTo(2 * Math.log10(48 / 8), 10);
  });

  it('🔴 §6.9 #19 (E4): δέκα αντίγραφα μιας παρειάς ΔΕΝ κάνουν το NFA πιο σημαντικό — πετυχαίνουν μαζί, μετρούν μία φορά', () => {
    const ink = rasterize(segments, TRUTH, 3);
    const copies = Array.from({ length: 10 }, (_, k) => ({ a: { x: segments[0].a.x, y: segments[0].a.y + k * 0.1 }, b: { x: segments[0].b.x, y: segments[0].b.y + k * 0.1 } }));
    const base = assessRegistration(segments, ink, TRUTH, ONE, DEFAULT_REGISTER);
    const dup = assessRegistration([...segments, ...copies], ink, TRUTH, ONE, DEFAULT_REGISTER);
    expect(dup.shiftNull.units).toBe(base.shiftNull.units);
    expect(Math.abs(dup.shiftNull.log10Tail - base.shiftNull.log10Tail)).toBeLessThan(1);
  });

  it('§6.9 #19: προεπιλεγμένα όρια — Lowe 0,59 δεκτό, 0,61 ambiguous', () => {
    const ink = rasterize(segments, TRUTH, 3);
    expect(DEFAULT_REGISTER.acceptance.maxAmbiguity).toBe(0.6);
    expect(DEFAULT_REGISTER.acceptance.minCoverage).toBe(0.3);
    expect(assessRegistration(segments, ink, TRUTH, ONE, DEFAULT_REGISTER, { ambiguityRatio: 0.59 }).verdict).toEqual({ kind: 'accepted' });
    expect(assessRegistration(segments, ink, TRUTH, ONE, DEFAULT_REGISTER, { ambiguityRatio: 0.61 }).verdict).toEqual({ kind: 'rejected', reason: 'ambiguous' });
  });
});

describe('independentUnits (ADR-929 §6.9 #19, E4)', () => {
  const probe = segmentProbe(rasterize([], IDENTITY, 1), 3, 3, DEFAULT_REGISTER);
  const seg = (ax: number, ay: number, bx: number, by: number): ImageSegment => {
    const s = toImageSegment(IDENTITY, { a: { x: ax, y: ay }, b: { x: bx, y: by } });
    if (s === null) throw new Error('degenerate test segment');
    return s;
  };

  it('δύο παρειές τοίχου 6 px (< 2r + W = 9) ⇒ ΜΙΑ μονάδα', () => {
    expect(independentUnits([seg(10, 20, 110, 20), seg(10, 26, 110, 26)], probe, DEFAULT_REGISTER)).toEqual([[0, 1]]);
  });

  it('κάθετα ⇒ δύο μονάδες · παράλληλα 30 px ⇒ δύο · παράλληλα χωρίς επικάλυψη ⇒ δύο', () => {
    expect(independentUnits([seg(10, 20, 110, 20), seg(10, 20, 10, 120)], probe, DEFAULT_REGISTER)).toEqual([[0], [1]]);
    expect(independentUnits([seg(10, 20, 110, 20), seg(10, 50, 110, 50)], probe, DEFAULT_REGISTER)).toEqual([[0], [1]]);
    expect(independentUnits([seg(10, 20, 110, 20), seg(200, 24, 300, 24)], probe, DEFAULT_REGISTER)).toEqual([[0], [1]]);
  });

  it('μεταβατικά: α~β, β~γ ⇒ μία μονάδα, ακόμη κι αν α, γ απέχουν > 2r + W', () => {
    const units = independentUnits([seg(10, 20, 110, 20), seg(10, 27, 110, 27), seg(10, 34, 110, 34)], probe, DEFAULT_REGISTER);
    expect(units).toEqual([[0, 1, 2]]);
  });
});

describe('registration-quality (ADR-929 §6.9 #9)', () => {
  const horizontal = (y: number): RegistrationSegment => ({ a: { x: 10, y }, b: { x: 110, y } });
  const vertical = (x: number): RegistrationSegment => ({ a: { x, y: 10 }, b: { x, y: 110 } });

  it('balance: μόνο οριζόντια ⇒ 0 · ίσο μήκος οριζόντια/κατακόρυφα ⇒ ½ · οι αποτυχίες δεν μετρούν · κανένα ⇒ null', () => {
    expect(measureBalance([outcome(horizontal(10), true), outcome(horizontal(50), true)])).toBeCloseTo(0, 12);
    expect(measureBalance([outcome(horizontal(10), true), outcome(vertical(10), true)])).toBeCloseTo(0.5, 12);
    expect(measureBalance([outcome(horizontal(10), true), outcome(vertical(10), false)])).toBeCloseTo(0, 12);
    expect(measureBalance([outcome(horizontal(10), false)])).toBeNull();
  });

  it('παράλληλη απόσταση: δύο παρειές 10 px ⇒ 10 · συνευθειακά ή χωρίς επικάλυψη ⇒ null', () => {
    expect(parallelSeparationPx([outcome(horizontal(20), true), outcome(horizontal(30), true)])).toBeCloseTo(10, 9);
    expect(parallelSeparationPx([outcome(horizontal(20), true), outcome(horizontal(20), true)])).toBeNull();
    const far: RegistrationSegment = { a: { x: 200, y: 30 }, b: { x: 300, y: 30 } };
    expect(parallelSeparationPx([outcome(horizontal(20), true), outcome(far, true)])).toBeNull();
  });

  it('clutter: κενή εικόνα ⇒ null · μόνο το σχέδιο ⇒ ~0', () => {
    const empty: InkMask = { mask: new Uint8Array(W * H), width: W, height: H };
    expect(measureClutter(planSegments(), empty, TRUTH, 3)).toBeNull();
    expect(measureClutter(planSegments(), rasterize(planSegments(), TRUTH, 3), TRUTH, 3)).toBeLessThan(0.05);
  });
});

describe('inkProbability / log10SearchSpace', () => {
  it('κενή εικόνα ⇒ 0 · γεμάτη ⇒ 1', () => {
    const empty: InkMask = { mask: new Uint8Array(W * H), width: W, height: H };
    const full: InkMask = { mask: new Uint8Array(W * H).fill(1), width: W, height: H };
    expect(inkProbability(chamferField(empty), 3)).toBe(0);
    expect(inkProbability(chamferField(full), 3)).toBe(1);
  });

  it('affine με ακτίνες 24 → 3, χωρίς απαρίθμηση θέσεων ⇒ 6·log₁₀16 · ομοιότητα ⇒ 4·log₁₀16', () => {
    expect(log10SearchSpace(DEFAULT_REGISTER, null)).toBeCloseTo(6 * Math.log10(16), 10);
    expect(log10SearchSpace({ ...DEFAULT_REGISTER, fit: { ...DEFAULT_REGISTER.fit, model: 'similarity' } }, null)).toBeCloseTo(4 * Math.log10(16), 10);
  });

  it('§6.9 #19: βήμα 8 ⇒ 2·log₁₀(8/3) + 4·log₁₀16 · βήμα ≥ 2R₀ ⇒ ίδιο με null · βήμα < r ⇒ ο όρος μετάθεσης 0', () => {
    expect(log10SearchSpace(DEFAULT_REGISTER, 8)).toBeCloseTo(2 * Math.log10(8 / 3) + 4 * Math.log10(16), 10);
    expect(log10SearchSpace(DEFAULT_REGISTER, 48)).toBeCloseTo(log10SearchSpace(DEFAULT_REGISTER, null), 10);
    expect(log10SearchSpace(DEFAULT_REGISTER, 500)).toBeCloseTo(log10SearchSpace(DEFAULT_REGISTER, null), 10);
    expect(log10SearchSpace(DEFAULT_REGISTER, 2)).toBeCloseTo(4 * Math.log10(16), 10);
  });
});
