/**
 * ADR-412 Φ5 — `family-type-side-effects` tests.
 *
 * Verifies the all-floors BOQ re-feed fan-out:
 *   - `findWallsByTypeId` filters typed walls (and ignores non-walls),
 *   - active floor is sourced in-memory (`getLevelScene`), other floors via
 *     `loadFileV2`, each BOQ row tagged with THAT floor's `floorId`,
 *   - a level without `sceneFileId` is skipped (known limitation, no upsert),
 *   - a missing BOQ context (no company/project/building) is a no-op.
 */

import {
  findWallsByTypeId,
  refeedBoqForTypeAcrossFloors,
  type FloorLevelLike,
} from '../family-type-side-effects';
import { completeWallFromTwoClicks } from '../../../hooks/drawing/wall-completion';
import type { WallEntity } from '../../types/wall-types';
import type { SceneModel } from '../../../types/entities';
import type { BimEntityForBoq, BimBoqContext } from '../../services/BimToBoqBridge';

function makeWall(typeId: string | undefined, y = 0): WallEntity {
  const r = completeWallFromTwoClicks({ x: 0, y }, { x: 4000, y }, '0');
  if (!r.ok) throw new Error('wall build failed: ' + r.hardErrors.join(','));
  return typeId ? ({ ...r.entity, typeId } as WallEntity) : r.entity;
}

function makeScene(entities: unknown[]): SceneModel {
  return { entities } as unknown as SceneModel;
}

const BASE = { companyId: 'co-1', projectId: 'pr-1', buildingId: 'bl-1' };

interface UpsertCall {
  entity: BimEntityForBoq;
  context: BimBoqContext;
}

function makeUpsertSpy() {
  const calls: UpsertCall[] = [];
  const upsertBoq = (
    _t: 'wall',
    entity: BimEntityForBoq,
    context: BimBoqContext,
    _a: 'updated',
  ): void => {
    calls.push({ entity, context });
  };
  return { calls, upsertBoq };
}

describe('findWallsByTypeId (ADR-412 Φ5)', () => {
  it('returns only walls linked to the given type', () => {
    const a = makeWall('T1');
    const b = makeWall('T2');
    const c = makeWall(undefined);
    const scene = makeScene([a, b, c, { id: 'x', type: 'line' }]);
    const found = findWallsByTypeId(scene, 'T1');
    expect(found.map((w) => w.id)).toEqual([a.id]);
  });

  it('null scene → empty', () => {
    expect(findWallsByTypeId(null, 'T1')).toEqual([]);
  });
});

describe('refeedBoqForTypeAcrossFloors (ADR-412 Φ5)', () => {
  it('feeds active floor in-memory and other floors via loadFileV2, tagging floorId', async () => {
    const activeWall = makeWall('T1');
    const otherWall = makeWall('T1', 1000);
    const activeScene = makeScene([activeWall]);
    const otherScene = makeScene([otherWall]);

    const levels: FloorLevelLike[] = [
      { id: 'lvl-active', floorId: 'flr-1', sceneFileId: 'scene-1' },
      { id: 'lvl-other', floorId: 'flr-2', sceneFileId: 'scene-2' },
    ];
    const loadedFiles: string[] = [];
    const { calls, upsertBoq } = makeUpsertSpy();

    await refeedBoqForTypeAcrossFloors({
      typeId: 'T1',
      levels,
      activeLevelId: 'lvl-active',
      getLevelScene: (id) => (id === 'lvl-active' ? activeScene : null),
      loadFileV2: async (fileId) => {
        loadedFiles.push(fileId);
        return { scene: otherScene };
      },
      boqContextBase: BASE,
      upsertBoq,
    });

    // Active floor NOT loaded via loadFileV2; only the other floor's file loaded.
    expect(loadedFiles).toEqual(['scene-2']);
    expect(calls).toHaveLength(2);
    const byFloor = new Map(calls.map((c) => [c.context.floorId, c.entity.id]));
    expect(byFloor.get('flr-1')).toBe(activeWall.id);
    expect(byFloor.get('flr-2')).toBe(otherWall.id);
  });

  it('skips a level without sceneFileId (no BOQ upsert for it)', async () => {
    const activeWall = makeWall('T1');
    const levels: FloorLevelLike[] = [
      { id: 'lvl-active', floorId: 'flr-1', sceneFileId: 'scene-1' },
      { id: 'lvl-fileless', floorId: 'flr-2' }, // no sceneFileId
    ];
    const { calls, upsertBoq } = makeUpsertSpy();

    await refeedBoqForTypeAcrossFloors({
      typeId: 'T1',
      levels,
      activeLevelId: 'lvl-active',
      getLevelScene: () => makeScene([activeWall]),
      loadFileV2: async () => null,
      boqContextBase: BASE,
      upsertBoq,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].context.floorId).toBe('flr-1');
  });

  it('no-op when BOQ context is incomplete', async () => {
    const { calls, upsertBoq } = makeUpsertSpy();
    await refeedBoqForTypeAcrossFloors({
      typeId: 'T1',
      levels: [{ id: 'lvl-active', floorId: 'flr-1', sceneFileId: 'scene-1' }],
      activeLevelId: 'lvl-active',
      getLevelScene: () => makeScene([makeWall('T1')]),
      loadFileV2: async () => null,
      boqContextBase: { companyId: '', projectId: 'pr-1', buildingId: 'bl-1' },
      upsertBoq,
    });
    expect(calls).toHaveLength(0);
  });
});
