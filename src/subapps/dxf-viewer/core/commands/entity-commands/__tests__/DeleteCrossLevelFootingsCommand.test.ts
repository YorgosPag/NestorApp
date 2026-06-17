/**
 * ADR-459 Phase 7 — DeleteCrossLevelFootingsCommand (3D footing delete cross-level).
 */

import { DeleteCrossLevelFootingsCommand } from '../DeleteCrossLevelFootingsCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import type { FoundationCrossLevelWriter } from '../../../../bim/foundations/foundation-cross-level-writer';
import type { FoundationEntity } from '../../../../bim/types/foundation-types';
import type { ColumnEntity } from '../../../../bim/types/column-types';
import { buildColumnEntity, buildDefaultColumnParams } from '../../../../hooks/drawing/column-completion';

function makeScene(initial: SceneEntity[] = []): { scene: Map<string, SceneEntity>; sm: ISceneManager } {
  const scene = new Map<string, SceneEntity>(initial.map((e) => [e.id, e]));
  const sm: ISceneManager = {
    getEntity: (id) => scene.get(id),
    addEntity: (e) => { scene.set(e.id, e); },
    removeEntity: (id) => { scene.delete(id); },
    updateEntity: (id, updates) => {
      const e = scene.get(id);
      if (e) scene.set(id, { ...e, ...(updates as SceneEntity) });
    },
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

function makeColumnWithFooting(footingId: string): ColumnEntity {
  const r = buildColumnEntity(buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'), '0');
  if (!r.ok) throw new Error('column build failed');
  return { ...r.entity, params: { ...r.entity.params, footingId } };
}

const writer = (): jest.Mocked<FoundationCrossLevelWriter> => ({
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

const footing = (id: string) => ({ id, type: 'foundation', kind: 'pad' } as unknown as FoundationEntity);

describe('DeleteCrossLevelFootingsCommand', () => {
  it('removes footings cross-level and detaches column FK; undo restores both', () => {
    const col = makeColumnWithFooting('F1');
    const { scene, sm } = makeScene([col as unknown as SceneEntity]);
    const w = writer();
    const f = footing('F1');
    const cmd = new DeleteCrossLevelFootingsCommand([f], [col.id], w, sm);

    cmd.execute();
    expect(w.remove).toHaveBeenCalledWith('F1');
    expect((scene.get(col.id) as unknown as ColumnEntity).params.footingId).toBeUndefined();

    cmd.undo();
    expect(w.create).toHaveBeenCalledWith(f);
    expect((scene.get(col.id) as unknown as ColumnEntity).params.footingId).toBe('F1');
  });

  it('works with no attached columns (detach skipped)', () => {
    const { sm } = makeScene([]);
    const w = writer();
    const cmd = new DeleteCrossLevelFootingsCommand([footing('F1'), footing('F2')], [], w, sm);
    cmd.execute();
    expect(w.remove).toHaveBeenCalledTimes(2);
    expect(cmd.removedCount()).toBe(2);
    expect(cmd.validate()).toBeNull();
  });
});
