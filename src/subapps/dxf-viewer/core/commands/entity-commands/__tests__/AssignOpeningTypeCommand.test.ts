/**
 * ADR-421 SLICE C / ADR-615 — `AssignOpeningTypeCommand` tests.
 *
 * Focus: the command must treat a SELF-HOSTED opening (free-standing κούφωμα on
 * imported DXF lines, `params.selfHost` set / `params.wallId` absent) as a
 * first-class host — the same way `UpdateOpeningParamsCommand` already does.
 *
 * Regression guarded here (was a live bug): `validate()` required `params.wallId`
 * unconditionally, so EVERY family-type assign/clear on a self-hosted opening was
 * silently rejected; and `applyState()` had no self-hosted branch, so even when it
 * ran, a type-driven width change left `geometry` stale.
 */

import { AssignOpeningTypeCommand, type OpeningTypeAssignment } from '../AssignOpeningTypeCommand';
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
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

function makeMockScene(initial: SceneEntity[] = []): {
  scene: Map<string, SceneEntity>;
  sm: ISceneManager;
} {
  const sm = createMockSceneManager(initial, { getEntityIndex: () => -1 });
  return { scene: sm.store, sm };
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

/** ADR-615 — same door, re-hosted on a synthetic free-standing host (no wall). */
function asSelfHosted(params: OpeningParams): OpeningParams {
  const { wallId: _wallId, ...rest } = params;
  return {
    ...rest,
    offsetFromStart: 0,
    selfHost: {
      anchor: { x: 2000, y: 0 },
      rotationRad: 0,
      hostThicknessMm: 100,
    },
  };
}

function assignment(params: OpeningParams, typeId: string | undefined): OpeningTypeAssignment {
  return { typeId, typeOverrides: undefined, params };
}

describe('AssignOpeningTypeCommand — host handling (ADR-615)', () => {
  it('1. wall-hosted: assigning a type recomputes geometry against the host wall', () => {
    const wall = makeWall();
    const opening = makeDoor(wall, 2000);
    const { scene, sm } = makeMockScene([
      wall as unknown as SceneEntity,
      opening as unknown as SceneEntity,
    ]);
    const widened: OpeningParams = { ...opening.params, width: opening.params.width + 200 };

    const cmd = new AssignOpeningTypeCommand(
      opening.id,
      assignment(widened, 'otype_1'),
      assignment(opening.params, undefined),
      sm,
    );
    expect(cmd.validate()).toBeNull();
    cmd.execute();

    const updated = scene.get(opening.id) as unknown as OpeningEntity;
    expect(updated.typeId).toBe('otype_1');
    expect(updated.params.width).toBe(widened.width);
    expect(updated.geometry).toBeDefined();
    expect(updated.validation).toBeDefined();
  });

  it('2. self-hosted: validate() accepts an opening hosted by selfHost (no wallId)', () => {
    const wall = makeWall();
    const opening = makeDoor(wall, 2000);
    const selfParams = asSelfHosted(opening.params);
    const { sm } = makeMockScene([opening as unknown as SceneEntity]);

    const cmd = new AssignOpeningTypeCommand(
      opening.id,
      assignment(selfParams, 'otype_1'),
      assignment(selfParams, undefined),
      sm,
    );
    // Before the ADR-615 fix this returned 'Opening params.wallId is required'
    // and the whole assign was dropped.
    expect(cmd.validate()).toBeNull();
  });

  it('3. self-hosted: a type-driven width change re-derives geometry (not stale)', () => {
    const wall = makeWall();
    const opening = makeDoor(wall, 2000);
    const selfParams = asSelfHosted(opening.params);
    const selfOpening = {
      ...opening,
      params: selfParams,
    } as unknown as SceneEntity;
    // Scene holds ONLY the opening — a self-hosted opening has no wall to find.
    const { scene, sm } = makeMockScene([selfOpening]);

    const widened: OpeningParams = { ...selfParams, width: selfParams.width + 400 };
    const cmd = new AssignOpeningTypeCommand(
      opening.id,
      assignment(widened, 'otype_wide'),
      assignment(selfParams, undefined),
      sm,
    );
    cmd.execute();

    const updated = scene.get(opening.id) as unknown as OpeningEntity;
    expect(updated.typeId).toBe('otype_wide');
    expect(updated.params.width).toBe(widened.width);
    // The synthetic host is rebuilt from selfHost → geometry MUST be recomputed
    // rather than fall through to the soft-orphan (stale-geometry) path.
    expect(updated.geometry).toBeDefined();
    expect(updated.geometry).not.toBe(opening.geometry);
  });

  it('4. self-hosted: undo restores the previous type and re-derives geometry', () => {
    const wall = makeWall();
    const opening = makeDoor(wall, 2000);
    const selfParams = asSelfHosted(opening.params);
    const { scene, sm } = makeMockScene([
      { ...opening, params: selfParams } as unknown as SceneEntity,
    ]);

    const widened: OpeningParams = { ...selfParams, width: selfParams.width + 400 };
    const cmd = new AssignOpeningTypeCommand(
      opening.id,
      assignment(widened, 'otype_wide'),
      assignment(selfParams, undefined),
      sm,
    );
    cmd.execute();
    cmd.undo();

    const reverted = scene.get(opening.id) as unknown as OpeningEntity;
    expect(reverted.typeId).toBeUndefined();
    expect(reverted.params.width).toBe(selfParams.width);
    expect(reverted.geometry).toBeDefined();
  });

  it('5. hostless: an opening with neither wallId nor selfHost is rejected', () => {
    const wall = makeWall();
    const opening = makeDoor(wall, 2000);
    const { wallId: _wallId, ...hostless } = opening.params;
    const { sm } = makeMockScene([opening as unknown as SceneEntity]);

    const cmd = new AssignOpeningTypeCommand(
      opening.id,
      assignment(hostless as OpeningParams, 'otype_1'),
      assignment(opening.params, undefined),
      sm,
    );
    expect(cmd.validate()).toMatch(/host/i);
  });

  it('6. soft-orphan: wall-hosted opening whose host is gone keeps its geometry', () => {
    const wall = makeWall();
    const opening = makeDoor(wall, 2000);
    // Scene without the host wall.
    const { scene, sm } = makeMockScene([opening as unknown as SceneEntity]);

    const cmd = new AssignOpeningTypeCommand(
      opening.id,
      assignment(opening.params, 'otype_1'),
      assignment(opening.params, undefined),
      sm,
    );
    cmd.execute();

    const updated = scene.get(opening.id) as unknown as OpeningEntity;
    expect(updated.typeId).toBe('otype_1');
    // ADR-363 §5.4 — geometry untouched, intrinsic validation only.
    expect(updated.geometry).toBe(opening.geometry);
    expect(updated.validation).toBeDefined();
  });
});
