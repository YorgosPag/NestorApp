/**
 * ADR-362 Round 22 — `UpdateDimGripCommand` tests.
 *
 * Undoable dimension grip commit. Patches only touched fields (defPoints /
 * textMidpoint / rotation / datum); merge/undo/redo skeleton inherited from
 * `MergeableUpdateCommand`. Here: execute/undo/redo round-trip + validate + drag-merge.
 */

import { UpdateDimGripCommand } from '../UpdateDimGripCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import type { DimGripPatch } from '../../../../hooks/dimensions/useDimensionGrips';
import type { Point2D } from '../../../../rendering/types/Types';

function makeMockScene(initial: SceneEntity[] = []): {
  scene: Map<string, SceneEntity>;
  sm: ISceneManager;
} {
  const scene = new Map<string, SceneEntity>(initial.map((e) => [e.id, e]));
  const sm: ISceneManager = {
    getEntity: (id) => scene.get(id),
    addEntity: (e) => { scene.set(e.id, e); },
    removeEntity: (id) => { scene.delete(id); },
    updateEntity: (id, updates) => {
      const e = scene.get(id);
      if (e) scene.set(id, { ...e, ...(updates as SceneEntity) });
    },
    updateEntities: (updates) => {
      updates.forEach((partial, id) => {
        const e = scene.get(id);
        if (e) scene.set(id, { ...e, ...(partial as SceneEntity) });
      });
    },
    getVertices: () => undefined,
    insertVertex: () => {},
    removeVertex: () => {},
    updateVertex: () => {},
    getEntityIndex: () => -1,
    reorderEntity: () => {},
    moveEntityToIndex: () => {},
  };
  return { scene, sm };
}

function makeAlignedDim(defPoints: Point2D[]): SceneEntity {
  return {
    id: 'd1', type: 'dimension', dimensionType: 'aligned',
    styleId: 's', layerId: 'L', defPoints,
  } as unknown as SceneEntity;
}

const OLD_PTS: Point2D[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 20 }];
const NEW_PTS: Point2D[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 40 }];

describe('UpdateDimGripCommand', () => {
  it('execute applies the defPoints patch', () => {
    const { scene, sm } = makeMockScene([makeAlignedDim(OLD_PTS)]);
    const cmd = new UpdateDimGripCommand('d1', { defPoints: NEW_PTS }, { defPoints: OLD_PTS }, sm);
    cmd.execute();
    expect((scene.get('d1') as unknown as { defPoints: Point2D[] }).defPoints).toEqual(NEW_PTS);
  });

  it('undo restores the previous patch, redo re-applies', () => {
    const { scene, sm } = makeMockScene([makeAlignedDim(OLD_PTS)]);
    const cmd = new UpdateDimGripCommand('d1', { defPoints: NEW_PTS }, { defPoints: OLD_PTS }, sm);
    cmd.execute();
    cmd.undo();
    expect((scene.get('d1') as unknown as { defPoints: Point2D[] }).defPoints).toEqual(OLD_PTS);
    cmd.redo();
    expect((scene.get('d1') as unknown as { defPoints: Point2D[] }).defPoints).toEqual(NEW_PTS);
  });

  it('patches textMidpoint independently', () => {
    const { scene, sm } = makeMockScene([makeAlignedDim(OLD_PTS)]);
    const patch: DimGripPatch = { textMidpoint: { x: 50, y: 30 } };
    const prev: DimGripPatch = { textMidpoint: undefined };
    const cmd = new UpdateDimGripCommand('d1', patch, prev, sm);
    cmd.execute();
    expect((scene.get('d1') as unknown as { textMidpoint?: Point2D }).textMidpoint).toEqual({ x: 50, y: 30 });
    cmd.undo();
    expect((scene.get('d1') as unknown as { textMidpoint?: Point2D }).textMidpoint).toBeUndefined();
  });

  it('validate rejects empty id + empty patch', () => {
    const { sm } = makeMockScene([makeAlignedDim(OLD_PTS)]);
    expect(new UpdateDimGripCommand('', { defPoints: NEW_PTS }, { defPoints: OLD_PTS }, sm).validate()).not.toBeNull();
    expect(new UpdateDimGripCommand('d1', {}, {}, sm).validate()).not.toBeNull();
    expect(new UpdateDimGripCommand('d1', { defPoints: NEW_PTS }, { defPoints: OLD_PTS }, sm).validate()).toBeNull();
  });

  it('drag samples on the same dim merge (one undo entry)', () => {
    const { sm } = makeMockScene([makeAlignedDim(OLD_PTS)]);
    const a = new UpdateDimGripCommand('d1', { defPoints: NEW_PTS }, { defPoints: OLD_PTS }, sm, true);
    const b = new UpdateDimGripCommand('d1', { defPoints: OLD_PTS }, { defPoints: NEW_PTS }, sm, true);
    expect(a.canMergeWith(b)).toBe(true);
    // non-dragging → no merge
    const c = new UpdateDimGripCommand('d1', { defPoints: NEW_PTS }, { defPoints: OLD_PTS }, sm, false);
    expect(c.canMergeWith(b)).toBe(false);
  });
});
