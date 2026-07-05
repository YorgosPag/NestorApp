/**
 * ADR-186 — JoinEntityCommand tests (undoable). Added alongside the ADR-575 SSoT
 * refactor (shared `entity-source-extraction` extract/restore) to lock behaviour.
 */

import { JoinEntityCommand } from '../JoinEntityCommand';
import type { SceneEntity } from '../interfaces';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

const mkLine = (id: string, x = 0): SceneEntity =>
  ({ id, type: 'line', layerId: 'lyr_test', visible: true, start: { x, y: 0 }, end: { x: x + 1, y: 0 } } as unknown as SceneEntity);

const mkMerged = (id: string): SceneEntity =>
  ({ id, type: 'lwpolyline', layerId: 'lyr_test', visible: true, vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], closed: false } as unknown as SceneEntity);

const mkScene = (initial: SceneEntity[]) => {
  const sm = createMockSceneManager(initial, { getEntityIndex: () => -1 });
  return { scene: sm.store, sm };
};

describe('ADR-186 — JoinEntityCommand (SSoT extract/restore)', () => {
  it('execute: sources removed, merged added', () => {
    const { scene, sm } = mkScene([mkLine('l1'), mkLine('l2', 5)]);
    const cmd = new JoinEntityCommand(['l1', 'l2'], mkMerged('m1'), sm);
    cmd.execute();

    expect(scene.has('l1')).toBe(false);
    expect(scene.has('l2')).toBe(false);
    expect(scene.has('m1')).toBe(true);
    expect(scene.size).toBe(1);
  });

  it('undo restores the sources and removes the merged entity', () => {
    const { scene, sm } = mkScene([mkLine('l1'), mkLine('l2', 5)]);
    const cmd = new JoinEntityCommand(['l1', 'l2'], mkMerged('m1'), sm);
    cmd.execute();
    cmd.undo();

    expect(scene.has('l1')).toBe(true);
    expect(scene.has('l2')).toBe(true);
    expect(scene.has('m1')).toBe(false);
    expect(scene.size).toBe(2);
  });

  it('redo re-joins after undo', () => {
    const { scene, sm } = mkScene([mkLine('l1'), mkLine('l2', 5)]);
    const cmd = new JoinEntityCommand(['l1', 'l2'], mkMerged('m1'), sm);
    cmd.execute();
    cmd.undo();
    cmd.redo();

    expect(scene.has('m1')).toBe(true);
    expect(scene.size).toBe(1);
  });
});
