/**
 * ADR-459 Phase 2 — AttachColumnFootingCommand tests.
 *
 * Verifies the batch εδραίωση του αναλυτικού FK `footingId`:
 *   - execute sets footingId (geometry-neutral), recompute atomic
 *   - undo / redo round-trip from a once-built snapshot
 *   - idempotent (column already on the same footing → no patch)
 *   - validate / serialize
 */

import { AttachColumnFootingCommand } from '../AttachColumnFootingCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import {
  buildColumnEntity,
  buildDefaultColumnParams,
} from '../../../../hooks/drawing/column-completion';
import type { ColumnEntity } from '../../../../bim/types/column-types';

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

describe('AttachColumnFootingCommand', () => {
  it('execute sets footingId; base/top bindings untouched (geometry-neutral)', () => {
    const col = makeColumn();
    const { scene, sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new AttachColumnFootingCommand('F1', [col.id], sm);
    cmd.execute();
    const u = scene.get(col.id) as unknown as ColumnEntity;
    expect(u.params.footingId).toBe('F1');
    expect(u.params.baseBinding).toBe(col.params.baseBinding);
    expect(u.params.attachBaseToIds).toBeUndefined();
  });

  it('undo clears the footingId; redo re-applies', () => {
    const col = makeColumn();
    const { scene, sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new AttachColumnFootingCommand('F1', [col.id], sm);
    cmd.execute();
    cmd.undo();
    let u = scene.get(col.id) as unknown as ColumnEntity;
    expect(u.params.footingId).toBeUndefined();
    cmd.redo();
    u = scene.get(col.id) as unknown as ColumnEntity;
    expect(u.params.footingId).toBe('F1');
  });

  it('idempotent — no patch when the column is already on the same footing', () => {
    const col = makeColumn({ footingId: 'F1' });
    const { scene, sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new AttachColumnFootingCommand('F1', [col.id], sm);
    cmd.execute();
    cmd.undo(); // wasExecuted=false → no-op
    const u = scene.get(col.id) as unknown as ColumnEntity;
    expect(u.params.footingId).toBe('F1');
  });

  it('validate + serialize', () => {
    const col = makeColumn();
    const { sm } = makeMockScene([col as unknown as SceneEntity]);
    const ok = new AttachColumnFootingCommand('F1', [col.id], sm);
    expect(ok.validate()).toBeNull();
    expect(ok.getAffectedEntityIds()).toEqual([col.id]);
    expect(new AttachColumnFootingCommand('', [col.id], sm).validate()).toMatch(/Footing/);
    expect(new AttachColumnFootingCommand('F1', [], sm).validate()).toMatch(/At least one/);
    const s = ok.serialize();
    expect(s.type).toBe('attach-column-footing');
    expect(s.data).toMatchObject({ footingId: 'F1', columnIds: [col.id] });
  });
});
