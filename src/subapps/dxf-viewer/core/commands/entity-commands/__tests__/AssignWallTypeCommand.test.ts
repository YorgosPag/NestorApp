/**
 * ADR-412 Φ4 — `AssignWallTypeCommand` tests.
 *
 * Verifies the undoable type-link mutation: execute sets `typeId`/`typeOverrides`
 * + folds the resolved params back (recomputing geometry/validation); undo
 * restores the prior (untyped) state; redo re-applies; clear yields a detach
 * description; validate guards id + dimensions; serialize round-trips.
 */

import {
  AssignWallTypeCommand,
  type WallTypeAssignment,
} from '../AssignWallTypeCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import { completeWallFromTwoClicks } from '../../../../hooks/drawing/wall-completion';
import type { WallEntity, WallParams } from '../../../../bim/types/wall-types';

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

function makeWall(): WallEntity {
  const r = completeWallFromTwoClicks({ x: 0, y: 0 }, { x: 4000, y: 0 }, '0');
  if (!r.ok) throw new Error('wall build failed: ' + r.hardErrors.join(','));
  return r.entity;
}

function assignment(params: WallParams, typeId: string | undefined): WallTypeAssignment {
  return { typeId, typeOverrides: undefined, params };
}

describe('AssignWallTypeCommand (ADR-412 Φ4)', () => {
  it('1. execute: sets typeId + folds resolved params, recomputes geometry', () => {
    const wall = makeWall();
    const { scene, sm } = makeMockScene([wall as unknown as SceneEntity]);
    const nextParams: WallParams = { ...wall.params, category: 'interior', thickness: 200 };

    const cmd = new AssignWallTypeCommand(
      wall.id,
      assignment(nextParams, 'bimftype-x'),
      assignment(wall.params, undefined),
      sm,
      wall.kind,
    );
    cmd.execute();

    const updated = scene.get(wall.id) as unknown as WallEntity;
    expect(updated.typeId).toBe('bimftype-x');
    expect(updated.params.category).toBe('interior');
    expect(updated.params.thickness).toBe(200);
    expect(updated.geometry).toBeDefined();
    expect(updated.validation).toBeDefined();
  });

  it('2. undo: restores the prior untyped state', () => {
    const wall = makeWall();
    const { scene, sm } = makeMockScene([wall as unknown as SceneEntity]);
    const nextParams: WallParams = { ...wall.params, category: 'interior' };

    const cmd = new AssignWallTypeCommand(
      wall.id,
      assignment(nextParams, 'bimftype-x'),
      assignment(wall.params, undefined),
      sm,
      wall.kind,
    );
    cmd.execute();
    cmd.undo();

    const reverted = scene.get(wall.id) as unknown as WallEntity;
    expect(reverted.typeId).toBeUndefined();
    expect(reverted.params.category).toBe(wall.params.category);
  });

  it('3. redo: re-applies after undo', () => {
    const wall = makeWall();
    const { scene, sm } = makeMockScene([wall as unknown as SceneEntity]);
    const cmd = new AssignWallTypeCommand(
      wall.id,
      assignment({ ...wall.params, category: 'partition' }, 'bimftype-y'),
      assignment(wall.params, undefined),
      sm,
      wall.kind,
    );
    cmd.execute();
    cmd.undo();
    cmd.redo();

    const updated = scene.get(wall.id) as unknown as WallEntity;
    expect(updated.typeId).toBe('bimftype-y');
    expect(updated.params.category).toBe('partition');
  });

  it('4. undo before execute is a no-op', () => {
    const wall = makeWall();
    const { scene, sm } = makeMockScene([wall as unknown as SceneEntity]);
    const cmd = new AssignWallTypeCommand(
      wall.id,
      assignment(wall.params, 'bimftype-x'),
      assignment(wall.params, undefined),
      sm,
    );
    cmd.undo();
    // No-op: the wall keeps whatever type it was created with (a default wall is
    // auto-linked to its built-in via resolveAutoWallTypeId — ADR-447/449), so the
    // assertion is «unchanged from the original», not «undefined».
    expect((scene.get(wall.id) as unknown as WallEntity).typeId).toBe(wall.typeId);
  });

  it('5. getDescription reflects assign vs clear', () => {
    const wall = makeWall();
    const { sm } = makeMockScene([wall as unknown as SceneEntity]);
    const assign = new AssignWallTypeCommand(
      wall.id, assignment(wall.params, 'bimftype-x'), assignment(wall.params, undefined), sm);
    const clear = new AssignWallTypeCommand(
      wall.id, assignment(wall.params, undefined), assignment(wall.params, 'bimftype-x'), sm);
    expect(assign.getDescription()).toMatch(/Assign wall type/);
    expect(clear.getDescription()).toMatch(/Clear wall type/);
  });

  it('6. validate rejects empty id + non-positive dimensions', () => {
    const wall = makeWall();
    const { sm } = makeMockScene([wall as unknown as SceneEntity]);
    expect(
      new AssignWallTypeCommand('', assignment(wall.params, 'x'), assignment(wall.params, undefined), sm).validate(),
    ).toMatch(/Wall entity ID/);
    expect(
      new AssignWallTypeCommand(
        wall.id,
        assignment({ ...wall.params, thickness: 0 }, 'x'),
        assignment(wall.params, undefined),
        sm,
      ).validate(),
    ).toMatch(/thickness/);
  });

  it('7. serialize round-trips key fields', () => {
    const wall = makeWall();
    const { sm } = makeMockScene([wall as unknown as SceneEntity]);
    const cmd = new AssignWallTypeCommand(
      wall.id, assignment(wall.params, 'bimftype-x'), assignment(wall.params, undefined), sm);
    const s = cmd.serialize();
    expect(s.type).toBe('assign-wall-type');
    expect(s.data).toMatchObject({ wallId: wall.id });
    expect(cmd.getAffectedEntityIds()).toEqual([wall.id]);
  });
});
