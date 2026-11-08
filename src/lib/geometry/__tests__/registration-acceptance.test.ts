/**
 * ADR-929 §6.9 #7 + #9 — αποδοχή καταγραφής: NFA a-contrario **ανά τμήμα** με εμπειρική H0, κάλυψη μήκους, ανάλυση,
 * clutter, balance, και υπόλοιπα χωρίς αποκοπή.
 * 🔴 Τα σενάρια που έδειξε η μέτρηση: §6.9 #6 «p95 ≤ 2 px» πάνω σε τυχαίο μελάνι · §6.9 #8 το NFA ανά δείγμα δεχόταν
 * λάθος κατόψεις (τα δείγματα ενός τοίχου δεν είναι ανεξάρτητα) και σελίδες 10 DPI (παρειές < 2r+1 px).
 */

import { describe, it, expect } from '@jest/globals';
import type { Affine2x3 } from '../affine-2x3';
import { log10BinomialTail } from '../../statistics/log-binomial-tail';
import {
  assessRegistration,
  inkProbability,
  log10SearchSpace,
  registerAndAssess,
} from '../registration/registration-acceptance';
import { chamferField, sampleSegments } from '../registration/chamfer-register';
import { toImageSegment, type SegmentOutcome } from '../registration/registration-null-model';
import { measureBalance, measureClutter, parallelSeparationPx } from '../registration/registration-quality';
import { DEFAULT_REGISTER, type InkMask, type RegistrationSegment } from '../registration/registration-types';
import { H, PERTURBED, planSegments, rasterize, TRUTH, W } from './registration-fixtures';

const IDENTITY: Affine2x3 = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

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
  });

  it('καμία υποψήφια αρχή ⇒ not-converged με λόγο', () => {
    expect(registerAndAssess(segments, ink, [], DEFAULT_REGISTER)).toEqual({ kind: 'not-converged', reason: 'no-candidates', round: 0 });
  });
});

describe('assessRegistration', () => {
  const segments = planSegments();

  it('τυχαίο μελάνι (το σενάριο του §6.9 #6) ⇒ not-meaningful', () => {
    const a = assessRegistration(segments, randomInk(40, 7), TRUTH, 1, DEFAULT_REGISTER);
    expect(a.segments.segments).toBe(segments.length);
    expect(a.verdict).toEqual({ kind: 'rejected', reason: 'not-meaningful' });
  });

  it('πυκνή γραμμοσκίαση (p → 1) ⇒ not-meaningful, όσα κι αν «βρει»', () => {
    const a = assessRegistration(segments, hatching(), TRUTH, 1, DEFAULT_REGISTER);
    expect(a.inkProbability).toBeGreaterThan(0.95);
    expect(a.segments.pMax).toBeGreaterThan(0.9);
    expect(a.verdict).toEqual({ kind: 'rejected', reason: 'not-meaningful' });
  });

  it('🔴 §6.9 #8: συσχετισμένα δείγματα — λάθος σχέδιο πάνω σε δομή ⇒ not-meaningful, ενώ το NFA ανά δείγμα θα το δεχόταν', () => {
    // Τρεις οριζόντιοι «τοίχοι» που πέφτουν πάνω σε γραμμές ριγέ χαρτιού: κάθε δείγμα πετυχαίνει, αλλά είναι ΤΡΙΑ γεγονότα.
    const walls: RegistrationSegment[] = [0, 50, 100].map((y) => ({ a: { x: 0, y }, b: { x: 150, y } }));
    const t: Affine2x3 = { a: 2, b: 0, c: 0, d: 2, e: 20, f: 20 };
    const ink = linedPaper();
    const a = assessRegistration(walls, ink, t, 1, DEFAULT_REGISTER);
    expect(a.segments.hits).toBe(3);
    expect(a.verdict).toEqual({ kind: 'rejected', reason: 'not-meaningful' });
    // Το κριτήριο του #7: ανεξάρτητα δείγματα με βήμα ≥ 2r, p = πυκνότητα μελανιού.
    const independent = sampleSegments(walls, t, { ...DEFAULT_REGISTER, sampleStepPx: 6 });
    const oldNfa = log10SearchSpace(DEFAULT_REGISTER) + log10BinomialTail(independent.length, independent.length, a.inkProbability);
    expect(oldNfa).toBeLessThan(0);
  });

  it('ταιριάζει μόνο το εξωτερικό πλαίσιο ⇒ rejected, με κάλυψη κάτω από το κατώφλι', () => {
    const frameOnly = rasterize(segments.slice(0, 4), TRUTH, 3);
    const a = assessRegistration(segments, frameOnly, TRUTH, 1, DEFAULT_REGISTER);
    expect(a.coverage).toBeLessThan(DEFAULT_REGISTER.acceptance.minCoverage);
    expect(a.verdict.kind).toBe('rejected');
  });

  it('🔴 §6.9 #8: σελίδα χαμηλής ανάλυσης — οι διπλές γραμμές απέχουν 6 px < 2r+1 ⇒ unresolvable', () => {
    const small: Affine2x3 = { a: 1, b: 0, c: 0, d: 1, e: 30, f: 30 };
    const a = assessRegistration(segments, rasterize(segments, small, 1), small, 1, DEFAULT_REGISTER);
    expect(a.quality.parallelSeparationPx).toBeCloseTo(6, 6);
    expect(a.quality.resolvablePx).toBe(7);
    expect(a.verdict).toEqual({ kind: 'rejected', reason: 'unresolvable' });
  });

  it('επιπλέον μελάνι που το σχέδιο δεν εξηγεί ⇒ μεγάλο clutter· με κατώφλι ⇒ η καθαρή εικόνα μένει accepted', () => {
    const clean = rasterize(segments, TRUTH, 3);
    const noisy = union(clean, randomInk(40, 7));
    const c = assessRegistration(segments, clean, TRUTH, 1, DEFAULT_REGISTER);
    const n = assessRegistration(segments, noisy, TRUTH, 1, DEFAULT_REGISTER);
    expect(c.quality.clutter).toBeLessThan(0.05);
    expect(n.quality.clutter).toBeGreaterThan(0.3);
    const strict = { ...DEFAULT_REGISTER, acceptance: { ...DEFAULT_REGISTER.acceptance, maxClutter: 0.2 } };
    expect(assessRegistration(segments, clean, TRUTH, 1, strict).verdict).toEqual({ kind: 'accepted' });
  });

  it('μετατόπιση 5 px ⇒ τα υπόλοιπα αξιολόγησης λένε ~5 px (το κομμένο ICP θα έλεγε < 3)', () => {
    // Μία γραμμή κάθετη στη μετατόπιση: χωρίς άκρα που να «βρίσκουν» γειτονική γραμμή.
    const line: RegistrationSegment[] = [{ a: { x: 50, y: 10 }, b: { x: 50, y: 120 } }];
    const ink = rasterize(line, TRUTH, 3);
    const shifted: Affine2x3 = { ...TRUTH, e: TRUTH.e + 5 };
    const { evaluation } = assessRegistration(line, ink, shifted, 1, DEFAULT_REGISTER);
    expect(evaluation.found).toBe(evaluation.samples);
    expect(evaluation.residuals.p95Px).toBeGreaterThan(4.5);
    expect(evaluation.residuals.maxPx).toBeLessThan(5.5);
    expect(evaluation.nearRadiusShare).toBe(0);
  });

  it('περισσότερες αρχές ⇒ NFA μεγαλύτερο ακριβώς κατά log₁₀ του λόγου', () => {
    const ink = rasterize(segments, TRUTH, 3);
    const one = assessRegistration(segments, ink, TRUTH, 1, DEFAULT_REGISTER);
    const many = assessRegistration(segments, ink, TRUTH, 1000, DEFAULT_REGISTER);
    expect(many.log10Nfa - one.log10Nfa).toBeCloseTo(3, 10);
  });

  it('πλήθος αρχών < 1 ή μη ακέραιο ⇒ RangeError, ποτέ σιωπηλό', () => {
    const ink = rasterize(segments, TRUTH, 3);
    expect(() => assessRegistration(segments, ink, TRUTH, 0, DEFAULT_REGISTER)).toThrow(RangeError);
    expect(() => assessRegistration(segments, ink, TRUTH, 1.5, DEFAULT_REGISTER)).toThrow(RangeError);
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

  it('affine με ακτίνες 24 → 3 ⇒ 6·log₁₀16 · ομοιότητα ⇒ 4·log₁₀16', () => {
    expect(log10SearchSpace(DEFAULT_REGISTER)).toBeCloseTo(6 * Math.log10(16), 10);
    expect(log10SearchSpace({ ...DEFAULT_REGISTER, fit: { ...DEFAULT_REGISTER.fit, model: 'similarity' } })).toBeCloseTo(4 * Math.log10(16), 10);
  });
});
