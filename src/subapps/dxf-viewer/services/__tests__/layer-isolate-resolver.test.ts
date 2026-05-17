/**
 * Layer Isolate Resolver tests — ADR-358 §5.6.bis Phase 10.
 *
 * Covers: 3-level cascade, opacity clamping/snapping, transparency conversion,
 * and inverse-mode helper.
 */

import { describe, it, expect } from '@jest/globals';
import {
  DEFAULT_LAYER_ISOLATE_SETTINGS,
  DIM_OPACITY_MAX,
  DIM_OPACITY_MIN,
  DIM_OPACITY_STEP,
  clampDimOpacityPercent,
  dimOpacityToTransparency,
  inverseMode,
  resolveLayerIsolateSettings,
  TRANSPARENCY_MAX,
} from '../layer-isolate-resolver';

describe('layer-isolate-resolver — defaults', () => {
  it('default settings match ADR §5.6.bis Δ FULL Enterprise', () => {
    expect(DEFAULT_LAYER_ISOLATE_SETTINGS).toEqual({
      mode: 'dim',
      dimOpacityPercent: 30,
    });
  });
});

describe('layer-isolate-resolver — cascade', () => {
  it('returns defaults when no project/user input', () => {
    expect(resolveLayerIsolateSettings({})).toEqual(DEFAULT_LAYER_ISOLATE_SETTINGS);
  });

  it('project setting beats user preference', () => {
    const out = resolveLayerIsolateSettings({
      projectSetting: { mode: 'freeze', dimOpacityPercent: 50 },
      userPreference: { mode: 'dim', dimOpacityPercent: 20 },
    });
    expect(out).toEqual({ mode: 'freeze', dimOpacityPercent: 50 });
  });

  it('user preference fills missing fields when project is partial', () => {
    const out = resolveLayerIsolateSettings({
      projectSetting: { mode: 'freeze' },
      userPreference: { dimOpacityPercent: 40 },
    });
    expect(out).toEqual({ mode: 'freeze', dimOpacityPercent: 40 });
  });

  it('falls back to system default for unknown mode strings', () => {
    const out = resolveLayerIsolateSettings({
      projectSetting: { mode: 'not-a-mode' as unknown as 'dim' },
    });
    expect(out.mode).toBe('dim');
  });

  it('clamps cascade output to allowed opacity grid', () => {
    const out = resolveLayerIsolateSettings({
      projectSetting: { dimOpacityPercent: 1000 },
    });
    expect(out.dimOpacityPercent).toBe(DIM_OPACITY_MAX);
  });
});

describe('layer-isolate-resolver — clampDimOpacityPercent', () => {
  it('snaps to step 5', () => {
    expect(clampDimOpacityPercent(33)).toBe(35);
    expect(clampDimOpacityPercent(32)).toBe(30);
  });

  it('clamps to [min, max]', () => {
    expect(clampDimOpacityPercent(0)).toBe(DIM_OPACITY_MIN);
    expect(clampDimOpacityPercent(150)).toBe(DIM_OPACITY_MAX);
  });

  it('falls back to default on NaN / Infinity', () => {
    expect(clampDimOpacityPercent(NaN)).toBe(DEFAULT_LAYER_ISOLATE_SETTINGS.dimOpacityPercent);
    expect(clampDimOpacityPercent(Infinity)).toBe(DEFAULT_LAYER_ISOLATE_SETTINGS.dimOpacityPercent);
  });

  it('respects exact grid value', () => {
    expect(clampDimOpacityPercent(35)).toBe(35);
  });
});

describe('layer-isolate-resolver — dimOpacityToTransparency', () => {
  it('inverts opacity to transparency (default 30 → 70)', () => {
    expect(dimOpacityToTransparency(30)).toBe(70);
  });

  it('clamps to DXF transparency range 0..90', () => {
    expect(dimOpacityToTransparency(5)).toBe(90); // input snapped to 5 → 100-5=95 → clamped 90
    expect(dimOpacityToTransparency(90)).toBe(10);
  });

  it('clamp uses TRANSPARENCY_MAX constant', () => {
    expect(TRANSPARENCY_MAX).toBe(90);
  });

  it('grid is multiples of DIM_OPACITY_STEP', () => {
    expect(DIM_OPACITY_STEP).toBe(5);
  });
});

describe('layer-isolate-resolver — inverseMode', () => {
  it('swaps dim ↔ freeze', () => {
    expect(inverseMode('dim')).toBe('freeze');
    expect(inverseMode('freeze')).toBe('dim');
  });
});
