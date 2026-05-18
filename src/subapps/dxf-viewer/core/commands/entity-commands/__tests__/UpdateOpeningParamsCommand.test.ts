/**
 * ADR-363 Phase 2.5 — `UpdateOpeningParamsCommand` tests.
 *
 * Verifies:
 *   - execute / undo / redo round-trip patches params + recomputes geometry
 *     + validation atomically against the host wall in the scene
 *   - merge window (ADR-031): consecutive drag samples within the time
 *     window collapse via `canMergeWith` / `mergeWith`
 *   - soft-orphan policy: host wall missing → command still patches params,
 *     intrinsic validation only (no host-relative checks)
 *   - validator rejects invalid IDs / negative dimensions
 */

import { UpdateOpeningParamsCommand } from '../UpdateOpeningParamsCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import {
  buildDefaultOpeningParams,
  buildOpeningEntity,
} from '../../../../hooks/drawing/opening-completion';
import {
  buildDefaultWallParams,
  buildWallEntity,
} from '../../../../hooks/drawing/wall-completion';
import type { OpeningEntity, OpeningParams } from '../../../../bim/types/opening-types';
import type { WallEntity } from '../../../../bim/types/wall-types';

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
  const r = buildWallEntity(buildDefaultWallParams({ x: 0, y: 0 }, { x: 4000, y: 0 }), '0', 'straight');
  if (!r.ok) throw new Error('wall build failed');
  return r.entity;
}

function makeDoor(host: WallEntity, clickX: number): OpeningEntity {
  const params = buildDefaultOpeningParams(host, { x: clickX, y: 0 }, { kind: 'door' });
  const r = buildOpeningEntity(params, host, '0');
  if (!r.ok) throw new Error('opening build failed: ' + r.hardErrors.join(','));
  return r.entity;
}

describe('UpdateOpeningParamsCommand (Phase 2.5)', () => {
  it('1. execute: patches params + recomputes geometry+validation via SSoT', () => {
    const wall = makeWall();
    const opening = makeDoor(wall, 2000);
    const { scene, sm } = makeMockScene([
      wall as unknown as SceneEntity,
      opening as unknown as SceneEntity,
    ]);
    const paramsB: OpeningParams = { ...opening.params, offsetFromStart: opening.params.offsetFromStart + 500 };

    const cmd = new UpdateOpeningParamsCommand(opening.id, paramsB, opening.params, sm);
    cmd.execute();

    const updated = scene.get(opening.id) as unknown as OpeningEntity;
    expect(updated.params.offsetFromStart).toBe(paramsB.offsetFromStart);
    // Geometry recomputed: position shifts by +500mm along +X axis.
    expect(updated.geometry.position.x).toBeCloseTo(opening.geometry.position.x + 500, 1);
    expect(updated.validation).toBeDefined();
  });

  it('2. undo: restores previous params + geometry', () => {
    const wall = makeWall();
    const opening = makeDoor(wall, 2000);
    const { scene, sm } = makeMockScene([
      wall as unknown as SceneEntity,
      opening as unknown as SceneEntity,
    ]);
    const paramsB: OpeningParams = { ...opening.params, offsetFromStart: opening.params.offsetFromStart + 500 };

    const cmd = new UpdateOpeningParamsCommand(opening.id, paramsB, opening.params, sm);
    cmd.execute();
    cmd.undo();

    const reverted = scene.get(opening.id) as unknown as OpeningEntity;
    expect(reverted.params.offsetFromStart).toBe(opening.params.offsetFromStart);
    expect(reverted.geometry.position.x).toBeCloseTo(opening.geometry.position.x, 1);
  });

  it('3. redo: re-applies after undo', () => {
    const wall = makeWall();
    const opening = makeDoor(wall, 2000);
    const { scene, sm } = makeMockScene([
      wall as unknown as SceneEntity,
      opening as unknown as SceneEntity,
    ]);
    const paramsB: OpeningParams = { ...opening.params, offsetFromStart: opening.params.offsetFromStart + 500 };

    const cmd = new UpdateOpeningParamsCommand(opening.id, paramsB, opening.params, sm);
    cmd.execute();
    cmd.undo();
    cmd.redo();

    const updated = scene.get(opening.id) as unknown as OpeningEntity;
    expect(updated.params.offsetFromStart).toBe(paramsB.offsetFromStart);
  });

  it('4. undo before execute is a no-op', () => {
    const wall = makeWall();
    const opening = makeDoor(wall, 2000);
    const { scene, sm } = makeMockScene([
      wall as unknown as SceneEntity,
      opening as unknown as SceneEntity,
    ]);
    const cmd = new UpdateOpeningParamsCommand(
      opening.id,
      { ...opening.params, offsetFromStart: 1234 },
      opening.params,
      sm,
    );
    cmd.undo();
    const e = scene.get(opening.id) as unknown as OpeningEntity;
    expect(e.params.offsetFromStart).toBe(opening.params.offsetFromStart);
  });

  it('5. canMergeWith: same opening, both dragging, within window', () => {
    const wall = makeWall();
    const opening = makeDoor(wall, 2000);
    const { sm } = makeMockScene([
      wall as unknown as SceneEntity,
      opening as unknown as SceneEntity,
    ]);

    const cmd1 = new UpdateOpeningParamsCommand(opening.id, opening.params, opening.params, sm, true);
    const cmd2 = new UpdateOpeningParamsCommand(opening.id, opening.params, opening.params, sm, true);
    expect(cmd1.canMergeWith(cmd2)).toBe(true);

    const merged = cmd1.mergeWith(cmd2) as UpdateOpeningParamsCommand;
    expect(merged).toBeInstanceOf(UpdateOpeningParamsCommand);
    expect(merged.getAffectedEntityIds()).toEqual([opening.id]);
  });

  it('6. canMergeWith: false when isDragging=false on either side', () => {
    const wall = makeWall();
    const opening = makeDoor(wall, 2000);
    const { sm } = makeMockScene([wall as unknown as SceneEntity, opening as unknown as SceneEntity]);
    const cmdA = new UpdateOpeningParamsCommand(opening.id, opening.params, opening.params, sm, false);
    const cmdB = new UpdateOpeningParamsCommand(opening.id, opening.params, opening.params, sm, true);
    expect(cmdA.canMergeWith(cmdB)).toBe(false);
    expect(cmdB.canMergeWith(cmdA)).toBe(false);
  });

  it('7. canMergeWith: false across different openings', () => {
    const wall = makeWall();
    const opening = makeDoor(wall, 2000);
    const { sm } = makeMockScene([wall as unknown as SceneEntity, opening as unknown as SceneEntity]);
    const cmdA = new UpdateOpeningParamsCommand(opening.id, opening.params, opening.params, sm, true);
    const cmdB = new UpdateOpeningParamsCommand('opening_other', opening.params, opening.params, sm, true);
    expect(cmdA.canMergeWith(cmdB)).toBe(false);
  });

  it('8. soft-orphan: host wall missing → patches params, validation intrinsic-only', () => {
    const wall = makeWall();
    const opening = makeDoor(wall, 2000);
    // Scene without the host wall — only the opening.
    const { scene, sm } = makeMockScene([opening as unknown as SceneEntity]);
    const paramsB: OpeningParams = { ...opening.params, offsetFromStart: opening.params.offsetFromStart + 100 };

    const cmd = new UpdateOpeningParamsCommand(opening.id, paramsB, opening.params, sm);
    cmd.execute();

    const updated = scene.get(opening.id) as unknown as OpeningEntity & { geometry?: unknown };
    expect(updated.params.offsetFromStart).toBe(paramsB.offsetFromStart);
    // Geometry not recomputed (host missing) — original geometry preserved.
    expect(updated.geometry).toBe(opening.geometry);
    expect(updated.validation).toBeDefined();
  });

  it('9. validate rejects empty entity id', () => {
    const wall = makeWall();
    const opening = makeDoor(wall, 2000);
    const { sm } = makeMockScene([wall as unknown as SceneEntity, opening as unknown as SceneEntity]);
    const cmd = new UpdateOpeningParamsCommand('', opening.params, opening.params, sm);
    expect(cmd.validate()).toMatch(/Opening entity ID/);
  });

  it('10. validate rejects negative dimensions / offsets', () => {
    const wall = makeWall();
    const opening = makeDoor(wall, 2000);
    const { sm } = makeMockScene([wall as unknown as SceneEntity, opening as unknown as SceneEntity]);
    const badWidth = new UpdateOpeningParamsCommand(
      opening.id,
      { ...opening.params, width: -1 },
      opening.params,
      sm,
    );
    const badOffset = new UpdateOpeningParamsCommand(
      opening.id,
      { ...opening.params, offsetFromStart: -1 },
      opening.params,
      sm,
    );
    expect(badWidth.validate()).toMatch(/width/);
    expect(badOffset.validate()).toMatch(/offsetFromStart/);
  });

  it('11. serialize: round-trips key fields', () => {
    const wall = makeWall();
    const opening = makeDoor(wall, 2000);
    const { sm } = makeMockScene([wall as unknown as SceneEntity, opening as unknown as SceneEntity]);
    const cmd = new UpdateOpeningParamsCommand(opening.id, opening.params, opening.params, sm, true);
    const s = cmd.serialize();
    expect(s.type).toBe('update-opening-params');
    expect(s.data).toMatchObject({ openingId: opening.id, isDragging: true });
  });
});
