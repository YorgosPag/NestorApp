/**
 * ADR-422 L1.6 — tests για την EN ISO 13370 ground coupling (πλάκα επί εδάφους).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 *
 * Όλες οι αναμενόμενες τιμές παράγονται από τον τύπο με τις τελικές σταθερές
 * (λ_g=2.0, R_si=0.17, R_se=0.04, w=0.30, U_floor=0.5 → R_f=2.0 → d_t=4.72 m).
 */

import {
  computeCharacteristicDimension,
  computeEquivalentThickness,
  computeGroundFloorUValue,
  computeGroundUValue,
  type GroundFloorCouplingInput,
} from '../ground-coupling';

// Τελικές σταθερές (mirror heat-load-config + annual-gains-config R_se).
const LAMBDA_G = 2.0;
const R_SI = 0.17;
const R_SE = 0.04;
const W = 0.3;
const U_FLOOR = 0.5; // R_f = 1/0.5 = 2.0
const D_T = 4.72; // 0.30 + 2.0·(0.17 + 2.0 + 0.04)

/** Πλήρες input με τις τελικές σταθερές για δοθέν A, P. */
function makeInput(areaM2: number, exposedPerimeterM: number): GroundFloorCouplingInput {
  return {
    areaM2,
    exposedPerimeterM,
    floorUValueWperM2K: U_FLOOR,
    wallThicknessM: W,
    soilConductivityWperMK: LAMBDA_G,
    internalSurfaceResistanceM2KperW: R_SI,
    externalSurfaceResistanceM2KperW: R_SE,
  };
}

describe('computeCharacteristicDimension — B′ = A/(0.5·P)', () => {
  it('4×4 (A=16, P=16) → B′=2.0 m', () => {
    expect(computeCharacteristicDimension(16, 16)).toBeCloseTo(2.0, 6);
  });

  it('20×20 (A=400, P=80) → B′=10.0 m', () => {
    expect(computeCharacteristicDimension(400, 80)).toBeCloseTo(10.0, 6);
  });

  it('degenerate P≤0 ή A≤0 → NaN (guard)', () => {
    expect(Number.isNaN(computeCharacteristicDimension(16, 0))).toBe(true);
    expect(Number.isNaN(computeCharacteristicDimension(16, -5))).toBe(true);
    expect(Number.isNaN(computeCharacteristicDimension(0, 16))).toBe(true);
  });
});

describe('computeEquivalentThickness — d_t = w + λ·(R_si+R_f+R_se)', () => {
  it('w=0.30, λ=2.0, R_si=0.17, R_f=2.0, R_se=0.04 → d_t=4.72 m', () => {
    expect(computeEquivalentThickness(W, LAMBDA_G, R_SI, 2.0, R_SE)).toBeCloseTo(D_T, 6);
  });
});

describe('computeGroundUValue — two-branch (EN ISO 13370 §9.3)', () => {
  it('d_t≥B′ (καλά μονωμένο): B′=2.0, d_t=4.72 → U_g=2.0/(0.457·2+4.72)≈0.3550', () => {
    expect(computeGroundUValue(2.0, D_T, LAMBDA_G)).toBeCloseTo(0.35499, 4);
  });

  it('d_t<B′ (αμόνωτο/μέτρια): B′=10, d_t=4.72 → branch-1 ≈0.2253', () => {
    // (4.0/(π·10+4.72))·ln(π·10/4.72+1) = 0.110689·2.03557
    expect(computeGroundUValue(10, D_T, LAMBDA_G)).toBeCloseTo(0.22532, 4);
  });

  it('threshold: ίδιο B′=d_t δίνει συνεχή τιμή κοντά στα δύο branches', () => {
    const atThreshold = computeGroundUValue(D_T, D_T, LAMBDA_G); // d_t≥B′ branch
    const justBelow = computeGroundUValue(D_T + 1e-6, D_T, LAMBDA_G); // d_t<B′ branch
    expect(atThreshold).toBeCloseTo(justBelow, 3);
  });
});

describe('computeGroundFloorUValue — orchestrator + edge effect', () => {
  it('4×4 συμπαγές → U_g≈0.3550 (edge-dominated, +42% vs flat 0.25)', () => {
    expect(computeGroundFloorUValue(makeInput(16, 16))).toBeCloseTo(0.35499, 4);
  });

  it('20×20 μεγάλο → U_g≈0.2253 (−10% vs flat 0.25)', () => {
    expect(computeGroundFloorUValue(makeInput(400, 80))).toBeCloseTo(0.22532, 4);
  });

  it('10×10 μεσαίο → U_g≈0.2869', () => {
    expect(computeGroundFloorUValue(makeInput(100, 40))).toBeCloseTo(0.28686, 4);
  });

  it('edge effect: στενόμακρο 2×20 > συμπαγές 4×4 > μεσαίο 10×10 > μεγάλο 20×20', () => {
    const strip = computeGroundFloorUValue(makeInput(40, 44))!; // B′=1.818
    const compact = computeGroundFloorUValue(makeInput(16, 16))!; // B′=2.0
    const medium = computeGroundFloorUValue(makeInput(100, 40))!; // B′=5
    const large = computeGroundFloorUValue(makeInput(400, 80))!; // B′=10
    expect(strip).toBeGreaterThan(compact);
    expect(compact).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(large);
    expect(strip).toBeCloseTo(0.3603, 3);
  });

  it('degenerate P≤0 (πλήρως εσωτερικό/άγνωστο) → null (fallback flat στον caller)', () => {
    expect(computeGroundFloorUValue(makeInput(20, 0))).toBeNull();
    expect(computeGroundFloorUValue(makeInput(20, -1))).toBeNull();
    expect(computeGroundFloorUValue(makeInput(0, 16))).toBeNull();
  });

  it('U_floor=0 (degenerate) → R_f=0, παραμένει πεπερασμένο θετικό U_g', () => {
    const u = computeGroundFloorUValue({ ...makeInput(16, 16), floorUValueWperM2K: 0 });
    expect(u).not.toBeNull();
    expect(u!).toBeGreaterThan(0);
  });
});
