/**
 * ADR-508 §column place+rotate — columnRotationDeg: γωνία 2ου κλικ (κλειδωμένη θέση → target).
 */

import { columnRotationDeg } from '../column-rotation';

describe('columnRotationDeg', () => {
  const O = { x: 100, y: 100 };
  it('+X → 0°', () => expect(columnRotationDeg(O, { x: 200, y: 100 })).toBeCloseTo(0));
  it('+Y → 90°', () => expect(columnRotationDeg(O, { x: 100, y: 200 })).toBeCloseTo(90));
  it('−X → 180°', () => expect(Math.abs(columnRotationDeg(O, { x: 0, y: 100 }))).toBeCloseTo(180));
  it('−Y → −90°', () => expect(columnRotationDeg(O, { x: 100, y: 0 })).toBeCloseTo(-90));
  it('διαγώνια +45°', () => expect(columnRotationDeg(O, { x: 200, y: 200 })).toBeCloseTo(45));
  it('συμπίπτον → 0 (degenerate)', () => expect(columnRotationDeg(O, { x: 100, y: 100 })).toBe(0));
});
