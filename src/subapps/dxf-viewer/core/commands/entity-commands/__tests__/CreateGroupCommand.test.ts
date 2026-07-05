/**
 * ADR-575 — CreateGroupCommand tests (undoable «Ομαδοποίηση»).
 * Mirrors ExplodeEntityCommand.test using the shared mock scene manager.
 */

import { CreateGroupCommand } from '../CreateGroupCommand';
import type { SceneEntity } from '../../interfaces';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

const mkLine = (id: string, x = 0): SceneEntity =>
  ({ id, type: 'line', layerId: 'lyr_test', visible: true, start: { x, y: 0 }, end: { x: x + 1, y: 0 } } as unknown as SceneEntity);

const mkScene = (initial: SceneEntity[]) => {
  const sm = createMockSceneManager(initial, { getEntityIndex: () => -1 });
  return { scene: sm.store, sm };
};

describe('ADR-575 — CreateGroupCommand', () => {
  it('execute: 2 lines → 1 block container, members removed', () => {
    const { scene, sm } = mkScene([mkLine('l1'), mkLine('l2', 5)]);
    const cmd = new CreateGroupCommand(['l1', 'l2'], sm);
    cmd.execute();

    expect(scene.has('l1')).toBe(false);
    expect(scene.has('l2')).toBe(false);
    expect(scene.size).toBe(1);
    const [group] = [...scene.values()];
    expect(group.type).toBe('group');
    expect(cmd.getCreatedEntityId()).toBe(group.id);
  });

  it('undo restores the members and removes the container', () => {
    const { scene, sm } = mkScene([mkLine('l1'), mkLine('l2', 5)]);
    const cmd = new CreateGroupCommand(['l1', 'l2'], sm);
    cmd.execute();
    cmd.undo();

    expect(scene.has('l1')).toBe(true);
    expect(scene.has('l2')).toBe(true);
    expect(scene.size).toBe(2);
  });

  it('redo re-groups after undo, re-adding the SAME container id (stable)', () => {
    const { scene, sm } = mkScene([mkLine('l1'), mkLine('l2', 5)]);
    const cmd = new CreateGroupCommand(['l1', 'l2'], sm);
    cmd.execute();
    const idAfterExecute = cmd.getCreatedEntityId();
    cmd.undo();
    cmd.redo();

    expect(scene.size).toBe(1);
    expect(cmd.getCreatedEntityId()).toBe(idAfterExecute);
    expect(scene.has(idAfterExecute as string)).toBe(true);
  });

  it('validate rejects a selection with fewer than 2 members', () => {
    const { sm } = mkScene([mkLine('l1')]);
    expect(new CreateGroupCommand(['l1'], sm).validate()).not.toBeNull();
    expect(new CreateGroupCommand([], sm).validate()).not.toBeNull();
  });
});
