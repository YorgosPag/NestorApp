/**
 * ADR-363 Phase 3.7 — `UpdateSlabOpeningParamsCommand` tests.
 *
 * Verifies:
 *   - execute / undo / redo round-trip patches params + recomputes geometry
 *     atomically. Validation host-relative checks active όταν host slab
 *     hydrated.
 *   - merge window (ADR-031): consecutive drag samples εντός time window
 *     collapse via canMergeWith / mergeWith.
 *   - soft-orphan: host slab missing → command patches params + geometry
 *     (intrinsic, slab-opening geometry δεν χρειάζεται host), validation
 *     intrinsic-only.
 *   - validator rejects invalid IDs / outlines.
 */

import { UpdateSlabOpeningParamsCommand } from '../UpdateSlabOpeningParamsCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import { computeSlabGeometry } from '../../../../bim/geometry/slab-geometry';
import { computeSlabOpeningGeometry } from '../../../../bim/geometry/slab-opening-geometry';
import type { SlabEntity, SlabParams } from '../../../../bim/types/slab-types';
import type {
  SlabOpeningEntity,
  SlabOpeningParams,
} from '../../../../bim/types/slab-opening-types';

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

function makeSlab(id = 'slab_test'): SlabEntity {
  const params: SlabParams = {
    kind: 'floor',
    outline: {
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 10000, y: 0, z: 0 },
        { x: 10000, y: 10000, z: 0 },
        { x: 0, y: 10000, z: 0 },
      ],
    },
    levelElevation: 0,
    thickness: 200,
    geometryType: 'box',
  };
  return {
    id,
    type: 'slab',
    kind: 'floor',
    layerId: '0',
    params,
    geometry: computeSlabGeometry(params),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as SlabEntity;
}

function makeShaft(slab: SlabEntity, cx = 3000, cy = 3000): SlabOpeningEntity {
  const params: SlabOpeningParams = {
    kind: 'shaft',
    slabId: slab.id,
    outline: {
      vertices: [
        { x: cx - 750, y: cy - 750, z: 0 },
        { x: cx + 750, y: cy - 750, z: 0 },
        { x: cx + 750, y: cy + 750, z: 0 },
        { x: cx - 750, y: cy + 750, z: 0 },
      ],
    },
  };
  return {
    id: 'slbopn_test',
    type: 'slab-opening',
    kind: 'shaft',
    layerId: '0',
    params,
    geometry: computeSlabOpeningGeometry(params),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as SlabOpeningEntity;
}

function shiftedOutline(p: SlabOpeningParams, dx: number, dy: number): SlabOpeningParams {
  return {
    ...p,
    outline: {
      vertices: p.outline.vertices.map((v) => ({ x: v.x + dx, y: v.y + dy, z: v.z })),
    },
  };
}

describe('UpdateSlabOpeningParamsCommand (Phase 3.7)', () => {
  it('1. execute: patches params + recomputes geometry via SSoT', () => {
    const slab = makeSlab();
    const opening = makeShaft(slab, 3000, 3000);
    const { scene, sm } = makeMockScene([
      slab as unknown as SceneEntity,
      opening as unknown as SceneEntity,
    ]);
    const paramsB = shiftedOutline(opening.params, 500, 0);

    const cmd = new UpdateSlabOpeningParamsCommand(opening.id, paramsB, opening.params, sm);
    cmd.execute();

    const updated = scene.get(opening.id) as unknown as SlabOpeningEntity;
    expect(updated.params.outline.vertices[0].x).toBeCloseTo(
      opening.params.outline.vertices[0].x + 500,
      1,
    );
    // bbox shifts by +500mm σε X axis.
    expect(updated.geometry.bbox.min.x).toBeCloseTo(opening.geometry.bbox.min.x + 500, 1);
    expect(updated.validation).toBeDefined();
  });

  it('2. undo: restores previous params + geometry', () => {
    const slab = makeSlab();
    const opening = makeShaft(slab, 3000, 3000);
    const { scene, sm } = makeMockScene([
      slab as unknown as SceneEntity,
      opening as unknown as SceneEntity,
    ]);
    const paramsB = shiftedOutline(opening.params, 500, 0);

    const cmd = new UpdateSlabOpeningParamsCommand(opening.id, paramsB, opening.params, sm);
    cmd.execute();
    cmd.undo();

    const reverted = scene.get(opening.id) as unknown as SlabOpeningEntity;
    expect(reverted.params.outline.vertices[0].x).toBeCloseTo(
      opening.params.outline.vertices[0].x,
      1,
    );
  });

  it('3. redo: re-applies after undo', () => {
    const slab = makeSlab();
    const opening = makeShaft(slab, 3000, 3000);
    const { scene, sm } = makeMockScene([
      slab as unknown as SceneEntity,
      opening as unknown as SceneEntity,
    ]);
    const paramsB = shiftedOutline(opening.params, 500, 0);

    const cmd = new UpdateSlabOpeningParamsCommand(opening.id, paramsB, opening.params, sm);
    cmd.execute();
    cmd.undo();
    cmd.redo();

    const updated = scene.get(opening.id) as unknown as SlabOpeningEntity;
    expect(updated.params.outline.vertices[0].x).toBeCloseTo(
      opening.params.outline.vertices[0].x + 500,
      1,
    );
  });

  it('4. undo before execute is a no-op', () => {
    const slab = makeSlab();
    const opening = makeShaft(slab, 3000, 3000);
    const { scene, sm } = makeMockScene([
      slab as unknown as SceneEntity,
      opening as unknown as SceneEntity,
    ]);
    const paramsB = shiftedOutline(opening.params, 1234, 0);

    const cmd = new UpdateSlabOpeningParamsCommand(opening.id, paramsB, opening.params, sm);
    cmd.undo();
    const e = scene.get(opening.id) as unknown as SlabOpeningEntity;
    expect(e.params.outline.vertices[0].x).toBeCloseTo(
      opening.params.outline.vertices[0].x,
      1,
    );
  });

  it('5. canMergeWith: same opening, both dragging, within window', () => {
    const slab = makeSlab();
    const opening = makeShaft(slab);
    const { sm } = makeMockScene([
      slab as unknown as SceneEntity,
      opening as unknown as SceneEntity,
    ]);

    const cmd1 = new UpdateSlabOpeningParamsCommand(opening.id, opening.params, opening.params, sm, true);
    const cmd2 = new UpdateSlabOpeningParamsCommand(opening.id, opening.params, opening.params, sm, true);
    expect(cmd1.canMergeWith(cmd2)).toBe(true);

    const merged = cmd1.mergeWith(cmd2) as UpdateSlabOpeningParamsCommand;
    expect(merged).toBeInstanceOf(UpdateSlabOpeningParamsCommand);
    expect(merged.getAffectedEntityIds()).toEqual([opening.id]);
  });

  it('6. canMergeWith: false όταν isDragging=false σε any side', () => {
    const slab = makeSlab();
    const opening = makeShaft(slab);
    const { sm } = makeMockScene([slab as unknown as SceneEntity, opening as unknown as SceneEntity]);
    const cmdA = new UpdateSlabOpeningParamsCommand(opening.id, opening.params, opening.params, sm, false);
    const cmdB = new UpdateSlabOpeningParamsCommand(opening.id, opening.params, opening.params, sm, true);
    expect(cmdA.canMergeWith(cmdB)).toBe(false);
    expect(cmdB.canMergeWith(cmdA)).toBe(false);
  });

  it('7. canMergeWith: false across different openings', () => {
    const slab = makeSlab();
    const opening = makeShaft(slab);
    const { sm } = makeMockScene([slab as unknown as SceneEntity, opening as unknown as SceneEntity]);
    const cmdA = new UpdateSlabOpeningParamsCommand(opening.id, opening.params, opening.params, sm, true);
    const cmdB = new UpdateSlabOpeningParamsCommand('slbopn_other', opening.params, opening.params, sm, true);
    expect(cmdA.canMergeWith(cmdB)).toBe(false);
  });

  it('8. soft-orphan: host slab missing → patches params + recomputes geometry', () => {
    const slab = makeSlab();
    const opening = makeShaft(slab);
    // Scene without the host slab.
    const { scene, sm } = makeMockScene([opening as unknown as SceneEntity]);
    const paramsB = shiftedOutline(opening.params, 100, 0);

    const cmd = new UpdateSlabOpeningParamsCommand(opening.id, paramsB, opening.params, sm);
    cmd.execute();

    const updated = scene.get(opening.id) as unknown as SlabOpeningEntity;
    expect(updated.params.outline.vertices[0].x).toBeCloseTo(
      opening.params.outline.vertices[0].x + 100,
      1,
    );
    // Slab-opening geometry derives από outline only → πάντα recomputed,
    // ακόμα και χωρίς host.
    expect(updated.geometry.bbox.min.x).toBeCloseTo(opening.geometry.bbox.min.x + 100, 1);
    expect(updated.validation).toBeDefined();
  });

  it('9. validate rejects empty entity id', () => {
    const slab = makeSlab();
    const opening = makeShaft(slab);
    const { sm } = makeMockScene([slab as unknown as SceneEntity, opening as unknown as SceneEntity]);
    const cmd = new UpdateSlabOpeningParamsCommand('', opening.params, opening.params, sm);
    expect(cmd.validate()).toMatch(/Slab-opening entity ID/);
  });

  it('10. validate rejects degenerate outline (< 3 vertices)', () => {
    const slab = makeSlab();
    const opening = makeShaft(slab);
    const { sm } = makeMockScene([slab as unknown as SceneEntity, opening as unknown as SceneEntity]);
    const badOutline = new UpdateSlabOpeningParamsCommand(
      opening.id,
      {
        ...opening.params,
        outline: { vertices: [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }] },
      },
      opening.params,
      sm,
    );
    expect(badOutline.validate()).toMatch(/outline/);
  });

  it('11. serialize: round-trips key fields', () => {
    const slab = makeSlab();
    const opening = makeShaft(slab);
    const { sm } = makeMockScene([slab as unknown as SceneEntity, opening as unknown as SceneEntity]);
    const cmd = new UpdateSlabOpeningParamsCommand(opening.id, opening.params, opening.params, sm, true);
    const s = cmd.serialize();
    expect(s.type).toBe('update-slab-opening-params');
    expect(s.data).toMatchObject({ slabOpeningId: opening.id, isDragging: true });
  });
});
