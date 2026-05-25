import { quantizeVec3, DEFAULT_SNAP_STEP, SNAP_STEP_PRESETS } from '../snap-quantizer';

describe('quantizeVec3', () => {
  describe('no-op cases', () => {
    it('returns v unchanged when step = 0', () => {
      const v = { x: 1.3, y: 2.7, z: -0.4 };
      expect(quantizeVec3(v, 0)).toBe(v);
    });

    it('returns v unchanged when step < 0', () => {
      const v = { x: 1.3, y: 2.7, z: -0.4 };
      expect(quantizeVec3(v, -1)).toBe(v);
    });
  });

  describe('step = 1 (integer rounding)', () => {
    it('rounds positive values', () => {
      expect(quantizeVec3({ x: 1.4, y: 2.6, z: 3.5 }, 1)).toEqual({ x: 1, y: 3, z: 4 });
    });

    it('rounds negative values', () => {
      // JS Math.round(-3.5) = -3 (rounds toward +Infinity), so use -3.6 for unambiguous -4
      expect(quantizeVec3({ x: -1.4, y: -2.6, z: -3.6 }, 1)).toEqual({ x: -1, y: -3, z: -4 });
    });

    it('leaves already-integer values unchanged', () => {
      expect(quantizeVec3({ x: 2, y: -3, z: 0 }, 1)).toEqual({ x: 2, y: -3, z: 0 });
    });
  });

  describe('step = 0.5 (half-step rounding)', () => {
    it('snaps 0.3 to 0.5', () => {
      const r = quantizeVec3({ x: 0.3, y: 0, z: 0 }, 0.5);
      expect(r.x).toBeCloseTo(0.5, 5);
    });

    it('snaps 0.74 to 0.5', () => {
      const r = quantizeVec3({ x: 0.74, y: 0, z: 0 }, 0.5);
      expect(r.x).toBeCloseTo(0.5, 5);
    });

    it('snaps 0.76 to 1.0', () => {
      const r = quantizeVec3({ x: 0.76, y: 0, z: 0 }, 0.5);
      expect(r.x).toBeCloseTo(1.0, 5);
    });

    it('handles negative values', () => {
      const r = quantizeVec3({ x: -0.3, y: -0.76, z: -1.24 }, 0.5);
      expect(r.x).toBeCloseTo(-0.5, 5);
      expect(r.y).toBeCloseTo(-1.0, 5);
      expect(r.z).toBeCloseTo(-1.0, 5);
    });
  });

  describe('step = 0.1 (small step)', () => {
    it('snaps 0.14 to 0.1', () => {
      const r = quantizeVec3({ x: 0.14, y: 0, z: 0 }, 0.1);
      expect(r.x).toBeCloseTo(0.1, 5);
    });

    it('snaps 0.16 to 0.2', () => {
      // 0.15 is a floating-point boundary case (0.15/0.1 ≈ 1.4999... → rounds to 1)
      // 0.16 is unambiguous: 0.16/0.1 = 1.6 → rounds to 2
      const r = quantizeVec3({ x: 0.16, y: 0, z: 0 }, 0.1);
      expect(r.x).toBeCloseTo(0.2, 5);
    });
  });

  describe('origin offset', () => {
    it('snaps relative to origin', () => {
      const origin = { x: 0.25, y: 0.25, z: 0.25 };
      const r = quantizeVec3({ x: 0.6, y: 0.6, z: 0.6 }, 0.5, origin);
      expect(r.x).toBeCloseTo(0.75, 5);
      expect(r.y).toBeCloseTo(0.75, 5);
      expect(r.z).toBeCloseTo(0.75, 5);
    });
  });

  describe('idempotency', () => {
    it('quantize(quantize(v)) === quantize(v) for step=0.5', () => {
      const v = { x: 1.3, y: -2.7, z: 0.8 };
      const once = quantizeVec3(v, 0.5);
      const twice = quantizeVec3(once, 0.5);
      expect(twice.x).toBeCloseTo(once.x, 10);
      expect(twice.y).toBeCloseTo(once.y, 10);
      expect(twice.z).toBeCloseTo(once.z, 10);
    });
  });

  describe('large coordinates', () => {
    it('handles very large coordinate values', () => {
      const r = quantizeVec3({ x: 1000.3, y: -9999.7, z: 50000.1 }, 1.0);
      expect(r.x).toBeCloseTo(1000, 5);
      expect(r.y).toBeCloseTo(-10000, 5);
      expect(r.z).toBeCloseTo(50000, 5);
    });
  });
});

describe('SNAP_STEP_PRESETS', () => {
  it('contains DEFAULT_SNAP_STEP', () => {
    expect(SNAP_STEP_PRESETS).toContain(DEFAULT_SNAP_STEP);
  });

  it('all presets are positive', () => {
    for (const step of SNAP_STEP_PRESETS) {
      expect(step).toBeGreaterThan(0);
    }
  });
});
