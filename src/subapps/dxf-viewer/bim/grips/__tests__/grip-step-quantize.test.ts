/**
 * Tests for the grip-drag step-snap pure core (SNAP-MODE / F9).
 * `applyGripStepSnap` (the cadToggleState-reading wrapper) is covered by its
 * consumers' integration tests; here we pin the deterministic math.
 */

import { quantizeValueToStep, quantizeDeltaToStep, applyGripStepSnap, isGripStepActive } from '../grip-step-quantize';
import { cadToggleState } from '../../../systems/constraints/cad-toggle-state';
import { immediateSceneScale } from '../../../systems/cursor/ImmediateSceneScaleStore';
import { QKeyTracker } from '../../../keyboard/QKeyTracker';

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

describe('applyGripStepSnap — activation wiring (F9 toggle + Q hold + unit scale)', () => {
  afterEach(() => {
    cadToggleState.setSnap(false, 0);
    immediateSceneScale.set(1);
    QKeyTracker._setForTest(false);
  });

  it('steps only when SNAP is armed AND Q is held', () => {
    immediateSceneScale.set(1); // mm scene
    // SNAP off + Q off → free
    cadToggleState.setSnap(false, 100);
    QKeyTracker._setForTest(false);
    expect(applyGripStepSnap({ x: 137, y: -212 })).toEqual({ x: 137, y: -212 });

    // SNAP on but Q NOT held → still free (default-free model)
    cadToggleState.setSnap(true, 100);
    expect(applyGripStepSnap({ x: 137, y: -212 })).toEqual({ x: 137, y: -212 });

    // SNAP on + Q held → step to multiples of 100
    QKeyTracker._setForTest(true);
    expect(applyGripStepSnap({ x: 137, y: -212 })).toEqual({ x: 100, y: -200 });
  });

  it('converts the mm step to scene units (metre-scale drawing)', () => {
    cadToggleState.setSnap(true, 100); // 100 mm
    QKeyTracker._setForTest(true);
    immediateSceneScale.set(0.001); // metre scene: 1 canvas unit = 1 m
    // step = 100mm = 0.1 canvas units → a 0.137-unit drag snaps to 0.1.
    const r = applyGripStepSnap({ x: 0.137, y: -0.212 });
    expect(r.x).toBeCloseTo(0.1);
    expect(r.y).toBeCloseTo(-0.2);
  });
});

describe('isGripStepActive — SSoT gate for ghost + crosshair snap-to-grid', () => {
  afterEach(() => {
    cadToggleState.setSnap(false, 0);
    QKeyTracker._setForTest(false);
  });

  it('is true only when SNAP (F9) is armed AND Q is held', () => {
    cadToggleState.setSnap(false, 50);
    QKeyTracker._setForTest(false);
    expect(isGripStepActive()).toBe(false);

    cadToggleState.setSnap(true, 50); // F9 on, Q off
    expect(isGripStepActive()).toBe(false);

    QKeyTracker._setForTest(true); // F9 off path: Q on but SNAP off
    cadToggleState.setSnap(false, 50);
    expect(isGripStepActive()).toBe(false);

    cadToggleState.setSnap(true, 50); // both on
    expect(isGripStepActive()).toBe(true);
  });

  it('agrees with applyGripStepSnap engagement (lockstep, no disagreement)', () => {
    immediateSceneScale.set(1);
    cadToggleState.setSnap(true, 100);
    QKeyTracker._setForTest(true);
    // active → both quantize
    expect(isGripStepActive()).toBe(true);
    expect(applyGripStepSnap({ x: 137, y: 0 })).toEqual({ x: 100, y: 0 });
    // release Q → both disengage
    QKeyTracker._setForTest(false);
    expect(isGripStepActive()).toBe(false);
    expect(applyGripStepSnap({ x: 137, y: 0 })).toEqual({ x: 137, y: 0 });
  });
});
