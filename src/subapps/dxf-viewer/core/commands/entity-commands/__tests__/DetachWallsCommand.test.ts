/**
 * ADR-401 Phase E.1 — DetachWallsCommand tests.
 *
 * Batch, undoable detach of N walls' top/base: verifies binding reset to default
 * + host-list cleared, undo restoration, redo re-apply, multi-wall, validation.
 * Inverse of AttachWalls{Top|Base}Command.
 */

import { DetachWallsCommand } from '../DetachWallsCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import type { WallEntity, WallParams } from '../../../../bim/types/wall-types';

function makeMockScene(initial: SceneEntity[] = []): {
  scene: Map<string, SceneEntity>;
  sm: ISceneManager;
} {
  const scene = new Map<string, SceneEntity>(initial.map((e) => [e.id, e]));
  const sm: ISceneManager = {
    getEntity: (id) => scene.get(id),
    getEntities: () => [...scene.values()],
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
  } as unknown as ISceneManager;
  return { scene, sm };
}

function makeWall(id: string, overrides: Partial<WallParams> = {}): WallEntity {
  return {
    id,
    type: 'wall',
    kind: 'straight',
    layerId: 'L',
    params: {
      category: 'exterior',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 4000, y: 0, z: 0 },
      height: 3000,
      thickness: 250,
      flip: false,
      topBinding: 'storey-ceiling',
      baseBinding: 'storey-floor',
      baseOffset: 0,
      topOffset: 0,
      sceneUnits: 'mm',
      ...overrides,
    },
    geometry: { bbox: { min: { x: 0, y: -125 }, max: { x: 4000, y: 125 } } },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as WallEntity;
}

const paramsOf = (scene: Map<string, SceneEntity>, id: string): WallParams =>
  (scene.get(id) as unknown as WallEntity).params;

describe('DetachWallsCommand', () => {
  it('detach top → topBinding="storey-ceiling" + attachTopToIds cleared', () => {
    const { scene, sm } = makeMockScene([
      makeWall('w1', { topBinding: 'attached', attachTopToIds: ['beam_1'] }) as unknown as SceneEntity,
    ]);
    new DetachWallsCommand('top', [{ wallId: 'w1', kind: 'straight' }], sm).execute();
    const p = paramsOf(scene, 'w1');
    expect(p.topBinding).toBe('storey-ceiling');
    expect(p.attachTopToIds).toBeUndefined();
  });

  it('detach base → baseBinding="storey-floor" + attachBaseToIds cleared', () => {
    const { scene, sm } = makeMockScene([
      makeWall('w1', { baseBinding: 'attached', attachBaseToIds: ['foundation_1'] }) as unknown as SceneEntity,
    ]);
    new DetachWallsCommand('base', [{ wallId: 'w1', kind: 'straight' }], sm).execute();
    const p = paramsOf(scene, 'w1');
    expect(p.baseBinding).toBe('storey-floor');
    expect(p.attachBaseToIds).toBeUndefined();
  });

  it('undo restores the attached binding + host list (top)', () => {
    const { scene, sm } = makeMockScene([
      makeWall('w1', { topBinding: 'attached', attachTopToIds: ['beam_1'] }) as unknown as SceneEntity,
    ]);
    const cmd = new DetachWallsCommand('top', [{ wallId: 'w1', kind: 'straight' }], sm);
    cmd.execute();
    cmd.undo();
    const p = paramsOf(scene, 'w1');
    expect(p.topBinding).toBe('attached');
    expect(p.attachTopToIds).toEqual(['beam_1']);
  });

  it('redo re-applies the detach', () => {
    const { scene, sm } = makeMockScene([
      makeWall('w1', { topBinding: 'attached', attachTopToIds: ['beam_1'] }) as unknown as SceneEntity,
    ]);
    const cmd = new DetachWallsCommand('top', [{ wallId: 'w1', kind: 'straight' }], sm);
    cmd.execute();
    cmd.undo();
    cmd.redo();
    expect(paramsOf(scene, 'w1').topBinding).toBe('storey-ceiling');
    expect(paramsOf(scene, 'w1').attachTopToIds).toBeUndefined();
  });

  it('detaches multiple walls in one command', () => {
    const { scene, sm } = makeMockScene([
      makeWall('w1', { baseBinding: 'attached', attachBaseToIds: ['f1'] }) as unknown as SceneEntity,
      makeWall('w2', { baseBinding: 'attached', attachBaseToIds: ['f1'] }) as unknown as SceneEntity,
    ]);
    new DetachWallsCommand('base', [
      { wallId: 'w1', kind: 'straight' },
      { wallId: 'w2', kind: 'straight' },
    ], sm).execute();
    expect(paramsOf(scene, 'w1').baseBinding).toBe('storey-floor');
    expect(paramsOf(scene, 'w2').baseBinding).toBe('storey-floor');
  });

  it('validate + getAffectedEntityIds', () => {
    const { sm } = makeMockScene([]);
    const ok = new DetachWallsCommand('top', [{ wallId: 'w1', kind: 'straight' }], sm);
    expect(ok.validate()).toBeNull();
    expect(ok.getAffectedEntityIds()).toEqual(['w1']);
    expect(new DetachWallsCommand('top', [], sm).validate()).toMatch(/wall target/);
  });
});
