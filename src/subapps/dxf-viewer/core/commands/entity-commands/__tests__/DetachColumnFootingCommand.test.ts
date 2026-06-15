/**
 * ADR-459 Φ4f — DetachColumnFootingCommand tests.
 *
 * Verifies the batch αφαίρεση του αναλυτικού FK `footingId` (inverse του attach):
 *   - execute removes the footingId KEY (Firestore-safe, όχι explicit undefined)
 *   - undo restores the original footingId; redo re-detaches
 *   - idempotent (column χωρίς footingId → no patch)
 *   - validate / serialize
 */

import { DetachColumnFootingCommand } from '../DetachColumnFootingCommand';
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

describe('DetachColumnFootingCommand', () => {
  it('execute removes the footingId key (not explicit undefined)', () => {
    const col = makeColumn({ footingId: 'F1' });
    const { scene, sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new DetachColumnFootingCommand([col.id], sm);
    cmd.execute();
    const u = scene.get(col.id) as unknown as ColumnEntity;
    expect(u.params.footingId).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(u.params, 'footingId')).toBe(false);
  });

  it('undo restores the original footingId; redo re-detaches', () => {
    const col = makeColumn({ footingId: 'F1' });
    const { scene, sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new DetachColumnFootingCommand([col.id], sm);
    cmd.execute();
    cmd.undo();
    let u = scene.get(col.id) as unknown as ColumnEntity;
    expect(u.params.footingId).toBe('F1');
    cmd.redo();
    u = scene.get(col.id) as unknown as ColumnEntity;
    expect(u.params.footingId).toBeUndefined();
  });

  it('idempotent — no patch when the column has no footingId', () => {
    const col = makeColumn();
    const { scene, sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new DetachColumnFootingCommand([col.id], sm);
    cmd.execute();
    cmd.undo(); // wasExecuted=false → no-op
    const u = scene.get(col.id) as unknown as ColumnEntity;
    expect(u.params.footingId).toBeUndefined();
  });

  it('validate + serialize', () => {
    const col = makeColumn({ footingId: 'F1' });
    const { sm } = makeMockScene([col as unknown as SceneEntity]);
    const ok = new DetachColumnFootingCommand([col.id], sm);
    expect(ok.validate()).toBeNull();
    expect(ok.getAffectedEntityIds()).toEqual([col.id]);
    expect(new DetachColumnFootingCommand([], sm).validate()).toMatch(/At least one/);
    const s = ok.serialize();
    expect(s.type).toBe('detach-column-footing');
    expect(s.data).toMatchObject({ columnIds: [col.id] });
  });
});
