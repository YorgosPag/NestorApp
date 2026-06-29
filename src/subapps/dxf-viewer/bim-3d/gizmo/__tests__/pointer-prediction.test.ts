/**
 * ADR-516 — pointer-prediction (latency compensation) unit tests.
 */

import { createPointerPredictor, type PointerPredictionConfig } from '../pointer-prediction';

const CFG: PointerPredictionConfig = {
  PRESENT_LATENCY_MS: 28,
  EMA_ALPHA: 0.5,
  MAX_AHEAD_PX: 40,
  STOP_VEL_PX_PER_MS: 0.02,
  ENABLED: true,
};

describe('createPointerPredictor', () => {
  it('returns the raw position on the first sample (no velocity yet)', () => {
    const p = createPointerPredictor(CFG);
    expect(p.predict(100, 50, 0)).toEqual({ x: 100, y: 50 });
  });

  it('extrapolates ahead by velocity × horizon under steady motion', () => {
    const p = createPointerPredictor(CFG);
    // 10px every 10ms → 1 px/ms along +x. Feed enough samples for the EMA to converge.
    let x = 0;
    let t = 0;
    p.predict(x, 0, t);
    for (let i = 0; i < 20; i++) {
      x += 10;
      t += 10;
    }
    // Replay the converged stream and read the final prediction.
    const p2 = createPointerPredictor(CFG);
    let x2 = 0;
    let t2 = 0;
    let out = p2.predict(x2, 0, t2);
    for (let i = 0; i < 30; i++) {
      x2 += 10;
      t2 += 10;
      out = p2.predict(x2, 0, t2);
    }
    // vel → 1 px/ms ⇒ ahead → 1 × 28 = 28px (under the 40px clamp).
    expect(out.x - x2).toBeCloseTo(28, 1);
    expect(out.y).toBeCloseTo(0, 5);
  });

  it('clamps the prediction to MAX_AHEAD_PX on a very fast move', () => {
    const p = createPointerPredictor(CFG);
    let x = 0;
    let t = 0;
    let out = p.predict(x, 0, t);
    // 100px every 1ms → 100 px/ms ⇒ raw ahead 2800px, must clamp to 40px.
    for (let i = 0; i < 30; i++) {
      x += 100;
      t += 1;
      out = p.predict(x, 0, t);
    }
    expect(out.x - x).toBeCloseTo(40, 5);
  });

  it('decays to zero prediction when the cursor stops (settle exactly on cursor)', () => {
    const p = createPointerPredictor(CFG);
    let x = 0;
    let t = 0;
    p.predict(x, 0, t);
    for (let i = 0; i < 10; i++) {
      x += 10;
      t += 10;
      p.predict(x, 0, t);
    }
    // Now the cursor stops: same position, time keeps advancing → velocity decays to ~0.
    let out = { x, y: 0 };
    for (let i = 0; i < 20; i++) {
      t += 10;
      out = p.predict(x, 0, t);
    }
    expect(out).toEqual({ x, y: 0 });
  });

  it('never divides by zero on a non-advancing timestamp (coalesced events)', () => {
    const p = createPointerPredictor(CFG);
    p.predict(10, 10, 100);
    const out = p.predict(50, 50, 100); // same timestamp
    expect(out).toEqual({ x: 50, y: 50 });
    expect(Number.isFinite(out.x)).toBe(true);
  });

  it('reset() clears velocity so the next drag starts from raw', () => {
    const p = createPointerPredictor(CFG);
    let x = 0;
    let t = 0;
    p.predict(x, 0, t);
    for (let i = 0; i < 10; i++) {
      x += 10;
      t += 10;
      p.predict(x, 0, t);
    }
    p.reset();
    // First sample after reset → raw, regardless of the prior velocity.
    expect(p.predict(500, 500, t + 10)).toEqual({ x: 500, y: 500 });
  });
});
