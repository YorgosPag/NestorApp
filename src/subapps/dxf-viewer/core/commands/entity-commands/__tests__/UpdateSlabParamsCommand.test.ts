/**
 * ADR-363 Phase 3.5 — `UpdateSlabParamsCommand` tests.
 *
 * Verifies:
 *   - execute / undo / redo round-trip patches params + recomputes geometry
 *     + validation atomically (kind synced at root level)
 *   - merge window (ADR-031): consecutive drag samples within the time
 *     window collapse via `canMergeWith` / `mergeWith`
 *   - validator rejects invalid IDs / outline / thickness
 *   - serialize round-trips key fields
 */

import { UpdateSlabParamsCommand } from '../UpdateSlabParamsCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import {
  buildDefaultSlabParams,
  buildSlabEntity,
} from '../../../../hooks/drawing/slab-completion';
import type { SlabEntity, SlabParams } from '../../../../bim/types/slab-types';

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

function makeRectSlab(): SlabEntity {
  const verts = [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 3000 },
    { x: 0, y: 3000 },
  ];
  const r = buildSlabEntity(buildDefaultSlabParams(verts), '0');
  if (!r.ok) throw new Error('slab build failed: ' + r.hardErrors.join(','));
  return r.entity;
}

describe('UpdateSlabParamsCommand (Phase 3.5)', () => {
  it('1. execute: patches params + recomputes geometry + validation', () => {
    const slab = makeRectSlab();
    const { scene, sm } = makeMockScene([slab as unknown as SceneEntity]);
    const nextOutline = {
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 5000, y: 0, z: 0 },
        { x: 5000, y: 3000, z: 0 },
        { x: 0, y: 3000, z: 0 },
      ],
    };
    const paramsB: SlabParams = { ...slab.params, outline: nextOutline };

    const cmd = new UpdateSlabParamsCommand(slab.id, paramsB, slab.params, sm);
    cmd.execute();

    const updated = scene.get(slab.id) as unknown as SlabEntity;
    expect(updated.params.outline.vertices[1].x).toBe(5000);
    // Geometry recomputed: area went from 4×3 = 12 m² to 5×3 = 15 m².
    expect(updated.geometry.area).toBeCloseTo(15, 3);
    expect(updated.validation).toBeDefined();
  });

  it('2. execute: syncs root kind with params.kind', () => {
    const slab = makeRectSlab();
    const { scene, sm } = makeMockScene([slab as unknown as SceneEntity]);
    const paramsB: SlabParams = { ...slab.params, kind: 'roof' };

    const cmd = new UpdateSlabParamsCommand(slab.id, paramsB, slab.params, sm);
    cmd.execute();

    const updated = scene.get(slab.id) as unknown as SlabEntity;
    expect(updated.kind).toBe('roof');
    expect(updated.params.kind).toBe('roof');
  });

  it('3. undo: restores previous params + geometry', () => {
    const slab = makeRectSlab();
    const { scene, sm } = makeMockScene([slab as unknown as SceneEntity]);
    const paramsB: SlabParams = { ...slab.params, thickness: 300 };

    const cmd = new UpdateSlabParamsCommand(slab.id, paramsB, slab.params, sm);
    cmd.execute();
    cmd.undo();

    const reverted = scene.get(slab.id) as unknown as SlabEntity;
    expect(reverted.params.thickness).toBe(slab.params.thickness);
    expect(reverted.geometry.volume).toBeCloseTo(slab.geometry.volume, 3);
  });

  it('4. redo: re-applies after undo', () => {
    const slab = makeRectSlab();
    const { scene, sm } = makeMockScene([slab as unknown as SceneEntity]);
    const paramsB: SlabParams = { ...slab.params, thickness: 300 };

    const cmd = new UpdateSlabParamsCommand(slab.id, paramsB, slab.params, sm);
    cmd.execute();
    cmd.undo();
    cmd.redo();

    const updated = scene.get(slab.id) as unknown as SlabEntity;
    expect(updated.params.thickness).toBe(300);
  });

  it('5. undo before execute is a no-op', () => {
    const slab = makeRectSlab();
    const { scene, sm } = makeMockScene([slab as unknown as SceneEntity]);
    const cmd = new UpdateSlabParamsCommand(
      slab.id,
      { ...slab.params, thickness: 999 },
      slab.params,
      sm,
    );
    cmd.undo();
    const e = scene.get(slab.id) as unknown as SlabEntity;
    expect(e.params.thickness).toBe(slab.params.thickness);
  });

  it('6. canMergeWith: same slab, both dragging, within window', () => {
    const slab = makeRectSlab();
    const { sm } = makeMockScene([slab as unknown as SceneEntity]);

    const cmd1 = new UpdateSlabParamsCommand(slab.id, slab.params, slab.params, sm, true);
    const cmd2 = new UpdateSlabParamsCommand(slab.id, slab.params, slab.params, sm, true);
    expect(cmd1.canMergeWith(cmd2)).toBe(true);

    const merged = cmd1.mergeWith(cmd2) as UpdateSlabParamsCommand;
    expect(merged).toBeInstanceOf(UpdateSlabParamsCommand);
    expect(merged.getAffectedEntityIds()).toEqual([slab.id]);
  });

  it('7. canMergeWith: false when isDragging=false on either side', () => {
    const slab = makeRectSlab();
    const { sm } = makeMockScene([slab as unknown as SceneEntity]);
    const cmdA = new UpdateSlabParamsCommand(slab.id, slab.params, slab.params, sm, false);
    const cmdB = new UpdateSlabParamsCommand(slab.id, slab.params, slab.params, sm, true);
    expect(cmdA.canMergeWith(cmdB)).toBe(false);
    expect(cmdB.canMergeWith(cmdA)).toBe(false);
  });

  it('8. canMergeWith: false across different slabs', () => {
    const slab = makeRectSlab();
    const { sm } = makeMockScene([slab as unknown as SceneEntity]);
    const cmdA = new UpdateSlabParamsCommand(slab.id, slab.params, slab.params, sm, true);
    const cmdB = new UpdateSlabParamsCommand('slab_other', slab.params, slab.params, sm, true);
    expect(cmdA.canMergeWith(cmdB)).toBe(false);
  });

  it('9. validate rejects empty entity id', () => {
    const slab = makeRectSlab();
    const { sm } = makeMockScene([slab as unknown as SceneEntity]);
    const cmd = new UpdateSlabParamsCommand('', slab.params, slab.params, sm);
    expect(cmd.validate()).toMatch(/Slab entity ID/);
  });

  it('10. validate rejects degenerate outline (<3 vertices)', () => {
    const slab = makeRectSlab();
    const { sm } = makeMockScene([slab as unknown as SceneEntity]);
    const badParams: SlabParams = {
      ...slab.params,
      outline: { vertices: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }] },
    };
    const cmd = new UpdateSlabParamsCommand(slab.id, badParams, slab.params, sm);
    expect(cmd.validate()).toMatch(/outline/);
  });

  it('11. validate rejects non-positive thickness', () => {
    const slab = makeRectSlab();
    const { sm } = makeMockScene([slab as unknown as SceneEntity]);
    const cmd = new UpdateSlabParamsCommand(
      slab.id,
      { ...slab.params, thickness: 0 },
      slab.params,
      sm,
    );
    expect(cmd.validate()).toMatch(/thickness/);
  });

  it('12. serialize: round-trips key fields', () => {
    const slab = makeRectSlab();
    const { sm } = makeMockScene([slab as unknown as SceneEntity]);
    const cmd = new UpdateSlabParamsCommand(slab.id, slab.params, slab.params, sm, true);
    const s = cmd.serialize();
    expect(s.type).toBe('update-slab-params');
    expect(s.data).toMatchObject({ slabId: slab.id, isDragging: true });
  });
});
