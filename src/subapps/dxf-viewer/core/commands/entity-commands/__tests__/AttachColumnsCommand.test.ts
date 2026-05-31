/**
 * ADR-401 Phase F.3 — AttachColumnsCommand + DetachColumnsCommand tests.
 *
 * Verifies the batch attach/detach of column top/base to a structural host:
 *   - execute sets binding 'attached' + appends host id (dedup), recompute atomic
 *   - undo / redo round-trip from a once-built snapshot
 *   - detach resets binding to default + clears the host list (via detachEntitySide)
 *   - validate / serialize
 */

import { AttachColumnsCommand } from '../AttachColumnsCommand';
import { DetachColumnsCommand } from '../DetachColumnsCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import {
  buildColumnEntity,
  buildDefaultColumnParams,
} from '../../../../hooks/drawing/column-completion';
import type { ColumnEntity } from '../../../../bim/types/column-types';
import {
  DEFAULT_COLUMN_TOP_BINDING,
  DEFAULT_COLUMN_BASE_BINDING,
} from '../../../../bim/types/bim-binding';

function makeMockScene(initial: SceneEntity[] = []): { scene: Map<string, SceneEntity>; sm: ISceneManager } {
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

function makeColumn(overrides: Partial<ColumnEntity['params']> = {}): ColumnEntity {
  const params = { ...buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'), ...overrides };
  const r = buildColumnEntity(params, '0');
  if (!r.ok) throw new Error('column build failed: ' + r.hardErrors.join(','));
  return r.entity;
}

describe('AttachColumnsCommand', () => {
  it('top: execute sets topBinding="attached" + appends host id', () => {
    const col = makeColumn();
    const { scene, sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new AttachColumnsCommand('top', 'beam_1', [{ columnId: col.id, kind: col.kind }], sm);
    cmd.execute();
    const u = scene.get(col.id) as unknown as ColumnEntity;
    expect(u.params.topBinding).toBe('attached');
    expect(u.params.attachTopToIds).toEqual(['beam_1']);
    expect(u.params.baseBinding).toBe(col.params.baseBinding); // base untouched
  });

  it('base: execute sets baseBinding="attached" + appends host id', () => {
    const col = makeColumn();
    const { scene, sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new AttachColumnsCommand('base', 'slab_1', [{ columnId: col.id, kind: col.kind }], sm);
    cmd.execute();
    const u = scene.get(col.id) as unknown as ColumnEntity;
    expect(u.params.baseBinding).toBe('attached');
    expect(u.params.attachBaseToIds).toEqual(['slab_1']);
    expect(u.params.topBinding).toBe(col.params.topBinding);
  });

  it('dedups the host id when already present', () => {
    const col = makeColumn({ topBinding: 'attached', attachTopToIds: ['beam_1'] });
    const { scene, sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new AttachColumnsCommand('top', 'beam_1', [{ columnId: col.id, kind: col.kind }], sm);
    cmd.execute();
    const u = scene.get(col.id) as unknown as ColumnEntity;
    expect(u.params.attachTopToIds).toEqual(['beam_1']);
  });

  it('undo restores the previous binding + ids; redo re-applies', () => {
    const col = makeColumn();
    const { scene, sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new AttachColumnsCommand('top', 'beam_1', [{ columnId: col.id, kind: col.kind }], sm);
    cmd.execute();
    cmd.undo();
    let u = scene.get(col.id) as unknown as ColumnEntity;
    expect(u.params.topBinding).toBe(col.params.topBinding);
    expect(u.params.attachTopToIds).toBeUndefined();
    cmd.redo();
    u = scene.get(col.id) as unknown as ColumnEntity;
    expect(u.params.topBinding).toBe('attached');
  });

  it('validate + serialize', () => {
    const col = makeColumn();
    const { sm } = makeMockScene([col as unknown as SceneEntity]);
    const ok = new AttachColumnsCommand('top', 'beam_1', [{ columnId: col.id, kind: col.kind }], sm);
    expect(ok.validate()).toBeNull();
    expect(ok.getAffectedEntityIds()).toEqual([col.id]);
    expect(new AttachColumnsCommand('top', '', [{ columnId: col.id, kind: col.kind }], sm).validate()).toMatch(/Host/);
    expect(new AttachColumnsCommand('top', 'beam_1', [], sm).validate()).toMatch(/At least one/);
    const s = ok.serialize();
    expect(s.type).toBe('attach-columns');
    expect(s.data).toMatchObject({ side: 'top', hostId: 'beam_1' });
  });
});

describe('DetachColumnsCommand', () => {
  it('top: resets binding to default + clears attachTopToIds', () => {
    const col = makeColumn({ topBinding: 'attached', attachTopToIds: ['beam_1', 'beam_2'] });
    const { scene, sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new DetachColumnsCommand('top', [{ columnId: col.id, kind: col.kind }], sm);
    cmd.execute();
    const u = scene.get(col.id) as unknown as ColumnEntity;
    expect(u.params.topBinding).toBe(DEFAULT_COLUMN_TOP_BINDING);
    expect(u.params.attachTopToIds).toBeUndefined();
  });

  it('base: resets binding to default + clears attachBaseToIds; undo restores', () => {
    const col = makeColumn({ baseBinding: 'attached', attachBaseToIds: ['slab_1'] });
    const { scene, sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new DetachColumnsCommand('base', [{ columnId: col.id, kind: col.kind }], sm);
    cmd.execute();
    let u = scene.get(col.id) as unknown as ColumnEntity;
    expect(u.params.baseBinding).toBe(DEFAULT_COLUMN_BASE_BINDING);
    expect(u.params.attachBaseToIds).toBeUndefined();
    cmd.undo();
    u = scene.get(col.id) as unknown as ColumnEntity;
    expect(u.params.baseBinding).toBe('attached');
    expect(u.params.attachBaseToIds).toEqual(['slab_1']);
  });

  it('validate + serialize', () => {
    const col = makeColumn();
    const { sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new DetachColumnsCommand('top', [{ columnId: col.id, kind: col.kind }], sm);
    expect(cmd.validate()).toBeNull();
    expect(new DetachColumnsCommand('top', [], sm).validate()).toMatch(/At least one/);
    expect(cmd.serialize().type).toBe('detach-columns');
  });
});
