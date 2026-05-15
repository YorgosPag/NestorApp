import { ExplodeArrayCommand } from '../ExplodeArrayCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import type { ArrayEntity } from '../../../../types/entities';
import type { RectParams } from '../../../../systems/array/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRectArray(id: string, rows: number, cols: number, sources: SceneEntity[]): SceneEntity {
  const params: RectParams = {
    kind: 'rect',
    rows,
    cols,
    rowSpacing: 20,
    colSpacing: 15,
    angle: 0,
  };
  return {
    id,
    type: 'array',
    layer: '0',
    visible: true,
    arrayKind: 'rect',
    hiddenSources: sources,
    params,
  };
}

function makeLine(id: string): SceneEntity {
  return { id, type: 'line', layer: '0', visible: true, start: { x: 0, y: 0 }, end: { x: 10, y: 0 } };
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

describe('ExplodeArrayCommand', () => {
  it('execute: materializes rows×cols items for single source, removes ArrayEntity', () => {
    const source = makeLine('src1');
    const arr = makeRectArray('arr1', 3, 4, [source]);
    const { scene, sm } = makeMockScene([arr]);

    const cmd = new ExplodeArrayCommand('arr1', sm);
    cmd.execute();

    // ArrayEntity removed
    expect(scene.has('arr1')).toBe(false);
    // 3×4 = 12 items created (1 source × 12 transforms)
    expect(scene.size).toBe(12);
    // All created entities are 'line' (same type as source)
    for (const e of scene.values()) {
      expect(e.type).toBe('line');
    }
  });

  it('execute: compound source (2 sources) → rows×cols×sources items', () => {
    const s1 = makeLine('src1');
    const s2 = makeLine('src2');
    const arr = makeRectArray('arr1', 2, 3, [s1, s2]);
    const { scene, sm } = makeMockScene([arr]);

    const cmd = new ExplodeArrayCommand('arr1', sm);
    cmd.execute();

    // 2 sources × 2×3 = 2×6 = 12 items
    expect(scene.size).toBe(12);
    expect(scene.has('arr1')).toBe(false);
  });

  it('undo: removes all created entities and restores ArrayEntity', () => {
    const source = makeLine('src1');
    const arr = makeRectArray('arr1', 2, 2, [source]);
    const { scene, sm } = makeMockScene([arr]);

    const cmd = new ExplodeArrayCommand('arr1', sm);
    cmd.execute();
    cmd.undo();

    expect(scene.has('arr1')).toBe(true);
    expect((scene.get('arr1') as ArrayEntity).hiddenSources).toHaveLength(1);
    // No stray line entities should remain
    for (const e of scene.values()) {
      expect(e.type).toBe('array');
    }
  });

  it('redo: explodes again after undo, array removed again', () => {
    const source = makeLine('src1');
    const arr = makeRectArray('arr1', 2, 2, [source]);
    const { scene, sm } = makeMockScene([arr]);

    const cmd = new ExplodeArrayCommand('arr1', sm);
    cmd.execute();
    cmd.undo();
    cmd.redo();

    expect(scene.has('arr1')).toBe(false);
    expect(scene.size).toBe(4); // 1 source × 2×2
  });

  it('execute on missing entity: no-op', () => {
    const { scene, sm } = makeMockScene([]);
    const cmd = new ExplodeArrayCommand('ghost', sm);
    expect(() => cmd.execute()).not.toThrow();
    expect(scene.size).toBe(0);
  });

  it('throws for unsupported array kind (polar)', () => {
    const source = makeLine('src1');
    const polarArr: SceneEntity = {
      id: 'arr1',
      type: 'array',
      layer: '0',
      visible: true,
      arrayKind: 'polar',
      hiddenSources: [source],
      params: { kind: 'polar', count: 6, fillAngle: 360, startAngle: 0, rotateItems: true, center: { x: 0, y: 0 }, radius: 50 },
    };
    const { sm } = makeMockScene([polarArr]);
    const cmd = new ExplodeArrayCommand('arr1', sm);
    expect(() => cmd.execute()).toThrow('not yet supported');
  });

  it('created entity IDs are unique (no collisions in 100-item array)', () => {
    const source = makeLine('src1');
    const arr = makeRectArray('arr1', 10, 10, [source]);
    const { scene, sm } = makeMockScene([arr]);

    const cmd = new ExplodeArrayCommand('arr1', sm);
    cmd.execute();

    expect(scene.size).toBe(100);
    const ids = [...scene.keys()];
    expect(new Set(ids).size).toBe(100);
  });

  it('canMergeWith: always false', () => {
    const arr = makeRectArray('arr1', 2, 2, [makeLine('src1')]);
    const { sm } = makeMockScene([arr]);
    const cmd = new ExplodeArrayCommand('arr1', sm);
    expect(cmd.canMergeWith?.(cmd)).toBe(false);
  });
});
