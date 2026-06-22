/**
 * ADR-412/414 — `UpdateWallParamsCommand` auto family-type re-flow.
 *
 * Regression guard for the «wall thickness doesn't save» bug: a default wall is
 * auto-linked to a read-only built-in type, so a cross-section edit that left
 * `typeId` pointing at the old built-in was overwritten on reload by «type always
 * wins» (docToEntity). The command now re-runs the creation-time auto-type policy
 * (`resolveAutoWallTypeId`) on every param edit for AUTO-linked / untyped walls:
 *   - custom cross-section → detach (`typeId` undefined → reload keeps the edit),
 *   - still-matching seed   → relink to that built-in (effective === params),
 *   - undo restores the original link,
 *   - a user-assigned CUSTOM type is left untouched.
 */

import { UpdateWallParamsCommand } from '../UpdateWallParamsCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import { completeWallFromTwoClicks } from '../../../../hooks/drawing/wall-completion';
import { getDefaultDnaForCategory } from '../../../../bim/types/wall-dna-types';
import { isBuiltInWallTypeId, getBuiltInWallTypeId } from '../../../../bim/family-types/built-in-types';
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
    getEntities: () => Array.from(scene.values()),
    getVertices: () => undefined,
    insertVertex: () => {},
    removeVertex: () => {},
    updateVertex: () => {},
    getEntityIndex: () => -1,
    reorderEntity: () => {},
    moveEntityToIndex: () => {},
  } as unknown as ISceneManager;
  return { scene, sm };
}

/** Default exterior wall — auto-linked to its built-in (dna matches the seed). */
function makeWall(): WallEntity {
  const r = completeWallFromTwoClicks({ x: 0, y: 0 }, { x: 4000, y: 0 }, '0');
  if (!r.ok) throw new Error('wall build failed: ' + r.hardErrors.join(','));
  return r.entity;
}

function readWall(scene: Map<string, SceneEntity>, id: string): WallEntity {
  return scene.get(id) as unknown as WallEntity;
}

describe('UpdateWallParamsCommand — auto family-type re-flow (ADR-412/414)', () => {
  it('0. a default wall starts auto-linked to a built-in type', () => {
    const wall = makeWall();
    expect(isBuiltInWallTypeId(wall.typeId)).toBe(true);
  });

  it('1. custom thickness edit detaches the wall (typeId → undefined)', () => {
    const wall = makeWall();
    const { scene, sm } = makeMockScene([wall as unknown as SceneEntity]);
    // thickness diverges from the seed (dna.totalThickness stays 250) → no seed match.
    const next: WallParams = { ...wall.params, thickness: wall.params.thickness + 83 };

    new UpdateWallParamsCommand(wall.id, next, wall.params, sm, false, wall.kind).execute();

    const updated = readWall(scene, wall.id);
    expect(updated.params.thickness).toBe(wall.params.thickness + 83);
    expect(updated.typeId).toBeUndefined();
    expect(updated.typeOverrides).toBeUndefined();
  });

  it('2. editing to another seed relinks to that built-in', () => {
    const wall = makeWall();
    const { scene, sm } = makeMockScene([wall as unknown as SceneEntity]);
    const interiorDna = getDefaultDnaForCategory('interior');
    const next: WallParams = {
      ...wall.params,
      category: 'interior',
      dna: interiorDna,
      thickness: interiorDna.totalThickness,
    };

    new UpdateWallParamsCommand(wall.id, next, wall.params, sm, false, wall.kind).execute();

    const updated = readWall(scene, wall.id);
    expect(updated.typeId).toBe(getBuiltInWallTypeId('interior'));
  });

  it('3. undo restores the original built-in link + params', () => {
    const wall = makeWall();
    const { scene, sm } = makeMockScene([wall as unknown as SceneEntity]);
    const next: WallParams = { ...wall.params, thickness: wall.params.thickness + 83 };

    const cmd = new UpdateWallParamsCommand(wall.id, next, wall.params, sm, false, wall.kind);
    cmd.execute();
    expect(readWall(scene, wall.id).typeId).toBeUndefined();
    cmd.undo();

    const reverted = readWall(scene, wall.id);
    expect(reverted.params.thickness).toBe(wall.params.thickness);
    expect(reverted.typeId).toBe(wall.typeId);
  });

  it('4. a user-assigned CUSTOM type is left untouched on edit', () => {
    const wall = makeWall();
    const custom: WallEntity = {
      ...wall,
      typeId: 'bimftype-user-custom-xyz',
      typeOverrides: { thickness: 999 },
    };
    const { scene, sm } = makeMockScene([custom as unknown as SceneEntity]);
    const next: WallParams = { ...custom.params, thickness: custom.params.thickness + 50 };

    new UpdateWallParamsCommand(custom.id, next, custom.params, sm, false, custom.kind).execute();

    const updated = readWall(scene, custom.id);
    expect(updated.typeId).toBe('bimftype-user-custom-xyz');
    expect(updated.typeOverrides).toEqual({ thickness: 999 });
  });
});
