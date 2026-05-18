/**
 * ADR-363 Phase 4.5 — `UpdateColumnParamsCommand` tests.
 *
 * Verifies:
 *   - execute / undo / redo round-trip patches params + recomputes geometry
 *     + validation atomically (kind synced at root level)
 *   - merge window (ADR-031): consecutive drag samples within the time
 *     window collapse via `canMergeWith` / `mergeWith`
 *   - validator rejects empty IDs / non-positive dimensions / non-finite
 *     rotation
 *   - circular kind skips depth check
 *   - serialize round-trips key fields
 */

import { UpdateColumnParamsCommand } from '../UpdateColumnParamsCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import {
  buildColumnEntity,
  buildDefaultColumnParams,
} from '../../../../hooks/drawing/column-completion';
import type { ColumnEntity, ColumnParams } from '../../../../bim/types/column-types';

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

function makeRectColumn(): ColumnEntity {
  const params = buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular');
  const r = buildColumnEntity(params, '0');
  if (!r.ok) throw new Error('rect column build failed: ' + r.hardErrors.join(','));
  return r.entity;
}

function makeCircularColumn(): ColumnEntity {
  const params = buildDefaultColumnParams({ x: 0, y: 0 }, 'circular');
  const r = buildColumnEntity(params, '0');
  if (!r.ok) throw new Error('circular column build failed: ' + r.hardErrors.join(','));
  return r.entity;
}

describe('UpdateColumnParamsCommand (Phase 4.5)', () => {
  it('1. execute: patches params + recomputes geometry + validation', () => {
    const col = makeRectColumn();
    const { scene, sm } = makeMockScene([col as unknown as SceneEntity]);
    const paramsB: ColumnParams = { ...col.params, width: 600 };

    const cmd = new UpdateColumnParamsCommand(col.id, paramsB, col.params, sm);
    cmd.execute();

    const updated = scene.get(col.id) as unknown as ColumnEntity;
    expect(updated.params.width).toBe(600);
    // Geometry recomputed: rect 600 × 400 mm = 0.24 m².
    expect(updated.geometry.area).toBeCloseTo(0.24, 3);
    expect(updated.validation).toBeDefined();
  });

  it('2. execute: syncs root kind with params.kind', () => {
    const col = makeRectColumn();
    const { scene, sm } = makeMockScene([col as unknown as SceneEntity]);
    const paramsB: ColumnParams = { ...col.params, kind: 'circular' };

    const cmd = new UpdateColumnParamsCommand(col.id, paramsB, col.params, sm);
    cmd.execute();

    const updated = scene.get(col.id) as unknown as ColumnEntity;
    expect(updated.kind).toBe('circular');
    expect(updated.params.kind).toBe('circular');
  });

  it('3. undo: restores previous params + geometry', () => {
    const col = makeRectColumn();
    const { scene, sm } = makeMockScene([col as unknown as SceneEntity]);
    const paramsB: ColumnParams = { ...col.params, depth: 700 };

    const cmd = new UpdateColumnParamsCommand(col.id, paramsB, col.params, sm);
    cmd.execute();
    cmd.undo();

    const reverted = scene.get(col.id) as unknown as ColumnEntity;
    expect(reverted.params.depth).toBe(col.params.depth);
    expect(reverted.geometry.volume).toBeCloseTo(col.geometry.volume, 6);
  });

  it('4. redo: re-applies after undo', () => {
    const col = makeRectColumn();
    const { scene, sm } = makeMockScene([col as unknown as SceneEntity]);
    const paramsB: ColumnParams = { ...col.params, depth: 700 };

    const cmd = new UpdateColumnParamsCommand(col.id, paramsB, col.params, sm);
    cmd.execute();
    cmd.undo();
    cmd.redo();

    const updated = scene.get(col.id) as unknown as ColumnEntity;
    expect(updated.params.depth).toBe(700);
  });

  it('5. undo before execute is a no-op', () => {
    const col = makeRectColumn();
    const { scene, sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new UpdateColumnParamsCommand(
      col.id,
      { ...col.params, depth: 999 },
      col.params,
      sm,
    );
    cmd.undo();
    const e = scene.get(col.id) as unknown as ColumnEntity;
    expect(e.params.depth).toBe(col.params.depth);
  });

  it('6. canMergeWith: same column, both dragging, within window', () => {
    const col = makeRectColumn();
    const { sm } = makeMockScene([col as unknown as SceneEntity]);

    const cmd1 = new UpdateColumnParamsCommand(col.id, col.params, col.params, sm, true);
    const cmd2 = new UpdateColumnParamsCommand(col.id, col.params, col.params, sm, true);
    expect(cmd1.canMergeWith(cmd2)).toBe(true);

    const merged = cmd1.mergeWith(cmd2) as UpdateColumnParamsCommand;
    expect(merged).toBeInstanceOf(UpdateColumnParamsCommand);
    expect(merged.getAffectedEntityIds()).toEqual([col.id]);
  });

  it('7. canMergeWith: false when isDragging=false on either side', () => {
    const col = makeRectColumn();
    const { sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmdA = new UpdateColumnParamsCommand(col.id, col.params, col.params, sm, false);
    const cmdB = new UpdateColumnParamsCommand(col.id, col.params, col.params, sm, true);
    expect(cmdA.canMergeWith(cmdB)).toBe(false);
    expect(cmdB.canMergeWith(cmdA)).toBe(false);
  });

  it('8. canMergeWith: false across different columns', () => {
    const col = makeRectColumn();
    const { sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmdA = new UpdateColumnParamsCommand(col.id, col.params, col.params, sm, true);
    const cmdB = new UpdateColumnParamsCommand('col_other', col.params, col.params, sm, true);
    expect(cmdA.canMergeWith(cmdB)).toBe(false);
  });

  it('9. validate rejects empty entity id', () => {
    const col = makeRectColumn();
    const { sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new UpdateColumnParamsCommand('', col.params, col.params, sm);
    expect(cmd.validate()).toMatch(/Column entity ID/);
  });

  it('10. validate rejects non-positive width', () => {
    const col = makeRectColumn();
    const { sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new UpdateColumnParamsCommand(
      col.id,
      { ...col.params, width: 0 },
      col.params,
      sm,
    );
    expect(cmd.validate()).toMatch(/width/);
  });

  it('11. validate rejects non-positive depth for non-circular', () => {
    const col = makeRectColumn();
    const { sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new UpdateColumnParamsCommand(
      col.id,
      { ...col.params, depth: 0 },
      col.params,
      sm,
    );
    expect(cmd.validate()).toMatch(/depth/);
  });

  it('12. validate skips depth check for circular kind', () => {
    const col = makeCircularColumn();
    const { sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new UpdateColumnParamsCommand(
      col.id,
      { ...col.params, depth: 0 },
      col.params,
      sm,
    );
    expect(cmd.validate()).toBeNull();
  });

  it('13. validate rejects non-positive height', () => {
    const col = makeRectColumn();
    const { sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new UpdateColumnParamsCommand(
      col.id,
      { ...col.params, height: 0 },
      col.params,
      sm,
    );
    expect(cmd.validate()).toMatch(/height/);
  });

  it('14. validate rejects non-finite rotation', () => {
    const col = makeRectColumn();
    const { sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new UpdateColumnParamsCommand(
      col.id,
      { ...col.params, rotation: Number.NaN },
      col.params,
      sm,
    );
    expect(cmd.validate()).toMatch(/rotation/);
  });

  it('15. serialize: round-trips key fields', () => {
    const col = makeRectColumn();
    const { sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new UpdateColumnParamsCommand(col.id, col.params, col.params, sm, true);
    const s = cmd.serialize();
    expect(s.type).toBe('update-column-params');
    expect(s.data).toMatchObject({ columnId: col.id, isDragging: true });
  });
});
