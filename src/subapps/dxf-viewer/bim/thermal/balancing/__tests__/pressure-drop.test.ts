/**
 * ADR-422 L4 — tests για τη Darcy pressure-drop math (τριβή + τοπικές + kv).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 */

import {
  dynamicPressurePa,
  frictionDropPa,
  localDropPa,
  segmentPressureDropPa,
  requiredKv,
} from '../pressure-drop';
import { PA_PER_BAR, SECONDS_PER_HOUR } from '../balancing-config';

describe('dynamicPressurePa — ρ·v²/2', () => {
  it('v=1, ρ=1000 → 500 Pa', () => {
    expect(dynamicPressurePa(1, 1000)).toBeCloseTo(500, 6);
  });
  it('v=2, ρ=1000 → 2000 Pa (τετραγωνικό στην ταχύτητα)', () => {
    expect(dynamicPressurePa(2, 1000)).toBeCloseTo(2000, 6);
  });
  it('μηδενική/αρνητική ταχύτητα ή πυκνότητα → 0', () => {
    expect(dynamicPressurePa(0, 1000)).toBe(0);
    expect(dynamicPressurePa(-1, 1000)).toBe(0);
    expect(dynamicPressurePa(1, 0)).toBe(0);
  });
});

describe('frictionDropPa — R·L', () => {
  it('R=150 Pa/m, L=10 m → 1500 Pa', () => {
    expect(frictionDropPa(150, 10)).toBeCloseTo(1500, 6);
  });
  it('μη-θετικά → 0', () => {
    expect(frictionDropPa(0, 10)).toBe(0);
    expect(frictionDropPa(150, 0)).toBe(0);
    expect(frictionDropPa(-150, 10)).toBe(0);
  });
});

describe('localDropPa — Σζ·(ρ·v²/2)', () => {
  it('ζ=0.5 (elbow), v=1, ρ=1000 → 250 Pa', () => {
    expect(localDropPa(0.5, 1, 1000)).toBeCloseTo(250, 6);
  });
  it('ζ=1.0 (tee), v=2, ρ=1000 → 2000 Pa', () => {
    expect(localDropPa(1.0, 2, 1000)).toBeCloseTo(2000, 6);
  });
  it('ζ=0 (straight) → 0', () => {
    expect(localDropPa(0, 3, 1000)).toBe(0);
  });
});

describe('segmentPressureDropPa — τριβή + τοπικές', () => {
  it('R=100·L=5 + ζ=1·v=2·ρ=1000 → 500 + 2000 = 2500 Pa', () => {
    const dp = segmentPressureDropPa({
      frictionPaM: 100,
      lengthM: 5,
      localZetaSum: 1,
      velocityMS: 2,
      densityKgM3: 1000,
    });
    expect(dp).toBeCloseTo(2500, 6);
  });
  it('μηδενική παροχή (v=0, R=0) → 0', () => {
    const dp = segmentPressureDropPa({
      frictionPaM: 0,
      lengthM: 5,
      localZetaSum: 1,
      velocityMS: 0,
      densityKgM3: 1000,
    });
    expect(dp).toBe(0);
  });
});

describe('requiredKv — kv = Q[m³/h]/√(ΔP[bar])', () => {
  it('Q=1e-3 m³/s (3.6 m³/h), surplus=10000 Pa (0.1 bar) → ~11.38', () => {
    const kv = requiredKv({
      volumeFlowM3s: 1e-3,
      surplusPa: 10_000,
      paPerBar: PA_PER_BAR,
      secondsPerHour: SECONDS_PER_HOUR,
    });
    expect(kv).not.toBeNull();
    expect(kv!).toBeCloseTo(3.6 / Math.sqrt(0.1), 4);
  });
  it('μηδενική/αρνητική υπερβάλλουσα → null (πλήρως ανοιχτή)', () => {
    const base = { volumeFlowM3s: 1e-3, paPerBar: PA_PER_BAR, secondsPerHour: SECONDS_PER_HOUR };
    expect(requiredKv({ ...base, surplusPa: 0 })).toBeNull();
    expect(requiredKv({ ...base, surplusPa: -5 })).toBeNull();
  });
  it('μηδενική παροχή → null', () => {
    expect(
      requiredKv({ volumeFlowM3s: 0, surplusPa: 10_000, paPerBar: PA_PER_BAR, secondsPerHour: SECONDS_PER_HOUR }),
    ).toBeNull();
  });
  it('μεγαλύτερη υπερβάλλουσα → μικρότερο kv (περισσότερο στραγγαλισμό)', () => {
    const base = { volumeFlowM3s: 1e-3, paPerBar: PA_PER_BAR, secondsPerHour: SECONDS_PER_HOUR };
    const kvLow = requiredKv({ ...base, surplusPa: 5_000 })!;
    const kvHigh = requiredKv({ ...base, surplusPa: 20_000 })!;
    expect(kvHigh).toBeLessThan(kvLow);
  });
});
