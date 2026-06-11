/**
 * ADR-441 Slice 6b — RehostFoundationsCommand tests.
 *
 * Update-semantics (όχι add/remove): execute merge-άρει bindings+params+geometry,
 * undo τα επαναφέρει στα original. Τα deferred `bim:entities-attached` side-effects
 * τρέχουν σε microtask, ακίνδυνα χωρίς listeners.
 */

import { RehostFoundationsCommand } from '../RehostFoundationsCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import type { FoundationEntity } from '../../../../bim/types/foundation-types';
import type { RehostedStrip } from '../../../../bim/foundations/foundation-grid-rehost';
import type { GuideBinding } from '../../../../bim/hosting/guide-binding-types';

function makeMockScene(seed: SceneEntity[] = []): { scene: Map<string, SceneEntity>; sm: ISceneManager } {
  const scene = new Map<string, SceneEntity>();
  for (const e of seed) scene.set(e.id, e);
  const sm: ISceneManager = {
    getEntity: (id) => scene.get(id),
    addEntity: (e) => { scene.set(e.id, e); },
    removeEntity: (id) => { scene.delete(id); },
    updateEntity: (id, updates) => {
      const cur = scene.get(id);
      if (cur) scene.set(id, { ...cur, ...updates } as SceneEntity);
    },
    updateEntities: () => {},
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

const BIND: GuideBinding[] = [
  { guideId: 'x0', slot: 'start-x' }, { guideId: 'x0', slot: 'end-x' },
  { guideId: 'y0', slot: 'start-y' }, { guideId: 'y1', slot: 'end-y' },
];

/** original = ορφανός (no bindings)· rehosted = ίδιο id + bindings/snapped coords. */
function makeRehost(id: string): RehostedStrip {
  const base = {
    id, type: 'foundation', kind: 'strip', layerId: 'lyr', visible: true,
  };
  const original = {
    ...base,
    params: { kind: 'strip', start: { x: 5, y: 0, z: 0 }, end: { x: 5, y: 9, z: 0 }, width: 800, topElevationMm: 0, thicknessMm: 400 },
    geometry: { area: 1 },
  } as unknown as FoundationEntity;
  const rehosted = {
    ...base,
    params: { kind: 'strip', start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 10, z: 0 }, width: 800, topElevationMm: 0, thicknessMm: 400 },
    geometry: { area: 2 },
    guideBindings: BIND,
  } as unknown as FoundationEntity;
  return { original, rehosted };
}

describe('RehostFoundationsCommand', () => {
  it('execute merges bindings + snapped params + geometry into the scene entity', () => {
    const r = makeRehost('f1');
    const { scene, sm } = makeMockScene([r.original as unknown as SceneEntity]);
    new RehostFoundationsCommand([r], sm).execute();
    const e = scene.get('f1') as unknown as FoundationEntity;
    expect(e.guideBindings).toEqual(BIND);
    expect((e.params as { start: { x: number } }).start.x).toBe(0);
    expect(e.geometry).toEqual({ area: 2 });
  });

  it('undo reverts to the original (no bindings, original params)', () => {
    const r = makeRehost('f1');
    const { scene, sm } = makeMockScene([r.original as unknown as SceneEntity]);
    const cmd = new RehostFoundationsCommand([r], sm);
    cmd.execute();
    cmd.undo();
    const e = scene.get('f1') as unknown as FoundationEntity;
    expect(e.guideBindings).toBeUndefined();
    expect((e.params as { start: { x: number } }).start.x).toBe(5);
  });

  it('redo re-applies the re-host', () => {
    const r = makeRehost('f1');
    const { scene, sm } = makeMockScene([r.original as unknown as SceneEntity]);
    const cmd = new RehostFoundationsCommand([r], sm);
    cmd.execute();
    cmd.undo();
    cmd.redo();
    expect((scene.get('f1') as unknown as FoundationEntity).guideBindings).toEqual(BIND);
  });

  it('undo before execute is a no-op', () => {
    const r = makeRehost('f1');
    const { scene, sm } = makeMockScene([r.original as unknown as SceneEntity]);
    new RehostFoundationsCommand([r], sm).undo();
    expect((scene.get('f1') as unknown as FoundationEntity).guideBindings).toBeUndefined();
  });

  it('validate rejects an empty batch; getAffectedEntityIds lists ids', () => {
    const { sm } = makeMockScene();
    expect(new RehostFoundationsCommand([], sm).validate()).not.toBeNull();
    const cmd = new RehostFoundationsCommand([makeRehost('f1'), makeRehost('f2')], sm);
    expect(cmd.validate()).toBeNull();
    expect(cmd.getAffectedEntityIds().sort()).toEqual(['f1', 'f2']);
  });
});
