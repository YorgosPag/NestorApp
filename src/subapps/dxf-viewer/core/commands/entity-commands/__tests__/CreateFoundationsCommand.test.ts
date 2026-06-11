/**
 * ADR-441 Slice 2 — CreateFoundationsCommand tests.
 *
 * Symmetric scene add/remove σε execute / undo / redo, validation, affected-ids,
 * snapshot independence. Τα deferred EventBus side-effects τρέχουν σε microtask
 * και είναι ακίνδυνα χωρίς listeners (mirror CreateMepSegmentsCommand.test).
 */

import { CreateFoundationsCommand } from '../CreateFoundationsCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import type { FoundationEntity } from '../../../../bim/types/foundation-types';

function makeMockScene(): { scene: Map<string, SceneEntity>; sm: ISceneManager } {
  const scene = new Map<string, SceneEntity>();
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

describe('CreateFoundationsCommand', () => {
  it('execute adds every foundation to the scene', () => {
    const { scene, sm } = makeMockScene();
    new CreateFoundationsCommand([makeFnd('f1'), makeFnd('f2')], sm).execute();
    expect(scene.size).toBe(2);
    expect(scene.has('f1')).toBe(true);
    expect(scene.has('f2')).toBe(true);
  });

  it('undo removes every foundation; redo re-adds them', () => {
    const { scene, sm } = makeMockScene();
    const cmd = new CreateFoundationsCommand([makeFnd('f1'), makeFnd('f2')], sm);
    cmd.execute();
    cmd.undo();
    expect(scene.size).toBe(0);
    cmd.redo();
    expect(scene.size).toBe(2);
  });

  it('undo before execute is a no-op', () => {
    const { scene, sm } = makeMockScene();
    new CreateFoundationsCommand([makeFnd('f1')], sm).undo();
    expect(scene.size).toBe(0);
  });

  it('validate rejects an empty batch', () => {
    const { sm } = makeMockScene();
    expect(new CreateFoundationsCommand([], sm).validate()).not.toBeNull();
    expect(new CreateFoundationsCommand([makeFnd('f1')], sm).validate()).toBeNull();
  });

  it('getAffectedEntityIds lists every foundation id', () => {
    const { sm } = makeMockScene();
    const cmd = new CreateFoundationsCommand([makeFnd('f1'), makeFnd('f2')], sm);
    expect(cmd.getAffectedEntityIds().sort()).toEqual(['f1', 'f2']);
  });

  it('snapshots are independent of later input-array mutation', () => {
    const { scene, sm } = makeMockScene();
    const input = [makeFnd('f1')];
    const cmd = new CreateFoundationsCommand(input, sm);
    input.length = 0;
    cmd.execute();
    expect(scene.has('f1')).toBe(true);
  });
});
