/**
 * ADR-507 Φ3 — tests για το hatch pick-mode store (Τρόπος Α boundary ⇄ Τρόπος Β pick-point).
 */

import {
  getHatchPickMode,
  setHatchPickMode,
  subscribeHatchPickMode,
  resetHatchPickMode,
} from '../hatch-pick-mode-store';

describe('hatch-pick-mode-store', () => {
  beforeEach(() => resetHatchPickMode());

  it('defaults to pick-point (AutoCAD BHATCH)', () => {
    expect(getHatchPickMode()).toBe('pick-point');
  });

  it('switches to boundary and back', () => {
    setHatchPickMode('boundary');
    expect(getHatchPickMode()).toBe('boundary');
    setHatchPickMode('pick-point');
    expect(getHatchPickMode()).toBe('pick-point');
  });

  it('notifies subscribers only on real changes', () => {
    let calls = 0;
    const unsub = subscribeHatchPickMode(() => { calls++; });
    setHatchPickMode('boundary');
    expect(calls).toBe(1);
    // No-op set (same value) → no notification.
    setHatchPickMode('boundary');
    expect(calls).toBe(1);
    unsub();
    setHatchPickMode('pick-point');
    expect(calls).toBe(1);
  });
});
