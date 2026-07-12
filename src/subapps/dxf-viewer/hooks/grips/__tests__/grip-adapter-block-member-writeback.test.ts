/**
 * ADR-641 Φ4 — the grip scene-manager adapter is BLOCK-member-aware: while a Block Editor session is
 * open (BEDIT), a member's own id resolves + writes back INTO the active block's `.entities`. Mirror of
 * `grip-adapter-member-writeback.test.ts` (GROUP), but the descent is gated on `getActiveBlockEditId()`.
 */

import { createSceneManagerAdapter } from '../grip-scene-manager-adapter';
import { enterBlockEdit, exitBlockEdit } from '../../../systems/block/ActiveBlockEditStore';
import type { DxfCommitDeps } from '../unified-grip-types';
import type { SceneModel } from '../../../types/scene';
import type { Entity, BlockEntity } from '../../../types/entities';

const mkLine = (id: string, x0 = 0, y0 = 0, x1 = 1, y1 = 1): Entity =>
  ({ id, type: 'line', layerId: 'l', visible: true, start: { x: x0, y: y0 }, end: { x: x1, y: y1 } } as unknown as Entity);

const mkBlock = (id: string, members: Entity[]): BlockEntity =>
  ({ id, type: 'block', name: 'B', layerId: 'l', visible: true, position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0, entities: members } as unknown as BlockEntity);

function makeDeps(initial: Entity[]): { deps: DxfCommitDeps; scene: () => SceneModel } {
  let scene: SceneModel = { entities: initial, layersById: {}, bounds: null } as unknown as SceneModel;
  const deps = {
    currentLevelId: 'lvl_1',
    getLevelScene: () => scene,
    setLevelScene: (_id: string, next: SceneModel) => { scene = next; },
    moveEntities: () => {},
    execute: () => {},
    onToolChange: () => {},
  } as unknown as DxfCommitDeps;
  return { deps, scene: () => scene };
}

const members = (s: SceneModel): Entity[] => (s.entities[0] as unknown as BlockEntity).entities;

describe('grip-scene-manager-adapter — block-member-aware (ADR-641)', () => {
  afterEach(() => { exitBlockEdit(); }); // never leak BEDIT state across tests

  it('getEntity resolves a member id INSIDE the active block only while entered', () => {
    const block = mkBlock('blk1', [mkLine('m1'), mkLine('m2')]);
    const { deps } = makeDeps([block as unknown as Entity]);
    const adapter = createSceneManagerAdapter(deps)!;

    // Not entered → the member is not individually addressable.
    expect(adapter.getEntity('m2')).toBeUndefined();

    enterBlockEdit('blk1', 'B');
    expect(adapter.getEntity('m2')?.id).toBe('m2');
    expect(adapter.getEntity('blk1')?.id).toBe('blk1'); // container still resolvable
  });

  it('updateEntity writes a member back into the active block immutably', () => {
    const block = mkBlock('blk1', [mkLine('m1', 0, 0)]);
    const { deps, scene } = makeDeps([block as unknown as Entity]);
    const adapter = createSceneManagerAdapter(deps)!;
    enterBlockEdit('blk1', 'B');

    adapter.updateEntity('m1', { start: { x: 42, y: 7 } } as never);

    expect((members(scene())[0] as unknown as { start: { x: number; y: number } }).start).toEqual({ x: 42, y: 7 });
    expect(scene().entities[0]).not.toBe(block); // new container ref → persist/subscription see it
  });

  it('updateVertex edits a member line endpoint via the block container', () => {
    const block = mkBlock('blk1', [mkLine('m1', 0, 0, 1, 0)]);
    const { deps, scene } = makeDeps([block as unknown as Entity]);
    const adapter = createSceneManagerAdapter(deps)!;
    enterBlockEdit('blk1', 'B');

    adapter.updateVertex('m1', 1, { x: 9, y: 9 }); // gripIndex 1 → line end

    expect((members(scene())[0] as unknown as { end: { x: number; y: number } }).end).toEqual({ x: 9, y: 9 });
  });

  it('getVertices returns a member line endpoints', () => {
    const block = mkBlock('blk1', [mkLine('m1', 0, 0, 3, 4)]);
    const { deps } = makeDeps([block as unknown as Entity]);
    const adapter = createSceneManagerAdapter(deps)!;
    enterBlockEdit('blk1', 'B');
    expect(adapter.getVertices('m1')).toEqual([{ x: 0, y: 0 }, { x: 3, y: 4 }]);
  });

  it('addEntity / removeEntity target the active block members', () => {
    const block = mkBlock('blk1', [mkLine('m1')]);
    const { deps, scene } = makeDeps([block as unknown as Entity]);
    const adapter = createSceneManagerAdapter(deps)!;
    enterBlockEdit('blk1', 'B');

    adapter.addEntity(mkLine('m2') as never);
    expect(members(scene()).map((m) => m.id)).toEqual(['m1', 'm2']);

    adapter.removeEntity('m1');
    expect(members(scene()).map((m) => m.id)).toEqual(['m2']);
  });

  it('still edits a top-level entity directly when NOT entered (no regression)', () => {
    const loose = mkLine('loose', 0, 0);
    const { deps, scene } = makeDeps([loose]);
    const adapter = createSceneManagerAdapter(deps)!;
    adapter.updateEntity('loose', { start: { x: 5, y: 5 } } as never);
    expect((scene().entities[0] as unknown as { start: { x: number } }).start.x).toBe(5);
  });
});
