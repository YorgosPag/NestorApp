/**
 * ADR-401 Phase G.3 — AttachStairsCommand + DetachStairsCommand tests.
 *
 * Verifies the batch attach/detach of stair top/base to a structural host:
 *   - execute sets binding 'attached' + appends host id (dedup), recompute atomic
 *   - undo / redo round-trip from a once-built snapshot
 *   - detach resets binding to the stair default (top='unconnected') + clears ids
 *   - validate / serialize
 */

import { AttachStairsCommand } from '../AttachStairsCommand';
import { DetachStairsCommand } from '../DetachStairsCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import type { StairEntity } from '../../../../bim/types/stair-types';
import { buildDefaultStairParams } from '../../../../hooks/drawing/stair-completion';
import {
  DEFAULT_STAIR_TOP_BINDING,
  DEFAULT_STAIR_BASE_BINDING,
} from '../../../../bim/types/bim-binding';

function makeMockScene(initial: SceneEntity[] = []): { scene: Map<string, SceneEntity>; sm: ISceneManager } {
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

function makeStair(overrides: Record<string, unknown> = {}): StairEntity {
  const params = { ...buildDefaultStairParams({ x: 0, y: 0 }, 0), ...overrides };
  return {
    id: 'stair_1', type: 'stair', kind: 'straight', params,
  } as unknown as StairEntity;
}

const TARGET = { stairId: 'stair_1', kind: 'straight' as const };

describe('AttachStairsCommand', () => {
  it('top: execute sets topBinding="attached" + appends host id', () => {
    const s = makeStair();
    const { scene, sm } = makeMockScene([s as unknown as SceneEntity]);
    new AttachStairsCommand('top', 'beam_1', [TARGET], sm).execute();
    const u = scene.get('stair_1') as unknown as StairEntity;
    expect(u.params.topBinding).toBe('attached');
    expect(u.params.attachTopToIds).toEqual(['beam_1']);
  });

  it('base: execute sets baseBinding="attached" + appends host id', () => {
    const s = makeStair();
    const { scene, sm } = makeMockScene([s as unknown as SceneEntity]);
    new AttachStairsCommand('base', 'slab_1', [TARGET], sm).execute();
    const u = scene.get('stair_1') as unknown as StairEntity;
    expect(u.params.baseBinding).toBe('attached');
    expect(u.params.attachBaseToIds).toEqual(['slab_1']);
  });

  it('dedups the host id when already present', () => {
    const s = makeStair({ topBinding: 'attached', attachTopToIds: ['beam_1'] });
    const { scene, sm } = makeMockScene([s as unknown as SceneEntity]);
    new AttachStairsCommand('top', 'beam_1', [TARGET], sm).execute();
    const u = scene.get('stair_1') as unknown as StairEntity;
    expect(u.params.attachTopToIds).toEqual(['beam_1']);
  });

  it('undo restores the previous binding + ids; redo re-applies', () => {
    const s = makeStair();
    const { scene, sm } = makeMockScene([s as unknown as SceneEntity]);
    const cmd = new AttachStairsCommand('top', 'beam_1', [TARGET], sm);
    cmd.execute();
    cmd.undo();
    let u = scene.get('stair_1') as unknown as StairEntity;
    expect(u.params.topBinding).toBe(s.params.topBinding);
    expect(u.params.attachTopToIds).toBeUndefined();
    cmd.redo();
    u = scene.get('stair_1') as unknown as StairEntity;
    expect(u.params.topBinding).toBe('attached');
  });

  it('validate + serialize', () => {
    const s = makeStair();
    const { sm } = makeMockScene([s as unknown as SceneEntity]);
    const ok = new AttachStairsCommand('top', 'beam_1', [TARGET], sm);
    expect(ok.validate()).toBeNull();
    expect(ok.getAffectedEntityIds()).toEqual(['stair_1']);
    expect(new AttachStairsCommand('top', '', [TARGET], sm).validate()).toMatch(/Host/);
    expect(new AttachStairsCommand('top', 'beam_1', [], sm).validate()).toMatch(/At least one/);
    const ser = ok.serialize();
    expect(ser.type).toBe('attach-stairs');
    expect(ser.data).toMatchObject({ side: 'top', hostId: 'beam_1' });
  });
});

describe('DetachStairsCommand', () => {
  it('top: resets binding to stair default "unconnected" + clears attachTopToIds', () => {
    const s = makeStair({ topBinding: 'attached', attachTopToIds: ['beam_1', 'beam_2'] });
    const { scene, sm } = makeMockScene([s as unknown as SceneEntity]);
    new DetachStairsCommand('top', [TARGET], sm).execute();
    const u = scene.get('stair_1') as unknown as StairEntity;
    expect(u.params.topBinding).toBe(DEFAULT_STAIR_TOP_BINDING);
    expect(u.params.attachTopToIds).toBeUndefined();
  });

  it('base: resets binding to "storey-floor" + clears attachBaseToIds; undo restores', () => {
    const s = makeStair({ baseBinding: 'attached', attachBaseToIds: ['slab_1'] });
    const { scene, sm } = makeMockScene([s as unknown as SceneEntity]);
    const cmd = new DetachStairsCommand('base', [TARGET], sm);
    cmd.execute();
    let u = scene.get('stair_1') as unknown as StairEntity;
    expect(u.params.baseBinding).toBe(DEFAULT_STAIR_BASE_BINDING);
    expect(u.params.attachBaseToIds).toBeUndefined();
    cmd.undo();
    u = scene.get('stair_1') as unknown as StairEntity;
    expect(u.params.baseBinding).toBe('attached');
    expect(u.params.attachBaseToIds).toEqual(['slab_1']);
  });

  it('validate + serialize', () => {
    const s = makeStair();
    const { sm } = makeMockScene([s as unknown as SceneEntity]);
    const cmd = new DetachStairsCommand('top', [TARGET], sm);
    expect(cmd.validate()).toBeNull();
    expect(new DetachStairsCommand('top', [], sm).validate()).toMatch(/At least one/);
    expect(cmd.serialize().type).toBe('detach-stairs');
  });
});
