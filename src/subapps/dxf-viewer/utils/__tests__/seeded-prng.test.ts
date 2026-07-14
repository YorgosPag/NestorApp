import { createPrng, symmetricJitter, mixSeed } from '../seeded-prng';

describe('createPrng', () => {
  it('is deterministic: same seed → identical sequence', () => {
    const a = createPrng(12345);
    const b = createPrng(12345);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds → different sequences', () => {
    const a = Array.from({ length: 10 }, createPrng(1));
    const b = Array.from({ length: 10 }, createPrng(2));
    expect(a).not.toEqual(b);
  });

  it('always returns floats in [0, 1)', () => {
    const rng = createPrng(777);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('seed 0 is non-degenerate (does not get stuck)', () => {
    const rng = createPrng(0);
    const vals = new Set(Array.from({ length: 20 }, () => rng()));
    expect(vals.size).toBeGreaterThan(1);
  });

  it('reasonable spread across the unit interval', () => {
    const rng = createPrng(2024);
    const vals = Array.from({ length: 5000 }, () => rng());
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });
});

describe('symmetricJitter', () => {
  it('stays within [-amp, +amp]', () => {
    const rng = createPrng(5);
    for (let i = 0; i < 1000; i++) {
      const j = symmetricJitter(rng, 10);
      expect(j).toBeGreaterThanOrEqual(-10);
      expect(j).toBeLessThanOrEqual(10);
    }
  });

  it('amplitude 0 or negative → exactly 0 (clean no-op)', () => {
    const rng = createPrng(5);
    expect(symmetricJitter(rng, 0)).toBe(0);
    expect(symmetricJitter(rng, -3)).toBe(0);
  });

  it('produces both signs over many draws', () => {
    const rng = createPrng(9);
    const draws = Array.from({ length: 200 }, () => symmetricJitter(rng, 1));
    expect(draws.some(d => d > 0)).toBe(true);
    expect(draws.some(d => d < 0)).toBe(true);
  });
});

describe('mixSeed', () => {
  it('is deterministic for the same (seed, index)', () => {
    expect(mixSeed(10, 3)).toBe(mixSeed(10, 3));
  });

  it('decorrelates adjacent indices (seed+i style collisions avoided)', () => {
    const s0 = mixSeed(100, 0);
    const s1 = mixSeed(100, 1);
    const s2 = mixSeed(100, 2);
    expect(s0).not.toBe(s1);
    expect(s1).not.toBe(s2);
    // first draws differ → independent-looking sub-streams
    expect(createPrng(s0)()).not.toBeCloseTo(createPrng(s1)(), 6);
  });

  it('returns a uint32', () => {
    const v = mixSeed(-42, 7);
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(0xffffffff);
  });
});
