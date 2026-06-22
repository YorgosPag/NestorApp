/**
 * Unit tests — applyLengthAngleLock (ADR-513 / ADR-357 G14): SSoT length/angle
 * constraint used by BOTH the rubber-band preview and the wall click-commit.
 */

import { applyLengthAngleLock } from '../length-angle-lock';
import { DynamicInputLockStore } from '../DynamicInputLockStore';

const REF = { x: 100, y: 100 };

describe('applyLengthAngleLock', () => {
  afterEach(() => DynamicInputLockStore.unlock());

  describe('no-op paths (zero regression when ring not used)', () => {
    it('returns the point unchanged when no lock is active', () => {
      const p = { x: 250, y: 180 };
      expect(applyLengthAngleLock(p, REF)).toEqual(p);
    });

    it('returns the point unchanged when ref is null', () => {
      DynamicInputLockStore.lockLength(500);
      const p = { x: 250, y: 180 };
      expect(applyLengthAngleLock(p, null)).toEqual(p);
    });

    it('returns a fresh object (never the same reference)', () => {
      const p = { x: 1, y: 2 };
      expect(applyLengthAngleLock(p, REF)).not.toBe(p);
    });
  });

  describe('length lock — keeps direction, fixes distance', () => {
    it('scales a horizontal point to the locked length', () => {
      DynamicInputLockStore.lockLength(500);
      const out = applyLengthAngleLock({ x: 300, y: 100 }, REF); // dir +x, dist 200
      expect(out.x).toBeCloseTo(600); // 100 + 500
      expect(out.y).toBeCloseTo(100);
    });

    it('preserves the angle while fixing the magnitude', () => {
      DynamicInputLockStore.lockLength(10);
      const out = applyLengthAngleLock({ x: 130, y: 140 }, REF); // dir (3,4)/5
      const dist = Math.hypot(out.x - REF.x, out.y - REF.y);
      expect(dist).toBeCloseTo(10);
      expect((out.y - REF.y) / (out.x - REF.x)).toBeCloseTo(4 / 3);
    });

    it('is a no-op for a degenerate (zero-distance) cursor', () => {
      DynamicInputLockStore.lockLength(500);
      expect(applyLengthAngleLock({ ...REF }, REF)).toEqual(REF);
    });
  });

  describe('angle lock — keeps distance, fixes heading', () => {
    it('rotates the point to the locked angle (0°)', () => {
      DynamicInputLockStore.lockAngle(0);
      const out = applyLengthAngleLock({ x: 100, y: 250 }, REF); // dist 150 along +y
      expect(out.x).toBeCloseTo(250); // 100 + 150 along +x
      expect(out.y).toBeCloseTo(100);
    });

    it('rotates to 90° keeping the radius', () => {
      DynamicInputLockStore.lockAngle(90);
      const out = applyLengthAngleLock({ x: 300, y: 100 }, REF); // dist 200 along +x
      expect(out.x).toBeCloseTo(100);
      expect(out.y).toBeCloseTo(300); // 100 + 200 along +y
    });
  });
});
