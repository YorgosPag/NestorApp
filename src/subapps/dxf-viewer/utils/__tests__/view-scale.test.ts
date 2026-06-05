/**
 * View-Scale SSoT tests — ADR-418.
 *
 * Proves the pixel-scale ↔ real drawing-ratio (1:N) conversion is correct and
 * round-trips losslessly across every scene unit. The key worked example
 * (a floorplan in metres at fit ≈ scale 55 → "1:69", and 1:1 actual size →
 * scale ≈ 3779.5) pins the CSS-px resolution: no extra devicePixelRatio factor.
 *
 * Test groups:
 *   1. Worked examples (metres) — fit ratio + 1:1 actual-size scale.
 *   2. Round-trip — ratioToScale → scaleToRatio reconstructs N for all units.
 *   3. Units variation — same pixel scale yields larger N for larger units.
 *   4. Clamping — extreme ratios clamp to the transform scale limits.
 *   5. formatViewScale — integer / decimal / reciprocal forms.
 *   6. dpr reserved — passing dpr does not change the default-path result.
 *   7. pxPerMmCss — the physical-screen constant.
 */

import { describe, it, expect } from '@jest/globals';
import {
  scaleToRatio,
  ratioToScale,
  formatViewScale,
  VIEW_SCALE_RATIO_PRESETS,
} from '../view-scale';
import { pxPerMmCss, SCREEN_DPI, MM_PER_INCH } from '../../config/dpi-config';
import { TRANSFORM_SCALE_LIMITS } from '../../config/transform-config';
import type { SceneUnits } from '../scene-units';

const ALL_UNITS: SceneUnits[] = ['mm', 'cm', 'm', 'in', 'ft'];

describe('view-scale — worked examples (metres)', () => {
  it('fit ≈ scale 55 in metres reads as ~1:69', () => {
    const n = scaleToRatio({ scaleCss: 55, sceneUnits: 'm' });
    expect(n).toBeCloseTo(68.7, 0);
    expect(formatViewScale(n)).toBe('1:69');
  });

  it('1:1 actual size in metres needs scale ≈ 3779.5 CSS px/unit', () => {
    const scale = ratioToScale({ ratioN: 1, sceneUnits: 'm' });
    expect(scale).toBeCloseTo(3779.5, 0);
  });
});

describe('view-scale — round-trip across all units', () => {
  it('ratioToScale → scaleToRatio reconstructs N', () => {
    for (const sceneUnits of ALL_UNITS) {
      for (const ratioN of [1, ...VIEW_SCALE_RATIO_PRESETS]) {
        const scaleCss = ratioToScale({ ratioN, sceneUnits });
        const back = scaleToRatio({ scaleCss, sceneUnits });
        expect(back).toBeCloseTo(ratioN, 6);
      }
    }
  });
});

describe('view-scale — units variation', () => {
  it('same pixel scale → larger N for larger units (m > cm > mm)', () => {
    const scaleCss = 100;
    const nM = scaleToRatio({ scaleCss, sceneUnits: 'm' });
    const nCm = scaleToRatio({ scaleCss, sceneUnits: 'cm' });
    const nMm = scaleToRatio({ scaleCss, sceneUnits: 'mm' });
    expect(nM).toBeGreaterThan(nCm);
    expect(nCm).toBeGreaterThan(nMm);
  });
});

describe('view-scale — clamping', () => {
  it('huge N clamps the scale to the minimum limit', () => {
    expect(ratioToScale({ ratioN: 1e9, sceneUnits: 'm' })).toBeCloseTo(
      TRANSFORM_SCALE_LIMITS.MIN_SCALE,
      6,
    );
  });

  it('tiny N clamps the scale to the maximum limit', () => {
    expect(ratioToScale({ ratioN: 1e-9, sceneUnits: 'm' })).toBeCloseTo(
      TRANSFORM_SCALE_LIMITS.MAX_SCALE,
      6,
    );
  });

  it('non-positive ratio is defensive (clamped, finite)', () => {
    const v = ratioToScale({ ratioN: 0, sceneUnits: 'm' });
    expect(Number.isFinite(v)).toBe(true);
  });
});

describe('view-scale — formatViewScale', () => {
  it('integer / decimal / reciprocal forms', () => {
    expect(formatViewScale(68.7)).toBe('1:69');
    expect(formatViewScale(100)).toBe('1:100');
    expect(formatViewScale(1)).toBe('1:1');
    expect(formatViewScale(1.5)).toBe('1:1.5');
    expect(formatViewScale(0.5)).toBe('2:1');
  });

  it('non-finite / non-positive → placeholder', () => {
    expect(formatViewScale(Infinity)).toBe('—');
    expect(formatViewScale(0)).toBe('—');
  });
});

describe('view-scale — dpr reserved', () => {
  it('passing dpr does not change the default-path result', () => {
    const base = scaleToRatio({ scaleCss: 55, sceneUnits: 'm' });
    const withDpr = scaleToRatio({ scaleCss: 55, sceneUnits: 'm', dpr: 2 });
    expect(withDpr).toBe(base);
  });
});

describe('view-scale — pxPerMmCss', () => {
  it('equals SCREEN_DPI / MM_PER_INCH ≈ 3.7795', () => {
    expect(pxPerMmCss()).toBeCloseTo(SCREEN_DPI / MM_PER_INCH, 6);
    expect(pxPerMmCss()).toBeCloseTo(3.7795, 4);
  });
});
