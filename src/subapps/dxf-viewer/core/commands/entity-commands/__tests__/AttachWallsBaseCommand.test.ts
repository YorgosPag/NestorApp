/**
 * ADR-401 (γ) — AttachWallsBaseCommand tests.
 *
 * Batch, undoable attach of N walls' BASE to ONE structural host (foundation
 * beam / slab): verifies the params patch (baseBinding='attached' + host appended
 * to attachBaseToIds), undo restoration, redo re-apply, idempotent host append,
 * and validation. Exact mirror of AttachWallsTopCommand (base direction).
 */

import { AttachWallsBaseCommand } from '../AttachWallsBaseCommand';
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
  };
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

describe('AttachWallsBaseCommand', () => {
  it('execute → baseBinding="attached" + host appended to attachBaseToIds', () => {
    const { scene, sm } = makeMockScene([makeWall('w1') as unknown as SceneEntity]);
    new AttachWallsBaseCommand('foundation_1', [{ wallId: 'w1', kind: 'straight' }], sm).execute();
    const p = paramsOf(scene, 'w1');
    expect(p.baseBinding).toBe('attached');
    expect(p.attachBaseToIds).toEqual(['foundation_1']);
  });

  it('undo restores the previous binding + attach list', () => {
    const { scene, sm } = makeMockScene([makeWall('w1') as unknown as SceneEntity]);
    const cmd = new AttachWallsBaseCommand('foundation_1', [{ wallId: 'w1', kind: 'straight' }], sm);
    cmd.execute();
    cmd.undo();
    const p = paramsOf(scene, 'w1');
    expect(p.baseBinding).toBe('storey-floor');
    expect(p.attachBaseToIds).toBeUndefined();
  });

  it('redo re-applies the attach', () => {
    const { scene, sm } = makeMockScene([makeWall('w1') as unknown as SceneEntity]);
    const cmd = new AttachWallsBaseCommand('foundation_1', [{ wallId: 'w1', kind: 'straight' }], sm);
    cmd.execute();
    cmd.undo();
    cmd.redo();
    expect(paramsOf(scene, 'w1').attachBaseToIds).toEqual(['foundation_1']);
  });

  it('preserves an existing host and does not duplicate on re-execute', () => {
    const { scene, sm } = makeMockScene([
      makeWall('w1', { baseBinding: 'attached', attachBaseToIds: ['foundation_0'] }) as unknown as SceneEntity,
    ]);
    const cmd = new AttachWallsBaseCommand('foundation_1', [{ wallId: 'w1', kind: 'straight' }], sm);
    cmd.execute();
    cmd.execute(); // patches built once → still no duplicate
    expect(paramsOf(scene, 'w1').attachBaseToIds).toEqual(['foundation_0', 'foundation_1']);
  });

  it('attaches multiple walls in one command', () => {
    const { scene, sm } = makeMockScene([
      makeWall('w1') as unknown as SceneEntity,
      makeWall('w2') as unknown as SceneEntity,
    ]);
    new AttachWallsBaseCommand('foundation_1', [
      { wallId: 'w1', kind: 'straight' },
      { wallId: 'w2', kind: 'straight' },
    ], sm).execute();
    expect(paramsOf(scene, 'w1').baseBinding).toBe('attached');
    expect(paramsOf(scene, 'w2').baseBinding).toBe('attached');
  });

  it('validate + getAffectedEntityIds', () => {
    const { sm } = makeMockScene([]);
    const ok = new AttachWallsBaseCommand('foundation_1', [{ wallId: 'w1', kind: 'straight' }], sm);
    expect(ok.validate()).toBeNull();
    expect(ok.getAffectedEntityIds()).toEqual(['w1']);
    expect(new AttachWallsBaseCommand('', [{ wallId: 'w1', kind: 'straight' }], sm).validate()).toMatch(/Host/);
    expect(new AttachWallsBaseCommand('foundation_1', [], sm).validate()).toMatch(/wall target/);
  });
});
