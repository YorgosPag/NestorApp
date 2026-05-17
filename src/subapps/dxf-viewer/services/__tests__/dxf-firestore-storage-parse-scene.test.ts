/**
 * ADR-358 Phase 9E-6f — `parseAndValidateScene` back-compat tests.
 *
 * Regression coverage for the post-9E-6e refactor bug where scene JSON
 * persisted with the new id-keyed `layersById` schema was deserialised into
 * a SceneModel missing `layersById`, causing `useLevelSceneLoader` to reject
 * the load with `"Scene not found"` and wipe the floorplan + any drawn stair
 * after every hard refresh.
 *
 * @see dxf-firestore-storage.impl.ts
 * @see useLevelSceneLoader.ts (gates on `fileRecord.scene.layersById != null`)
 */

import { parseAndValidateScene } from '../dxf-scene-json';

describe('parseAndValidateScene — Phase 9E-6f layersById hydration', () => {
  test('round-trip new-schema scene (layersById) hydrates layersById', () => {
    const original = {
      entities: [{ id: 'ent_1', type: 'line', layerId: 'lyr_a' }],
      layersById: {
        lyr_a: { id: 'lyr_a', name: 'WALLS', color: '#000' },
      },
      bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      units: 'mm',
    };
    const result = parseAndValidateScene(JSON.stringify(original));
    expect(result).not.toBeNull();
    expect(result?.layersById).toEqual(original.layersById);
    expect(result?.entities).toHaveLength(1);
  });

  test('legacy scene (name-keyed `layers` only) falls back into layersById', () => {
    const legacy = {
      entities: [{ id: 'ent_1', type: 'line' }],
      layers: { WALLS: { name: 'WALLS', color: '#000' } },
      bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
      units: 'mm',
    };
    const result = parseAndValidateScene(JSON.stringify(legacy));
    expect(result).not.toBeNull();
    expect(result?.layersById).toEqual(legacy.layers);
  });

  test('scene without entities array returns null', () => {
    const broken = { entities: 'not-an-array', layersById: {} };
    expect(parseAndValidateScene(JSON.stringify(broken))).toBeNull();
  });

  test('scene with empty entities returns null (placeholder guard)', () => {
    const empty = { entities: [], layersById: {} };
    expect(parseAndValidateScene(JSON.stringify(empty))).toBeNull();
  });

  test('invalid JSON returns null without throwing', () => {
    expect(parseAndValidateScene('{not valid json')).toBeNull();
  });

  test('missing bounds defaults to zero rectangle', () => {
    const noBounds = {
      entities: [{ id: 'ent_1', type: 'line' }],
      layersById: {},
      units: 'mm',
    };
    const result = parseAndValidateScene(JSON.stringify(noBounds));
    expect(result?.bounds).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });

  test('missing units defaults to mm', () => {
    const noUnits = {
      entities: [{ id: 'ent_1', type: 'line' }],
      layersById: {},
    };
    const result = parseAndValidateScene(JSON.stringify(noUnits));
    expect(result?.units).toBe('mm');
  });

  test('layersById takes precedence over legacy layers when both present', () => {
    const both = {
      entities: [{ id: 'ent_1' }],
      layersById: { lyr_new: { id: 'lyr_new', name: 'NEW', color: '#fff' } },
      layers: { OLD: { name: 'OLD', color: '#000' } },
      bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
      units: 'mm',
    };
    const result = parseAndValidateScene(JSON.stringify(both));
    expect(result?.layersById).toEqual(both.layersById);
  });

  test('scene with neither layersById nor layers defaults to empty object', () => {
    const minimal = {
      entities: [{ id: 'ent_1' }],
      bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
      units: 'mm',
    };
    const result = parseAndValidateScene(JSON.stringify(minimal));
    expect(result?.layersById).toEqual({});
  });
});
