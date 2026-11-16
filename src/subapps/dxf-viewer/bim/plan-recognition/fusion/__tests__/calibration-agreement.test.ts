/**
 * ⚓ ADR-929 §6.23 — το ολικό τεστ χ² της υπάρχουσας βαθμονόμησης απέναντι στις γραμμένες διαστάσεις.
 *
 * Η ζωντανή περίπτωση του ΤΕΣΤ2: «4.12» −3 mm και «2.05» −1 mm, γραμμένες με εκατοστό ⇒ **μέσα** στην ακρίβεια.
 * Η ίδια απόκλιση 10× μεγαλύτερη ⇒ **έξω**. Το κατώφλι είναι το ΙΔΙΟ με το ολικό
 * τεστ της συνόρθωσης (`chiSquareQuantile`, `Z_95`).
 */

import { describe, expect, it } from '@jest/globals';
import { chiSquareQuantile, Z_95 } from '@/lib/linear-algebra/weighted-least-squares';
import { calibrationAgreement } from '../calibration-agreement';
import { dimensionSigmaMm } from '../dimension-precision';
import { DEFAULT_PLAN_FUSION } from '../plan-fusion-types';
import type { FusedDimension, FusedDimensionStatus } from '../plan-fusion-types';

const RECT = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
const DRAFT = DEFAULT_PLAN_FUSION.dimensionDraftSigmaMm;

function fused(textId: string, valueMm: number, misfitMm: number, precisionMm: number, status: FusedDimensionStatus = 'consistent'): FusedDimension {
  return {
    textId, valueMm, precisionMm, sigmaMm: dimensionSigmaMm(precisionMm, DRAFT),
    binding: null, measuredMm: valueMm + misfitMm, adjustedMm: null, w: null, redundancy: null,
    detectableErrorMm: null, status, confidence: { score: 1, factors: {} }, rect: RECT,
  };
}

describe('calibrationAgreement — ολικό τεστ χ² (§6.23)', () => {
  it('ΤΕΣΤ2: −3 mm στο «4.12» και −1 mm στο «2.05» (εκατοστό) ⇒ μέσα στην ακρίβεια', () => {
    const a = calibrationAgreement([fused('a', 4120, -3, 10), fused('b', 2050, -1, 10)]);
    expect(a?.withinPrecision).toBe(true);
    expect(a?.degreesOfFreedom).toBe(2);
    expect(a?.critical).toBeCloseTo(chiSquareQuantile(2, Z_95), 12);
    expect(a?.maxDeviationRel).toBeCloseTo(3 / 4120, 12);
  });

  it('🔴 η ίδια απόκλιση ×10 ⇒ έξω από την ακρίβεια (αξίζει ευθυγράμμιση)', () => {
    const a = calibrationAgreement([fused('a', 4120, -30, 10), fused('b', 2050, -10, 10)]);
    expect(a?.withinPrecision).toBe(false);
  });

  it('το στατιστικό είναι Σ (υπόλοιπο/σ)² με το σ ΤΗΣ διάστασης (γραφή ⊕ σχεδίαση)', () => {
    const rows = [fused('a', 4120, -3, 10), fused('b', 3325, 2, 1)];
    const expected = (3 / dimensionSigmaMm(10, DRAFT)) ** 2 + (2 / dimensionSigmaMm(1, DRAFT)) ** 2;
    expect(calibrationAgreement(rows)?.statistic).toBeCloseTo(expected, 12);
  });

  it('μετράνε ΜΟΝΟ οι διαστάσεις που η συνόρθωση κράτησε (consistent, με μέτρηση)', () => {
    const conflict = fused('c', 5000, 400, 10, 'conflict');
    const unmeasured: FusedDimension = { ...fused('d', 3000, 0, 10), measuredMm: null };
    const a = calibrationAgreement([fused('a', 4120, -3, 10), conflict, unmeasured]);
    expect(a?.rows.map((r) => r.textId)).toEqual(['a']);
    expect(a?.withinPrecision).toBe(true);
  });

  it('καμία ελεγχόμενη διάσταση ⇒ `null` (δεν υπάρχει τεστ χωρίς παρατηρήσεις)', () => {
    expect(calibrationAgreement([])).toBeNull();
    expect(calibrationAgreement([fused('c', 5000, 0, 10, 'uncheckable')])).toBeNull();
  });
});
