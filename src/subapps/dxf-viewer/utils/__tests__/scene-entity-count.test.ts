import { countSceneEntities, countSceneLayers } from '../scene-entity-count';
import type { SceneModel } from '../../types/scene';

/**
 * Build a minimal SceneModel with `n` entities. Only `entities.length` matters
 * for the counter, so the entity shape is irrelevant here.
 */
function sceneWith(n: number): SceneModel {
  return {
    entities: Array.from({ length: n }, (_unused, i) => ({ id: `e${i}` })),
    layersById: {},
    bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    units: 'mm',
  } as unknown as SceneModel;
}

/** Build a minimal SceneModel with `n` layers keyed l0..l(n-1). */
function sceneWithLayers(n: number): SceneModel {
  const layersById: Record<string, unknown> = {};
  for (let i = 0; i < n; i++) layersById[`l${i}`] = { id: `l${i}` };
  return {
    entities: [],
    layersById,
    bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    units: 'mm',
  } as unknown as SceneModel;
}

describe('countSceneEntities (ADR-462 entity-count SSoT)', () => {
  it('returns 0 for null / undefined scene', () => {
    expect(countSceneEntities(null)).toBe(0);
    expect(countSceneEntities(undefined)).toBe(0);
  });

  it('returns 0 for an empty scene', () => {
    expect(countSceneEntities(sceneWith(0))).toBe(0);
  });

  it('counts every entity (DXF + BIM share the same array)', () => {
    expect(countSceneEntities(sceneWith(1))).toBe(1);
    expect(countSceneEntities(sceneWith(7))).toBe(7);
  });

  it('is defensive when `entities` is missing', () => {
    expect(countSceneEntities({} as unknown as SceneModel)).toBe(0);
  });
});

describe('countSceneLayers (layer-count SSoT)', () => {
  it('returns 0 for null / undefined scene', () => {
    expect(countSceneLayers(null)).toBe(0);
    expect(countSceneLayers(undefined)).toBe(0);
  });

  it('returns 0 for a scene with no layers', () => {
    expect(countSceneLayers(sceneWithLayers(0))).toBe(0);
  });

  it('counts every layer in layersById', () => {
    expect(countSceneLayers(sceneWithLayers(1))).toBe(1);
    expect(countSceneLayers(sceneWithLayers(7))).toBe(7);
  });

  it('is defensive when `layersById` is missing', () => {
    expect(countSceneLayers({} as unknown as SceneModel)).toBe(0);
  });
});
