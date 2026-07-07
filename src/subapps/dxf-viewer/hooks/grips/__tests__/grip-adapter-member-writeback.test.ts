/**
 * ADR-575 §enter-group — the grip scene-manager adapter is MEMBER-AWARE: while inside a
 * group (in-place edit), a member's own id resolves + writes back INTO the container.
 */

import { createSceneManagerAdapter } from '../grip-scene-manager-adapter';
import type { DxfCommitDeps } from '../unified-grip-types';
import type { SceneModel } from '../../../types/scene';
import type { Entity, GroupEntity } from '../../../types/entities';

const mkLine = (id: string, x0 = 0, y0 = 0, x1 = 1, y1 = 1): Entity =>
  ({ id, type: 'line', layerId: 'l', visible: true, start: { x: x0, y: y0 }, end: { x: x1, y: y1 } } as unknown as Entity);

const mkGroup = (id: string, members: Entity[]): GroupEntity =>
  ({ id, type: 'group', layerId: 'l', visible: true, members } as unknown as GroupEntity);

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

describe('grip-scene-manager-adapter — member-aware (ADR-575)', () => {
  it('getEntity resolves a member id INSIDE a group container', () => {
    const group = mkGroup('g1', [mkLine('m1'), mkLine('m2')]);
    const { deps } = makeDeps([group as unknown as Entity]);
    const adapter = createSceneManagerAdapter(deps)!;
    expect(adapter.getEntity('m2')?.id).toBe('m2');
    expect(adapter.getEntity('g1')?.id).toBe('g1');   // container still resolvable
  });

  it('updateEntity writes a member back into its container immutably', () => {
    const group = mkGroup('g1', [mkLine('m1', 0, 0)]);
    const { deps, scene } = makeDeps([group as unknown as Entity]);
    const adapter = createSceneManagerAdapter(deps)!;

    adapter.updateEntity('m1', { start: { x: 42, y: 7 } } as never);

    const nextGroup = scene().entities[0] as unknown as GroupEntity;
    expect((nextGroup.members[0] as unknown as { start: { x: number; y: number } }).start).toEqual({ x: 42, y: 7 });
    expect(nextGroup).not.toBe(group);                 // new container ref → persist/subscription see it
  });

  it('updateVertex edits a member line endpoint via the group container', () => {
    const group = mkGroup('g1', [mkLine('m1', 0, 0, 1, 0)]);
    const { deps, scene } = makeDeps([group as unknown as Entity]);
    const adapter = createSceneManagerAdapter(deps)!;

    adapter.updateVertex('m1', 1, { x: 9, y: 9 });     // gripIndex 1 → line end

    const member = (scene().entities[0] as unknown as GroupEntity).members[0] as unknown as { end: { x: number; y: number } };
    expect(member.end).toEqual({ x: 9, y: 9 });
  });

  it('getVertices returns a member line endpoints', () => {
    const group = mkGroup('g1', [mkLine('m1', 0, 0, 3, 4)]);
    const { deps } = makeDeps([group as unknown as Entity]);
    const adapter = createSceneManagerAdapter(deps)!;
    expect(adapter.getVertices('m1')).toEqual([{ x: 0, y: 0 }, { x: 3, y: 4 }]);
  });

  it('still edits a top-level entity directly (no regression)', () => {
    const loose = mkLine('loose', 0, 0);
    const { deps, scene } = makeDeps([loose]);
    const adapter = createSceneManagerAdapter(deps)!;
    adapter.updateEntity('loose', { start: { x: 5, y: 5 } } as never);
    expect((scene().entities[0] as unknown as { start: { x: number } }).start.x).toBe(5);
  });
});
