/**
 * Regression — object transparency (AutoCAD per-object, ribbon «Διαφάνεια») must
 * resolve to canvas alpha in BOTH the full layer-cascade path AND the no-layer
 * fallback branch.
 *
 * Bug (Giorgio 2026-07-08): the ribbon transparency edit «did not change the DXF
 * entities on the canvas». Root cause: the fallback branch (entity whose layer is
 * absent from `layersById` — freshly-drawn / imported lines) hardcoded `alpha: 1`,
 * silently dropping `entity.transparency`, while the full path honoured it. Both the
 * LINE batch path and the per-entity path read this one `alpha`, so testing the
 * resolver covers both render paths.
 */

import { resolveEntityRenderStyle } from '../dxf-renderer-style-resolve';
import type { DxfEntityUnion } from '../dxf-types';
import { createSceneLayer, type SceneLayer } from '../../../types/entities';
import { transparencyToAlpha } from '../dxf-renderer-frame-builders';
import { __resetLinetypeRegistryForTesting } from '../../../stores/LinetypeRegistry';

function lineEntity(layerId: string, transparency?: number): DxfEntityUnion {
  return {
    id: 'e1',
    type: 'line',
    layerId,
    visible: true,
    start: { x: 0, y: 0 },
    end: { x: 100, y: 0 },
    ...(transparency !== undefined && { transparency }),
  } as unknown as DxfEntityUnion;
}

describe('resolveEntityRenderStyle — object transparency → alpha', () => {
  let layer: SceneLayer;
  let layersById: Record<string, SceneLayer>;

  beforeEach(() => {
    __resetLinetypeRegistryForTesting();
    layer = createSceneLayer({ name: 'L', color: '#FFFFFF', colorAci: 7, linetype: 'Continuous', lineweight: 0.25 });
    layersById = { [layer.id]: layer };
  });

  test('full path (layer found) → alpha from entity transparency', () => {
    const style = resolveEntityRenderStyle(lineEntity(layer.id, 80), layersById);
    expect(style.alpha).toBeCloseTo(transparencyToAlpha(80), 6); // 0.2
    expect(style.alpha).toBeLessThan(1);
  });

  test('no-layer fallback (no layersById) → still honours entity OWN transparency (the bug)', () => {
    const style = resolveEntityRenderStyle(lineEntity(layer.id, 80));
    expect(style.alpha).toBeCloseTo(transparencyToAlpha(80), 6); // 0.2, was 1 before the fix
  });

  test('fallback with layer absent from layersById → honours entity transparency', () => {
    const style = resolveEntityRenderStyle(lineEntity('missing-layer', 60), layersById);
    expect(style.alpha).toBeCloseTo(transparencyToAlpha(60), 6); // 0.4
  });

  test('no transparency set → fully opaque (alpha 1) in both paths', () => {
    expect(resolveEntityRenderStyle(lineEntity(layer.id), layersById).alpha).toBe(1);
    expect(resolveEntityRenderStyle(lineEntity(layer.id)).alpha).toBe(1);
  });

  test('max transparency (90) → faintest alpha, monotonic vs a lower value', () => {
    const faint = resolveEntityRenderStyle(lineEntity(layer.id, 90)).alpha;
    const stronger = resolveEntityRenderStyle(lineEntity(layer.id, 30)).alpha;
    expect(faint).toBeCloseTo(transparencyToAlpha(90), 6); // 0.1
    expect(faint).toBeLessThan(stronger);
  });
});
