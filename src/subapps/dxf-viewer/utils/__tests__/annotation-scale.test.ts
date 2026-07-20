/**
 * ADR-344 Round 7 — `paperHeightToModel` SSoT.
 *
 * The single conversion paper-mm → model-space height. The defining property:
 * for a fixed paper height + drawing scale, EVERY unit system must yield the same
 * physical height (the meters/mm text-size bug was the violation of exactly this).
 */

import {
  paperHeightToModel,
  resolveEffectiveDimscale,
  clampDimscaleForReadability,
  DIM_TEXT_MAX_SCENE_RATIO,
} from '../annotation-scale';
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

describe('clampDimscaleForReadability — the giant-dimension-cross fix', () => {
  // The real ACAD-τοπογραφικόFinal.dxf case: a 307.8-unit drawing whose imported
  // DIMSCALE=100 blew DIMTXT 0.6 up to 60 units (19.5% of the drawing) → an
  // unreadable overlapping cross of labels.
  const SPAN = 307.8;
  const DIMTXT = 0.6;

  it('caps the text height at exactly maxRatio × sceneSpan when DIMSCALE is oversized', () => {
    const clamped = clampDimscaleForReadability(100, DIMTXT, 'mm', SPAN);
    expect(clamped).toBeLessThan(100);
    // Post-clamp model-space text height == 2% of the span.
    expect(paperHeightToModel(DIMTXT, clamped, 'mm')).toBeCloseTo(SPAN * DIM_TEXT_MAX_SCENE_RATIO, 6);
  });

  it('is a no-op when the text already fits under the ceiling (correct DXFs untouched)', () => {
    // dimscale 1 → 0.6 units text = 0.2% of the span, well under 2%.
    expect(clampDimscaleForReadability(1, DIMTXT, 'mm', SPAN)).toBe(1);
    // A legitimate 1:50 drawing where the geometry is large enough.
    expect(clampDimscaleForReadability(50, 2.5, 'mm', 100_000)).toBe(50);
  });

  it('never ENLARGES — clamp is one-directional (down only)', () => {
    const clamped = clampDimscaleForReadability(100, DIMTXT, 'mm', SPAN);
    expect(clamped).toBeLessThanOrEqual(100);
  });

  it('is idempotent — feeding the clamped value back returns it unchanged', () => {
    const once = clampDimscaleForReadability(100, DIMTXT, 'mm', SPAN);
    const twice = clampDimscaleForReadability(once, DIMTXT, 'mm', SPAN);
    expect(twice).toBeCloseTo(once, 9);
  });

  it('honours a custom maxTextRatio', () => {
    const clamped = clampDimscaleForReadability(100, DIMTXT, 'mm', SPAN, 0.05);
    expect(paperHeightToModel(DIMTXT, clamped, 'mm')).toBeCloseTo(SPAN * 0.05, 6);
  });

  it('is a no-op for a non-positive span / dimtxt / dimscale (preview + empty scene)', () => {
    expect(clampDimscaleForReadability(100, DIMTXT, 'mm', 0)).toBe(100);
    expect(clampDimscaleForReadability(100, DIMTXT, 'mm', -1)).toBe(100);
    expect(clampDimscaleForReadability(100, 0, 'mm', SPAN)).toBe(100);
    expect(clampDimscaleForReadability(0, DIMTXT, 'mm', SPAN)).toBe(0);
  });

  it('produces a proportionate text height in a correctly-declared metre scene', () => {
    // 300 m drawing, DIMTXT 0.6 mm paper, DIMSCALE 1000 (1:1000) → 0.6 m text (huge
    // relative to nothing? no — 0.6/300 = 0.2%, fine). But DIMSCALE 200000 blows it
    // to 120 m (40%) → clamped back to 2%.
    const clamped = clampDimscaleForReadability(200_000, 0.6, 'm', 300);
    expect(paperHeightToModel(0.6, clamped, 'm')).toBeCloseTo(300 * DIM_TEXT_MAX_SCENE_RATIO, 6);
  });
});
