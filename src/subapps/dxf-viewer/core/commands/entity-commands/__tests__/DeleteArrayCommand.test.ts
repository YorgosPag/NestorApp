import { DeleteArrayCommand } from '../DeleteArrayCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import type { ArrayEntity } from '../../../../types/entities';
import type { RectParams } from '../../../../systems/array/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeArrayEntity(id: string): SceneEntity {
  const params: RectParams = { kind: 'rect', rows: 2, cols: 3, rowSpacing: 20, colSpacing: 15, angle: 0 };
  return {
    id,
    type: 'array',
    layer: '0',
    visible: true,
    arrayKind: 'rect',
    hiddenSources: [
      { id: 'src1', type: 'line', layer: '0', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
    ],
    params,
  };
}

function makeMockScene(initial: SceneEntity[] = []): { scene: Map<string, SceneEntity>; sm: ISceneManager } {
  const scene = new Map<string, SceneEntity>(initial.map(e => [e.id, e]));
  const sm: ISceneManager = {
    getEntity: (id) => scene.get(id),
    addEntity: (e) => { scene.set(e.id, e); },
    removeEntity: (id) => { scene.delete(id); },
    updateEntity: (id, updates) => {
      const e = scene.get(id);
      if (e) scene.set(id, { ...e, ...updates as SceneEntity });
    },
    updateEntities: (updates) => {
      updates.forEach((partial, id) => {
        const e = scene.get(id);
        if (e) scene.set(id, { ...e, ...partial as SceneEntity });
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DeleteArrayCommand', () => {
  it('execute: removes the array entity from scene', () => {
    const arr = makeArrayEntity('arr1');
    const { scene, sm } = makeMockScene([arr]);

    const cmd = new DeleteArrayCommand('arr1', sm);
    cmd.execute();

    expect(scene.has('arr1')).toBe(false);
  });

  it('undo: restores the array entity with all hiddenSources intact', () => {
    const arr = makeArrayEntity('arr1');
    const { scene, sm } = makeMockScene([arr]);

    const cmd = new DeleteArrayCommand('arr1', sm);
    cmd.execute();
    cmd.undo();

    const restored = scene.get('arr1') as ArrayEntity;
    expect(restored).toBeDefined();
    expect(restored.type).toBe('array');
    expect(restored.hiddenSources).toHaveLength(1);
    expect(restored.hiddenSources[0].id).toBe('src1');
  });

  it('redo: removes array entity again after undo', () => {
    const arr = makeArrayEntity('arr1');
    const { scene, sm } = makeMockScene([arr]);

    const cmd = new DeleteArrayCommand('arr1', sm);
    cmd.execute();
    cmd.undo();
    cmd.redo();

    expect(scene.has('arr1')).toBe(false);
  });

  it('execute on missing entity: no-op', () => {
    const { scene, sm } = makeMockScene([]);
    const cmd = new DeleteArrayCommand('ghost', sm);
    expect(() => cmd.execute()).not.toThrow();
    expect(scene.size).toBe(0);
  });

  it('undo without execute: no-op', () => {
    const { sm } = makeMockScene([]);
    const cmd = new DeleteArrayCommand('arr1', sm);
    expect(() => cmd.undo()).not.toThrow();
  });

  it('canMergeWith: always false', () => {
    const arr = makeArrayEntity('arr1');
    const { sm } = makeMockScene([arr]);
    const cmd = new DeleteArrayCommand('arr1', sm);
    expect(cmd.canMergeWith?.(cmd)).toBe(false);
  });

  it('snapshot deep-clones: mutation of deleted entity does not affect undo', () => {
    const arr = makeArrayEntity('arr1');
    const { scene, sm } = makeMockScene([arr]);

    const cmd = new DeleteArrayCommand('arr1', sm);
    cmd.execute();
    // Mutate original object (simulate external mutation)
    arr.visible = false;

    cmd.undo();
    const restored = scene.get('arr1');
    // Should remain as it was at delete time (visible: true)
    expect(restored?.visible).toBe(true);
  });
});
