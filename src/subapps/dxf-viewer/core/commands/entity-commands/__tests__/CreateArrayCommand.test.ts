import { CreateArrayCommand } from '../CreateArrayCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import type { ArrayEntity } from '../../../../types/entities';
import type { RectParams } from '../../../../systems/array/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const RECT_PARAMS: RectParams = { kind: 'rect', rows: 2, cols: 3, rowSpacing: 20, colSpacing: 15, angle: 0 };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CreateArrayCommand', () => {
  it('execute: removes source entities from scene and adds ArrayEntity', () => {
    const line = makeLine('src1');
    const { scene, sm } = makeMockScene([line]);

    const cmd = new CreateArrayCommand(['src1'], 'rect', RECT_PARAMS, sm);
    cmd.execute();

    expect(scene.has('src1')).toBe(false);
    const arr = [...scene.values()].find(e => e.type === 'array') as ArrayEntity | undefined;
    expect(arr).toBeDefined();
    expect((arr as ArrayEntity).arrayKind).toBe('rect');
    expect((arr as ArrayEntity).hiddenSources).toHaveLength(1);
    expect((arr as ArrayEntity).hiddenSources[0].id).toBe('src1');
  });

  it('undo: removes ArrayEntity and restores source entities', () => {
    const line = makeLine('src1');
    const { scene, sm } = makeMockScene([line]);

    const cmd = new CreateArrayCommand(['src1'], 'rect', RECT_PARAMS, sm);
    cmd.execute();
    cmd.undo();

    expect([...scene.values()].some(e => e.type === 'array')).toBe(false);
    expect(scene.has('src1')).toBe(true);
  });

  it('redo: re-extracts sources and re-adds ArrayEntity with same ID', () => {
    const line = makeLine('src1');
    const { scene, sm } = makeMockScene([line]);

    const cmd = new CreateArrayCommand(['src1'], 'rect', RECT_PARAMS, sm);
    cmd.execute();
    const firstArrayId = [...scene.values()].find(e => e.type === 'array')!.id;
    cmd.undo();
    cmd.redo();

    expect(scene.has('src1')).toBe(false);
    const arr = [...scene.values()].find(e => e.type === 'array');
    expect(arr).toBeDefined();
    expect(arr!.id).toBe(firstArrayId);
  });

  it('execute with multiple sources: all removed from scene', () => {
    const entities = [makeLine('s1'), makeLine('s2'), makeLine('s3')];
    const { scene, sm } = makeMockScene(entities);

    const cmd = new CreateArrayCommand(['s1', 's2', 's3'], 'rect', RECT_PARAMS, sm);
    cmd.execute();

    expect(scene.has('s1')).toBe(false);
    expect(scene.has('s2')).toBe(false);
    expect(scene.has('s3')).toBe(false);
    const arr = [...scene.values()].find(e => e.type === 'array') as ArrayEntity;
    expect(arr.hiddenSources).toHaveLength(3);
  });

  it('execute with missing entity: skips missing, uses available', () => {
    const line = makeLine('exists');
    const { scene, sm } = makeMockScene([line]);

    const cmd = new CreateArrayCommand(['exists', 'ghost'], 'rect', RECT_PARAMS, sm);
    cmd.execute();

    const arr = [...scene.values()].find(e => e.type === 'array') as ArrayEntity;
    expect(arr).toBeDefined();
    expect(arr.hiddenSources).toHaveLength(1);
  });

  it('execute with no matching entities: no-op', () => {
    const { scene, sm } = makeMockScene([]);
    const cmd = new CreateArrayCommand(['ghost'], 'rect', RECT_PARAMS, sm);
    cmd.execute();
    expect([...scene.values()].some(e => e.type === 'array')).toBe(false);
  });

  it('undo without execute: no-op', () => {
    const { scene, sm } = makeMockScene([makeLine('s1')]);
    const cmd = new CreateArrayCommand(['s1'], 'rect', RECT_PARAMS, sm);
    expect(() => cmd.undo()).not.toThrow();
    expect(scene.has('s1')).toBe(true);
  });

  it('validate: empty source IDs returns error', () => {
    const { sm } = makeMockScene([]);
    const cmd = new CreateArrayCommand([], 'rect', RECT_PARAMS, sm);
    expect(cmd.validate()).toBeTruthy();
  });

  it('canMergeWith: always false', () => {
    const { sm } = makeMockScene([makeLine('s1')]);
    const cmd = new CreateArrayCommand(['s1'], 'rect', RECT_PARAMS, sm);
    expect(cmd.canMergeWith?.(cmd)).toBe(false);
  });

  it('getAffectedEntityIds includes arrayEntityId and sourceEntityIds', () => {
    const { sm } = makeMockScene([makeLine('s1')]);
    const cmd = new CreateArrayCommand(['s1', 's2'], 'rect', RECT_PARAMS, sm);
    const ids = cmd.getAffectedEntityIds();
    expect(ids).toContain('s1');
    expect(ids).toContain('s2');
    expect(ids.length).toBe(3); // 1 arrayId + 2 source IDs
  });
});
