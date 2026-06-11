/**
 * ADR-441 Slice 6 — DeleteFoundationsCommand tests.
 *
 * Inverse του CreateFoundationsCommand: execute removes, undo re-adds, redo
 * re-removes. Τα deferred EventBus side-effects τρέχουν σε microtask, ακίνδυνα
 * χωρίς listeners (mirror CreateFoundationsCommand.test).
 */

import { DeleteFoundationsCommand } from '../DeleteFoundationsCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import type { FoundationEntity } from '../../../../bim/types/foundation-types';

function makeMockScene(seed: SceneEntity[] = []): { scene: Map<string, SceneEntity>; sm: ISceneManager } {
  const scene = new Map<string, SceneEntity>();
  for (const e of seed) scene.set(e.id, e);
  const sm: ISceneManager = {
    getEntity: (id) => scene.get(id),
    addEntity: (e) => { scene.set(e.id, e); },
    removeEntity: (id) => { scene.delete(id); },
    updateEntity: () => {},
    updateEntities: () => {},
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

/** Minimal FoundationEntity stub — η command αγγίζει μόνο το `id`. */
function makeFnd(id: string): FoundationEntity {
  return {
    id,
    type: 'foundation',
    kind: 'strip',
    layerId: 'lyr_test',
    visible: true,
    params: { kind: 'strip' },
  } as unknown as FoundationEntity;
}

describe('DeleteFoundationsCommand', () => {
  it('execute removes every foundation from the scene', () => {
    const f1 = makeFnd('f1'); const f2 = makeFnd('f2');
    const { scene, sm } = makeMockScene([f1 as unknown as SceneEntity, f2 as unknown as SceneEntity]);
    new DeleteFoundationsCommand([f1, f2], sm).execute();
    expect(scene.size).toBe(0);
  });

  it('undo re-adds every foundation; redo re-removes them', () => {
    const f1 = makeFnd('f1'); const f2 = makeFnd('f2');
    const { scene, sm } = makeMockScene([f1 as unknown as SceneEntity, f2 as unknown as SceneEntity]);
    const cmd = new DeleteFoundationsCommand([f1, f2], sm);
    cmd.execute();
    cmd.undo();
    expect(scene.size).toBe(2);
    expect(scene.has('f1')).toBe(true);
    cmd.redo();
    expect(scene.size).toBe(0);
  });

  it('undo before execute is a no-op', () => {
    const f1 = makeFnd('f1');
    const { scene, sm } = makeMockScene([f1 as unknown as SceneEntity]);
    new DeleteFoundationsCommand([f1], sm).undo();
    expect(scene.size).toBe(1);
  });

  it('validate rejects an empty batch', () => {
    const { sm } = makeMockScene();
    expect(new DeleteFoundationsCommand([], sm).validate()).not.toBeNull();
    expect(new DeleteFoundationsCommand([makeFnd('f1')], sm).validate()).toBeNull();
  });

  it('getAffectedEntityIds lists every foundation id', () => {
    const { sm } = makeMockScene();
    const cmd = new DeleteFoundationsCommand([makeFnd('f1'), makeFnd('f2')], sm);
    expect(cmd.getAffectedEntityIds().sort()).toEqual(['f1', 'f2']);
  });

  it('snapshots are independent of later input-array mutation', () => {
    const f1 = makeFnd('f1');
    const { scene, sm } = makeMockScene([f1 as unknown as SceneEntity]);
    const input = [f1];
    const cmd = new DeleteFoundationsCommand(input, sm);
    input.length = 0;
    cmd.execute();
    expect(scene.has('f1')).toBe(false);
  });
});
