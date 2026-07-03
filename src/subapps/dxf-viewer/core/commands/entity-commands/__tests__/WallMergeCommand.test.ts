/**
 * Tests for WallMergeCommand — ADR-566 (Merge/Join Walls).
 *
 * Coverage: execute (remove A+B, add merged, re-host openings), undo (restore
 * A+B, remove merged, restore opening params), redo (re-apply), idempotent undo.
 */

import { WallMergeCommand } from '../WallMergeCommand';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';
import type { WallEntity, WallParams } from '../../../../bim/types/wall-types';
import type { OpeningEntity } from '../../../../bim/types/opening-types';
import type { SceneEntity } from '../../interfaces';

function makeWall(id: string, startX: number, endX: number, openingIds: string[] = []): WallEntity {
  const params: WallParams = {
    category: 'interior',
    start: { x: startX, y: 0, z: 0 },
    end: { x: endX, y: 0, z: 0 },
    height: 3000, thickness: 200, flip: false,
    baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
  };
  return {
    id, type: 'wall', kind: 'straight', layerId: 'layer-0', ifcType: 'IfcWallStandardCase',
    params, hostedOpeningIds: openingIds,
    geometry: {
      axisPolyline: { points: [params.start, params.end] },
      outerEdge: { points: [] }, innerEdge: { points: [] },
      bbox: { min: params.start, max: params.end }, length: 5, area: 15, volume: 3,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as WallEntity;
}

function makeOpening(id: string, wallId: string, offsetFromStart: number): OpeningEntity {
  return {
    id, type: 'opening', kind: 'door', layerId: 'layer-0',
    params: { kind: 'door', wallId, offsetFromStart, width: 900, height: 2100, sillHeight: 0 },
    geometry: {
      position: { x: 0, y: 0, z: 0 }, rotation: 0, outline: { vertices: [] },
      bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } }, area: 0, perimeter: 0,
    },
    visible: true,
  } as unknown as OpeningEntity;
}

describe('WallMergeCommand', () => {
  test('execute removes A+B, adds merged, re-hosts openings', () => {
    const a = makeWall('a', 0, 5000, ['o1']);
    const b = makeWall('b', 5000, 9000, ['o2']);
    const merged = makeWall('merged', 0, 9000, ['o1', 'o2']);
    const o1 = makeOpening('o1', 'a', 1000);
    const o2 = makeOpening('o2', 'b', 500);
    const sm = createMockSceneManager([a, b, o1, o2] as unknown as SceneEntity[]);

    const cmd = new WallMergeCommand({
      wallA: a, wallB: b, merged,
      openingUpdates: [
        { openingId: 'o1', previousParams: o1.params, nextParams: { ...o1.params, wallId: 'merged', offsetFromStart: 1000 } },
        { openingId: 'o2', previousParams: o2.params, nextParams: { ...o2.params, wallId: 'merged', offsetFromStart: 5500 } },
      ],
    }, sm);

    cmd.execute();
    expect(sm.store.get('a')).toBeUndefined();
    expect(sm.store.get('b')).toBeUndefined();
    expect(sm.store.get('merged')).toBeDefined();
    expect((sm.store.get('o1') as unknown as OpeningEntity).params.wallId).toBe('merged');
    expect((sm.store.get('o2') as unknown as OpeningEntity).params.offsetFromStart).toBe(5500);
  });

  test('undo restores A+B and original opening params', () => {
    const a = makeWall('a', 0, 5000, ['o1']);
    const b = makeWall('b', 5000, 9000, []);
    const merged = makeWall('merged', 0, 9000, ['o1']);
    const o1 = makeOpening('o1', 'a', 1000);
    const sm = createMockSceneManager([a, b, o1] as unknown as SceneEntity[]);

    const cmd = new WallMergeCommand({
      wallA: a, wallB: b, merged,
      openingUpdates: [
        { openingId: 'o1', previousParams: o1.params, nextParams: { ...o1.params, wallId: 'merged', offsetFromStart: 1000 } },
      ],
    }, sm);

    cmd.execute();
    cmd.undo();
    expect(sm.store.get('merged')).toBeUndefined();
    expect(sm.store.get('a')).toBeDefined();
    expect(sm.store.get('b')).toBeDefined();
    expect((sm.store.get('o1') as unknown as OpeningEntity).params.wallId).toBe('a');
  });

  test('redo re-applies the merge', () => {
    const a = makeWall('a', 0, 5000);
    const b = makeWall('b', 5000, 9000);
    const merged = makeWall('merged', 0, 9000);
    const sm = createMockSceneManager([a, b] as unknown as SceneEntity[]);
    const cmd = new WallMergeCommand({ wallA: a, wallB: b, merged, openingUpdates: [] }, sm);

    cmd.execute();
    cmd.undo();
    cmd.redo();
    expect(sm.store.get('merged')).toBeDefined();
    expect(sm.store.get('a')).toBeUndefined();
  });

  test('undo before execute is a no-op', () => {
    const a = makeWall('a', 0, 5000);
    const b = makeWall('b', 5000, 9000);
    const merged = makeWall('merged', 0, 9000);
    const sm = createMockSceneManager([a, b] as unknown as SceneEntity[]);
    const cmd = new WallMergeCommand({ wallA: a, wallB: b, merged, openingUpdates: [] }, sm);

    cmd.undo();
    expect(sm.store.get('a')).toBeDefined();
    expect(sm.store.get('merged')).toBeUndefined();
  });

  test('getAffectedEntityIds includes both walls, merged, and openings', () => {
    const a = makeWall('a', 0, 5000);
    const b = makeWall('b', 5000, 9000);
    const merged = makeWall('merged', 0, 9000);
    const sm = createMockSceneManager([a, b] as unknown as SceneEntity[]);
    const cmd = new WallMergeCommand({
      wallA: a, wallB: b, merged,
      openingUpdates: [{ openingId: 'o1', previousParams: makeOpening('o1', 'a', 0).params, nextParams: makeOpening('o1', 'merged', 0).params }],
    }, sm);
    expect(cmd.getAffectedEntityIds()).toEqual(['a', 'b', 'merged', 'o1']);
  });
});
