/**
 * Tests for the grip-drag step-snap pure core (SNAP-MODE / F9).
 * `applyGripStepSnap` (the cadToggleState-reading wrapper) is covered by its
 * consumers' integration tests; here we pin the deterministic math.
 */

import { quantizeValueToStep, quantizeDeltaToStep } from '../grip-step-quantize';

describe('quantizeValueToStep', () => {
  it('rounds to the nearest multiple of the step', () => {
    expect(quantizeValueToStep(0, 50)).toBe(0);
    expect(quantizeValueToStep(24, 50)).toBe(0);
    expect(quantizeValueToStep(25, 50)).toBe(50);
    expect(quantizeValueToStep(74, 50)).toBe(50);
    expect(quantizeValueToStep(75, 50)).toBe(100);
  });

  it('handles negative displacements', () => {
    expect(quantizeValueToStep(-24, 50)).toBe(-0);
    expect(quantizeValueToStep(-26, 50)).toBe(-50);
    expect(quantizeValueToStep(-130, 50)).toBe(-150);
  });

  it('is a no-op for a non-positive step', () => {
    expect(quantizeValueToStep(137, 0)).toBe(137);
    expect(quantizeValueToStep(137, -10)).toBe(137);
  });

  it('passes non-finite values through unchanged', () => {
    expect(quantizeValueToStep(Number.NaN, 50)).toBeNaN();
    expect(quantizeValueToStep(Number.POSITIVE_INFINITY, 50)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('quantizeDeltaToStep', () => {
  it('quantizes both axes independently', () => {
    expect(quantizeDeltaToStep({ x: 124, y: -76 }, 50)).toEqual({ x: 100, y: -100 });
  });

  it('returns a copy unchanged when the step is non-positive', () => {
    const delta = { x: 13, y: 47 };
    expect(quantizeDeltaToStep(delta, 0)).toEqual(delta);
    expect(quantizeDeltaToStep(delta, 0)).not.toBe(delta);
  });

  it('snaps a clean multiple to itself (idempotent on grid)', () => {
    expect(quantizeDeltaToStep({ x: 150, y: 300 }, 50)).toEqual({ x: 150, y: 300 });
  });
});
