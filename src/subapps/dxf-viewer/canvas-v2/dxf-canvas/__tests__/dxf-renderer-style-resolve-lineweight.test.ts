/**
 * ADR-510 Φ2G — the global LWDISPLAY toggle gates the resolved lineweight px.
 *
 * Locks the single gate: `resolveEntityRenderStyle` converts the entity's mm
 * lineweight to a fixed screen px (zoom-independent) when "Show Lineweight" is ON,
 * and collapses every stroke to a 1px hairline when OFF. Both the LINE batch path
 * and the per-entity path read this one value, so testing here covers both.
 */

import { resolveEntityRenderStyle } from '../dxf-renderer-style-resolve';
import type { DxfEntityUnion } from '../dxf-types';
import { createSceneLayer, type SceneLayer } from '../../../types/entities';
import { lineweightToPx } from '../../../config/lineweight-iso-catalog';
import {
  setShowLineweight,
  __resetLineweightDisplayForTesting,
} from '../../../stores/LineweightDisplayStore';
import { __resetLinetypeRegistryForTesting } from '../../../stores/LinetypeRegistry';

function lineEntity(layerId: string, lineweightMm: number): DxfEntityUnion {
  return {
    id: 'e1',
    type: 'line',
    layerId,
    visible: true,
    start: { x: 0, y: 0 },
    end: { x: 100, y: 0 },
    lineweightMm,
  } as unknown as DxfEntityUnion;
}

describe('resolveEntityRenderStyle — LWDISPLAY gate (ADR-510 Φ2G)', () => {
  let layer: SceneLayer;
  let layersById: Record<string, SceneLayer>;

  beforeEach(() => {
    __resetLineweightDisplayForTesting();
    __resetLinetypeRegistryForTesting();
    layer = createSceneLayer({ name: 'L', color: '#FFFFFF', colorAci: 7, linetype: 'Continuous', lineweight: 0.25 });
    layersById = { [layer.id]: layer };
  });

  test('toggle ON → resolves mm to fixed screen px (0.5mm ≈ 1.89px)', () => {
    setShowLineweight(true);
    const style = resolveEntityRenderStyle(lineEntity(layer.id, 0.5), layersById);
    expect(style.lineWidthPx).toBeCloseTo(lineweightToPx(0.5, 96), 5);
    expect(style.lineWidthPx).toBeGreaterThan(1); // 0.5mm is clearly thicker than a hairline
  });

  test('toggle OFF → every stroke collapses to a 1px hairline', () => {
    setShowLineweight(false);
    const style = resolveEntityRenderStyle(lineEntity(layer.id, 1.0), layersById);
    expect(style.lineWidthPx).toBe(1);
  });

  test('thicker mm → thicker px when ON (monotonic)', () => {
    setShowLineweight(true);
    const thin = resolveEntityRenderStyle(lineEntity(layer.id, 0.25), layersById).lineWidthPx;
    const thick = resolveEntityRenderStyle(lineEntity(layer.id, 2.0), layersById).lineWidthPx;
    expect(thick).toBeGreaterThan(thin);
  });

  test('never returns below the 1px hairline floor', () => {
    setShowLineweight(true);
    const style = resolveEntityRenderStyle(lineEntity(layer.id, 0.05), layersById);
    expect(style.lineWidthPx).toBeGreaterThanOrEqual(1);
  });

  test('no-layer fallback still honours the entity OWN lineweightMm (Φ2G)', () => {
    setShowLineweight(true);
    // No layersById at all → resolver takes the fallback branch, which must still
    // paint the entity's own mm weight (not collapse to legacy 1px).
    const style = resolveEntityRenderStyle(lineEntity(layer.id, 1.0));
    expect(style.lineWidthPx).toBeCloseTo(lineweightToPx(1.0, 96), 5);
    expect(style.lineWidthPx).toBeGreaterThan(2);
  });

  test('fallback with toggle OFF → 1px even with a concrete mm weight', () => {
    setShowLineweight(false);
    const style = resolveEntityRenderStyle(lineEntity(layer.id, 1.0));
    expect(style.lineWidthPx).toBe(1);
  });
});
