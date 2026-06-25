/**
 * ADR-426 Slice 2 — CreateMepSegmentsCommand tests.
 *
 * Verifies the batch segment-create command: symmetric scene add/remove across
 * execute / undo / redo, validation, and affected-id reporting. The deferred
 * EventBus side-effects run in a microtask and are harmless without listeners.
 */

import { CreateMepSegmentsCommand } from '../CreateMepSegmentsCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import type { MepSegmentEntity } from '../../../../bim/types/mep-segment-types';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

function makeMockScene(): { scene: Map<string, SceneEntity>; sm: ISceneManager } {
  const sm = createMockSceneManager([], { getEntityIndex: () => -1 });
  return { scene: sm.store, sm };
}

/** Minimal MepSegmentEntity stub — the command only touches `id`. */
function makeSeg(id: string): MepSegmentEntity {
  return {
    id,
    type: 'mep-segment',
    layerId: 'lyr_test',
    visible: true,
    params: { domain: 'pipe' },
  } as unknown as MepSegmentEntity;
}

describe('CreateMepSegmentsCommand', () => {
  it('execute adds every segment to the scene', () => {
    const { scene, sm } = makeMockScene();
    const cmd = new CreateMepSegmentsCommand([makeSeg('s1'), makeSeg('s2')], sm);
    cmd.execute();
    expect(scene.has('s1')).toBe(true);
    expect(scene.has('s2')).toBe(true);
    expect(scene.size).toBe(2);
  });

  it('undo removes every segment; redo re-adds them', () => {
    const { scene, sm } = makeMockScene();
    const cmd = new CreateMepSegmentsCommand([makeSeg('s1'), makeSeg('s2')], sm);
    cmd.execute();
    cmd.undo();
    expect(scene.size).toBe(0);
    cmd.redo();
    expect(scene.size).toBe(2);
  });

  it('undo before execute is a no-op', () => {
    const { scene, sm } = makeMockScene();
    const cmd = new CreateMepSegmentsCommand([makeSeg('s1')], sm);
    cmd.undo();
    expect(scene.size).toBe(0);
  });

  it('validate rejects an empty batch', () => {
    const { sm } = makeMockScene();
    expect(new CreateMepSegmentsCommand([], sm).validate()).not.toBeNull();
    expect(new CreateMepSegmentsCommand([makeSeg('s1')], sm).validate()).toBeNull();
  });

  it('getAffectedEntityIds lists every segment id', () => {
    const { sm } = makeMockScene();
    const cmd = new CreateMepSegmentsCommand([makeSeg('s1'), makeSeg('s2')], sm);
    expect(cmd.getAffectedEntityIds().sort()).toEqual(['s1', 's2']);
  });

  it('snapshots are independent of later mutation of the input array', () => {
    const { scene, sm } = makeMockScene();
    const input = [makeSeg('s1')];
    const cmd = new CreateMepSegmentsCommand(input, sm);
    input.length = 0; // mutate caller's array after construction
    cmd.execute();
    expect(scene.has('s1')).toBe(true);
  });
});
