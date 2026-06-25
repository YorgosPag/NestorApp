/**
 * ADR-401 Phase D — AttachWallsTopCommand tests.
 *
 * Batch, undoable attach of N walls' top to ONE structural host: verifies the
 * params patch (topBinding='attached' + host appended to attachTopToIds), undo
 * restoration, redo re-apply, idempotent host append, and validation.
 */

import { AttachWallsTopCommand } from '../AttachWallsTopCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import type { WallEntity, WallParams } from '../../../../bim/types/wall-types';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

function makeMockScene(initial: SceneEntity[] = []): {
  scene: Map<string, SceneEntity>;
  sm: ISceneManager;
} {
  const sm = createMockSceneManager(initial, { getEntityIndex: () => -1 });
  return { scene: sm.store, sm };
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

describe('AttachWallsTopCommand', () => {
  it('execute → topBinding="attached" + host appended to attachTopToIds', () => {
    const { scene, sm } = makeMockScene([makeWall('w1') as unknown as SceneEntity]);
    new AttachWallsTopCommand('beam_1', [{ wallId: 'w1', kind: 'straight' }], sm).execute();
    const p = paramsOf(scene, 'w1');
    expect(p.topBinding).toBe('attached');
    expect(p.attachTopToIds).toEqual(['beam_1']);
  });

  it('undo restores the previous binding + attach list', () => {
    const { scene, sm } = makeMockScene([makeWall('w1') as unknown as SceneEntity]);
    const cmd = new AttachWallsTopCommand('beam_1', [{ wallId: 'w1', kind: 'straight' }], sm);
    cmd.execute();
    cmd.undo();
    const p = paramsOf(scene, 'w1');
    expect(p.topBinding).toBe('storey-ceiling');
    expect(p.attachTopToIds).toBeUndefined();
  });

  it('redo re-applies the attach', () => {
    const { scene, sm } = makeMockScene([makeWall('w1') as unknown as SceneEntity]);
    const cmd = new AttachWallsTopCommand('beam_1', [{ wallId: 'w1', kind: 'straight' }], sm);
    cmd.execute();
    cmd.undo();
    cmd.redo();
    expect(paramsOf(scene, 'w1').attachTopToIds).toEqual(['beam_1']);
  });

  it('preserves an existing host and does not duplicate on re-execute', () => {
    const { scene, sm } = makeMockScene([
      makeWall('w1', { topBinding: 'attached', attachTopToIds: ['beam_0'] }) as unknown as SceneEntity,
    ]);
    const cmd = new AttachWallsTopCommand('beam_1', [{ wallId: 'w1', kind: 'straight' }], sm);
    cmd.execute();
    cmd.execute(); // patches built once → still no duplicate
    expect(paramsOf(scene, 'w1').attachTopToIds).toEqual(['beam_0', 'beam_1']);
  });

  it('attaches multiple walls in one command', () => {
    const { scene, sm } = makeMockScene([
      makeWall('w1') as unknown as SceneEntity,
      makeWall('w2') as unknown as SceneEntity,
    ]);
    new AttachWallsTopCommand('beam_1', [
      { wallId: 'w1', kind: 'straight' },
      { wallId: 'w2', kind: 'straight' },
    ], sm).execute();
    expect(paramsOf(scene, 'w1').topBinding).toBe('attached');
    expect(paramsOf(scene, 'w2').topBinding).toBe('attached');
  });

  it('validate + getAffectedEntityIds', () => {
    const { sm } = makeMockScene([]);
    const ok = new AttachWallsTopCommand('beam_1', [{ wallId: 'w1', kind: 'straight' }], sm);
    expect(ok.validate()).toBeNull();
    expect(ok.getAffectedEntityIds()).toEqual(['w1']);
    expect(new AttachWallsTopCommand('', [{ wallId: 'w1', kind: 'straight' }], sm).validate()).toMatch(/Host/);
    expect(new AttachWallsTopCommand('beam_1', [], sm).validate()).toMatch(/wall target/);
  });
});
