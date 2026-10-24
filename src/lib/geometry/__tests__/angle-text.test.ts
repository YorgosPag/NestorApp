/**
 * ADR-920 Β4.8 — `normalizeTextAngle` στο ΕΝΑ σπίτι του (`@/lib/geometry/angle`): κείμενο που δεν διαβάζεται ποτέ ανάποδα.
 */

import { RIGHT_ANGLE, normalizeTextAngle } from '../angle';

/** Ίδια κατεύθυνση γραμμής: η γωνία ή η αντίθετή της (μια ετικέτα πάνω σε ισοϋψή δεν έχει φορά). */
function sameLine(a: number, b: number): boolean {
  return Math.abs(Math.sin(a - b)) < 1e-9;
}

describe('normalizeTextAngle', () => {
  it('RIGHT_ANGLE = π/2', () => {
    expect(RIGHT_ANGLE).toBe(Math.PI / 2);
  });

  it('κάθε γωνία του atan2 βγαίνει όρθια (δείχνει δεξιά) και πάνω στην ίδια γραμμή', () => {
    for (let deg = -179; deg <= 180; deg += 1) {
      const angle = (deg * Math.PI) / 180;
      const upright = normalizeTextAngle(angle);
      expect(Math.cos(upright)).toBeGreaterThanOrEqual(-1e-12);
      expect(sameLine(upright, angle)).toBe(true);
    }
  });

  it('μέχρι και ±90° μένει ως έχει· πέρα από αυτό στρίβει κατά π', () => {
    expect(normalizeTextAngle(Math.PI / 2)).toBe(Math.PI / 2);
    expect(normalizeTextAngle(-Math.PI / 2)).toBe(-Math.PI / 2);
    expect(normalizeTextAngle(Math.PI / 4)).toBe(Math.PI / 4);
    expect(normalizeTextAngle((-3 * Math.PI) / 4)).toBeCloseTo(Math.PI / 4, 12);
    expect(normalizeTextAngle(Math.PI)).toBeCloseTo(2 * Math.PI, 12);
  });
});
