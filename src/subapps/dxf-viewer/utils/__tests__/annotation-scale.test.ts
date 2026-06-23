/**
 * ADR-344 Round 7 — `paperHeightToModel` SSoT.
 *
 * The single conversion paper-mm → model-space height. The defining property:
 * for a fixed paper height + drawing scale, EVERY unit system must yield the same
 * physical height (the meters/mm text-size bug was the violation of exactly this).
 */

import { paperHeightToModel, resolveEffectiveDimscale } from '../annotation-scale';
import { mmToSceneUnits, type SceneUnits } from '../scene-units';

describe('paperHeightToModel — annotation-scale SSoT', () => {
  const PAPER = 2.5; // ISO 3098 / TEXT_SIZE_LIMITS.DEFAULT_HEIGHT
  const ALL_UNITS: readonly SceneUnits[] = ['mm', 'cm', 'm', 'in', 'ft'];

  it('yields the SAME physical height (mm) across every unit system at 1:100', () => {
    const physicalMm = (u: SceneUnits) =>
      paperHeightToModel(PAPER, 100, u) / mmToSceneUnits(u);
    for (const u of ALL_UNITS) {
      expect(physicalMm(u)).toBeCloseTo(250, 6); // 2.5mm × 100 = 250mm
    }
  });

  it('stores the height in the requested scene units', () => {
    expect(paperHeightToModel(PAPER, 100, 'mm')).toBeCloseTo(250, 6);
    expect(paperHeightToModel(PAPER, 100, 'cm')).toBeCloseTo(25, 6);
    expect(paperHeightToModel(PAPER, 100, 'm')).toBeCloseTo(0.25, 6);
    expect(paperHeightToModel(PAPER, 100, 'in')).toBeCloseTo(250 / 25.4, 6);
    expect(paperHeightToModel(PAPER, 100, 'ft')).toBeCloseTo(250 / 304.8, 6);
  });

  it('scales linearly with the drawing-scale denominator', () => {
    expect(paperHeightToModel(PAPER, 1, 'mm')).toBeCloseTo(2.5, 6);
    expect(paperHeightToModel(PAPER, 50, 'mm')).toBeCloseTo(125, 6);
    expect(paperHeightToModel(PAPER, 200, 'mm')).toBeCloseTo(500, 6);
  });

  it('collapses non-positive / non-finite scale to 1 (defensive, never NaN/0)', () => {
    expect(paperHeightToModel(PAPER, 0, 'mm')).toBeCloseTo(2.5, 6);
    expect(paperHeightToModel(PAPER, -5, 'mm')).toBeCloseTo(2.5, 6);
    expect(paperHeightToModel(PAPER, Number.NaN, 'mm')).toBeCloseTo(2.5, 6);
    expect(paperHeightToModel(PAPER, Number.POSITIVE_INFINITY, 'mm')).toBeCloseTo(2.5, 6);
  });
});

describe('resolveEffectiveDimscale — dimension annotation-scale SSoT', () => {
  it('keeps an explicit imported DIMSCALE (> 1) — the drawing\'s own plot scale', () => {
    expect(resolveEffectiveDimscale(50, 100)).toBe(50);
    expect(resolveEffectiveDimscale(100, 200)).toBe(100);
    expect(resolveEffectiveDimscale(20, 100)).toBe(20);
  });

  it('falls back to the drawingScale SSoT for built-in / annotative styles (dimscale ≤ 1)', () => {
    expect(resolveEffectiveDimscale(1, 100)).toBe(100); // built-in default → 1:100
    expect(resolveEffectiveDimscale(0, 100)).toBe(100); // annotative (DIMSCALE 0)
    expect(resolveEffectiveDimscale(1, 50)).toBe(50);   // honours a user-set 1:50
  });

  it('is unit-independent (no metre-only rescue) — the mm/cm fix', () => {
    // The whole bug: a built-in dimscale=1 must rescue to drawingScale regardless
    // of scene units, not only in metre scenes.
    expect(resolveEffectiveDimscale(1, 100)).toBe(100);
  });

  it('defends against a non-finite / non-positive drawingScale fallback', () => {
    expect(resolveEffectiveDimscale(1, 0)).toBe(1);
    expect(resolveEffectiveDimscale(1, Number.NaN)).toBe(1);
  });
});
