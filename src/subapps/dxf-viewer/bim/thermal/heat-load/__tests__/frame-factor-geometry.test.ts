/**
 * ADR-422 L7.5 — tests για τον γεωμετρικό συντελεστή πλαισίου `F_F` (pure).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 *
 * F_F = (W−2f)(H−2f)/(W·H) (EN ISO 13790 §11.3.2). Worked: 1000×1400, f=50 →
 * glass 900×1300 = 1.17e6 / 1.4e6 = 0.835714. Επιβεβαιώνει: μονοτονία (μεγαλύτερη
 * κάσα → μικρότερο F_F), f=0 → 1.0, guards (W≤2f / H≤2f / degenerate → floor),
 * clamp ∈ (0,1].
 */

import { computeFrameFactor } from '../frame-factor-geometry';

describe('computeFrameFactor', () => {
  it('τυπικό παράθυρο 1000×1400, κάσα 50mm → glass 900×1300 → 0.8357', () => {
    expect(computeFrameFactor(1000, 1400, 50)).toBeCloseTo(0.835714, 5);
  });

  it('μηδενική κάσα (f=0) → όλο τζάμι → F_F = 1.0', () => {
    expect(computeFrameFactor(1200, 1400, 0)).toBeCloseTo(1.0, 6);
  });

  it('φαρδιά κάσα δίνει μικρότερο F_F από λεπτή (μονοτονία)', () => {
    const thin = computeFrameFactor(1200, 1400, 40);
    const wide = computeFrameFactor(1200, 1400, 120);
    expect(wide).toBeLessThan(thin);
  });

  it('μονοτονία στο f: αύξηση κάσας μειώνει συνεχώς το F_F', () => {
    const f20 = computeFrameFactor(1500, 1500, 20);
    const f60 = computeFrameFactor(1500, 1500, 60);
    const f100 = computeFrameFactor(1500, 1500, 100);
    expect(f60).toBeLessThan(f20);
    expect(f100).toBeLessThan(f60);
  });

  it('τετράγωνο παράθυρο 1000×1000, κάσα 100 → glass 800×800 → 0.64', () => {
    expect(computeFrameFactor(1000, 1000, 100)).toBeCloseTo(0.64, 6);
  });

  it('guard: W ≤ 2f (κάσα καλύπτει όλο το πλάτος) → floor', () => {
    expect(computeFrameFactor(100, 1400, 60)).toBeCloseTo(0.01, 6);
  });

  it('guard: H ≤ 2f (κάσα καλύπτει όλο το ύψος) → floor', () => {
    expect(computeFrameFactor(1400, 100, 60)).toBeCloseTo(0.01, 6);
  });

  it('guard: degenerate άνοιγμα (W≤0 ή H≤0) → floor', () => {
    expect(computeFrameFactor(0, 1400, 50)).toBeCloseTo(0.01, 6);
    expect(computeFrameFactor(1400, 0, 50)).toBeCloseTo(0.01, 6);
  });

  it('clamp: το αποτέλεσμα μένει ∈ (0,1] για κάθε έγκυρη είσοδο', () => {
    const ff = computeFrameFactor(1200, 1400, 50);
    expect(ff).toBeGreaterThan(0);
    expect(ff).toBeLessThanOrEqual(1);
  });

  it('αρνητική κάσα αντιμετωπίζεται ως 0 (f≤0 → 1.0)', () => {
    expect(computeFrameFactor(1200, 1400, -30)).toBeCloseTo(1.0, 6);
  });
});
