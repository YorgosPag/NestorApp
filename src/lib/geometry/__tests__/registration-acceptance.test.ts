/**
 * ADR-929 §6.9 #7 — αποδοχή καταγραφής: NFA a-contrario + κάλυψη + υπόλοιπα χωρίς αποκοπή.
 * 🔴 Το σενάριο που έδειξε η μέτρηση (§6.9 #6): «p95 ≤ 2 px» πάνω σε **τυχαίο** μελάνι. Εδώ πρέπει να βγει `rejected`.
 */

import { describe, it, expect } from '@jest/globals';
import type { Affine2x3 } from '../affine-2x3';
import {
  assessRegistration,
  inkProbability,
  log10SearchSpace,
  registerAndAssess,
} from '../registration/registration-acceptance';
import { chamferField } from '../registration/chamfer-register';
import { DEFAULT_REGISTER, type InkMask, type RegistrationSegment } from '../registration/registration-types';
import { H, PERTURBED, planSegments, rasterize, TRUTH, W } from './registration-fixtures';

/** Ντετερμινιστικές «τυχαίες» γραμμές (LCG): μελάνι που ΔΕΝ είναι το σχέδιο. */
function randomInk(count: number, seed: number): InkMask {
  let s = seed;
  const next = (): number => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  const segs: RegistrationSegment[] = Array.from({ length: count }, () => ({
    a: { x: next() * W, y: next() * H },
    b: { x: next() * W, y: next() * H },
  }));
  return rasterize(segs, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, 2);
}

/** Πυκνή γραμμοσκίαση: κατακόρυφες γραμμές 1 px κάθε 5 px σε όλη την εικόνα. */
function hatching(): InkMask {
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x += 5) mask[y * W + x] = 1;
  return { mask, width: W, height: H };
}

describe('registerAndAssess', () => {
  const segments = planSegments();
  const ink = rasterize(segments, TRUTH, 3);

  it('σωστή καταγραφή ⇒ accepted, με υπόλοιπα αξιολόγησης που ΔΕΝ ακουμπούν την ακτίνα', () => {
    const r = registerAndAssess(segments, ink, [PERTURBED], DEFAULT_REGISTER);
    if (r.kind !== 'registered') throw new Error(`expected registered, got ${r.reason}`);
    expect(r.assessment.verdict).toEqual({ kind: 'accepted' });
    expect(r.assessment.log10Nfa).toBeLessThan(-50);
    expect(r.assessment.coverage).toBeGreaterThan(0.9);
    expect(r.assessment.evaluation.residuals.p95Px).toBeLessThan(1);
    expect(r.assessment.evaluation.nearRadiusShare).toBe(0);
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
    expect(a.hits).toBeGreaterThan(0);
    expect(a.verdict).toEqual({ kind: 'rejected', reason: 'not-meaningful' });
  });

  it('πυκνή γραμμοσκίαση (p → 1) ⇒ not-meaningful, όσα κι αν «βρει»', () => {
    const ink = hatching();
    const a = assessRegistration(segments, ink, TRUTH, 1, DEFAULT_REGISTER);
    expect(a.inkProbability).toBeGreaterThan(0.95);
    expect(a.verdict).toEqual({ kind: 'rejected', reason: 'not-meaningful' });
  });

  it('ταιριάζει μόνο το εξωτερικό πλαίσιο ⇒ low-coverage, παρότι δεν είναι σύμπτωση', () => {
    const frameOnly = rasterize(segments.slice(0, 4), TRUTH, 3);
    const a = assessRegistration(segments, frameOnly, TRUTH, 1, DEFAULT_REGISTER);
    expect(a.log10Nfa).toBeLessThan(0);
    expect(a.coverage).toBeLessThan(DEFAULT_REGISTER.acceptance.minCoverage);
    expect(a.verdict).toEqual({ kind: 'rejected', reason: 'low-coverage' });
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
