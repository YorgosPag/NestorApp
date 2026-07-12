/**
 * Tests — ADR-510 Φ2 LinetypeScaleStore (LTSCALE).
 */

import {
  getLinetypeScale,
  getEffectiveLinetypeScale,
  setActiveSceneLinetypeScale,
  setLinetypeScale,
  resetLinetypeScale,
  subscribeLinetypeScale,
  DEFAULT_LTSCALE,
  __resetLinetypeScaleForTesting,
} from '../LinetypeScaleStore';

describe('LinetypeScaleStore', () => {
  beforeEach(() => {
    __resetLinetypeScaleForTesting();
  });

  it('defaults to the AutoCAD LTSCALE (1.0)', () => {
    expect(getLinetypeScale()).toBe(DEFAULT_LTSCALE);
  });

  it('sets and reads a positive scale', () => {
    setLinetypeScale(2.5);
    expect(getLinetypeScale()).toBe(2.5);
  });

  it('rejects non-positive / non-finite values (AutoCAD: LTSCALE > 0)', () => {
    setLinetypeScale(2);
    setLinetypeScale(0);
    setLinetypeScale(-1);
    setLinetypeScale(Number.NaN);
    setLinetypeScale(Number.POSITIVE_INFINITY);
    expect(getLinetypeScale()).toBe(2);
  });

  it('notifies subscribers on change', () => {
    let calls = 0;
    const unsub = subscribeLinetypeScale(() => {
      calls += 1;
    });
    setLinetypeScale(3);
    expect(calls).toBe(1);
    unsub();
    setLinetypeScale(4);
    expect(calls).toBe(1);
  });

  it('does not notify when the value is unchanged', () => {
    let calls = 0;
    setLinetypeScale(3);
    subscribeLinetypeScale(() => {
      calls += 1;
    });
    setLinetypeScale(3);
    expect(calls).toBe(0);
  });

  it('resets to the default', () => {
    setLinetypeScale(5);
    resetLinetypeScale();
    expect(getLinetypeScale()).toBe(DEFAULT_LTSCALE);
  });

  // ─── ADR-510 Φ2H — per-scene base × user knob ──────────────────────────────
  describe('effective LTSCALE (scene base × user knob)', () => {
    it('defaults to the user knob when no scene base is set', () => {
      setLinetypeScale(2);
      expect(getEffectiveLinetypeScale()).toBe(2);
    });

    it('composes the per-scene base with the user knob multiplicatively', () => {
      setActiveSceneLinetypeScale(30);
      setLinetypeScale(2);
      expect(getEffectiveLinetypeScale()).toBe(60);
    });

    it('undefined / non-positive scene base falls back to neutral 1', () => {
      setActiveSceneLinetypeScale(undefined);
      expect(getEffectiveLinetypeScale()).toBe(DEFAULT_LTSCALE);
      setActiveSceneLinetypeScale(0);
      expect(getEffectiveLinetypeScale()).toBe(DEFAULT_LTSCALE);
      setActiveSceneLinetypeScale(Number.NaN);
      expect(getEffectiveLinetypeScale()).toBe(DEFAULT_LTSCALE);
    });

    it('the user-knob getter never sees the scene base', () => {
      setActiveSceneLinetypeScale(30);
      expect(getLinetypeScale()).toBe(DEFAULT_LTSCALE); // status-bar control reads THIS
    });
  });
});
