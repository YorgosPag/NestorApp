/**
 * ADR-508 §column place+rotate — columnRotationDeg: γωνία 2ου κλικ (κλειδωμένη θέση → target).
 */

import { columnRotationDeg, adaptiveRotationStepDeg, resolveColumnRotationDeg } from '../column-rotation';

describe('columnRotationDeg', () => {
  const O = { x: 100, y: 100 };
  it('+X → 0°', () => expect(columnRotationDeg(O, { x: 200, y: 100 })).toBeCloseTo(0));
  it('+Y → 90°', () => expect(columnRotationDeg(O, { x: 100, y: 200 })).toBeCloseTo(90));
  it('−X → 180°', () => expect(Math.abs(columnRotationDeg(O, { x: 0, y: 100 }))).toBeCloseTo(180));
  it('−Y → −90°', () => expect(columnRotationDeg(O, { x: 100, y: 0 })).toBeCloseTo(-90));
  it('διαγώνια +45°', () => expect(columnRotationDeg(O, { x: 200, y: 200 })).toBeCloseTo(45));
  it('συμπίπτον → 0 (degenerate)', () => expect(columnRotationDeg(O, { x: 100, y: 100 })).toBe(0));
});

describe('adaptiveRotationStepDeg + resolveColumnRotationDeg (zoom-adaptive βήμα)', () => {
  it('λεπτό βήμα σε μεγέθυνση, χονδρό σε σμίκρυνση', () => {
    expect(adaptiveRotationStepDeg(0.5)).toBe(1);
    expect(adaptiveRotationStepDeg(3)).toBe(5);
    expect(adaptiveRotationStepDeg(10)).toBe(10);
    expect(adaptiveRotationStepDeg(50)).toBe(15);
  });
  it('κουμπώνει τη γωνία στο βήμα (47° @ βήμα 5 → 45°)', () => {
    // wpp=3 → step 5°. raw ≈ 46.8° (atan2 1.06) → 45°.
    const deg = resolveColumnRotationDeg({ x: 0, y: 0 }, { x: 100, y: 106 }, 3);
    expect(deg % 5).toBe(0);
    expect(deg).toBeCloseTo(45);
  });
});
