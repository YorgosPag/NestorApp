/**
 * ADR-575 §7 — ReplaceEntitiesWithContainerCommand (shared container-command base).
 * Locks the invariant snapshot→remove→add→undo→redo lifecycle that JOIN + GROUP
 * inherit, via a minimal concrete subclass (independent of Join/Group specifics).
 */

import { ReplaceEntitiesWithContainerCommand } from '../ReplaceEntitiesWithContainerCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import type { Entity } from '../../../../types/entities';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

const mkLine = (id: string, x = 0): SceneEntity =>
  ({ id, type: 'line', layerId: 'lyr_test', visible: true, start: { x, y: 0 }, end: { x: x + 1, y: 0 } } as unknown as SceneEntity);

const mkScene = (initial: SceneEntity[]) => {
  const sm = createMockSceneManager(initial, { getEntityIndex: () => -1 });
  return { scene: sm.store, sm };
};

/** Minimal concrete subclass: wraps sources in one fixed-id container. */
class TestContainerCommand extends ReplaceEntitiesWithContainerCommand {
  readonly name = 'TestContainer';
  readonly type = 'test-container';

  constructor(
    sourceIds: string[],
    sm: ISceneManager,
    private readonly opts: { containerId?: string; min?: number; buildNull?: boolean } = {},
  ) {
    super(sourceIds, sm);
  }

  protected get minMembers(): number {
    return this.opts.min ?? 1;
  }

  protected buildContainer(snapshots: Entity[]): SceneEntity | null {
    if (this.opts.buildNull) return null;
    return { id: this.opts.containerId ?? 'c1', type: 'container', visible: true, memberCount: snapshots.length } as unknown as SceneEntity;
  }

  getDescription(): string {
    return `test ${this.snapshots.length}`;
  }
  validate(): string | null {
    return null;
  }
  serialize() {
    return { type: this.type, id: this.id, name: this.name, timestamp: this.timestamp, data: {}, version: 1 };
  }

  // Test-only accessors for protected surface.
  affectedIds(): string[] {
    return this.getAffectedEntityIds();
  }
  createdId(): string | null {
    return this.createdContainerId;
  }
}

describe('ADR-575 §7 — ReplaceEntitiesWithContainerCommand', () => {
  it('execute: sources removed, one container added (stable id)', () => {
    const { scene, sm } = mkScene([mkLine('l1'), mkLine('l2', 5)]);
    const cmd = new TestContainerCommand(['l1', 'l2'], sm, { containerId: 'box1' });
    cmd.execute();

    expect(scene.has('l1')).toBe(false);
    expect(scene.has('l2')).toBe(false);
    expect(scene.has('box1')).toBe(true);
    expect(scene.size).toBe(1);
    expect(cmd.createdId()).toBe('box1');
  });

  it('undo restores sources and removes the container', () => {
    const { scene, sm } = mkScene([mkLine('l1'), mkLine('l2', 5)]);
    const cmd = new TestContainerCommand(['l1', 'l2'], sm, { containerId: 'box1' });
    cmd.execute();
    cmd.undo();

    expect(scene.has('l1')).toBe(true);
    expect(scene.has('l2')).toBe(true);
    expect(scene.has('box1')).toBe(false);
    expect(scene.size).toBe(2);
  });

  it('redo re-adds the SAME container id after undo', () => {
    const { scene, sm } = mkScene([mkLine('l1'), mkLine('l2', 5)]);
    const cmd = new TestContainerCommand(['l1', 'l2'], sm, { containerId: 'box1' });
    cmd.execute();
    cmd.undo();
    cmd.redo();

    expect(scene.size).toBe(1);
    expect(scene.has('box1')).toBe(true);
    expect(cmd.createdId()).toBe('box1');
  });

  it('no-op below minMembers: nothing extracted, nothing added', () => {
    const { scene, sm } = mkScene([mkLine('l1')]);
    const cmd = new TestContainerCommand(['l1'], sm, { min: 2 });
    cmd.execute();

    expect(scene.has('l1')).toBe(true);
    expect(scene.size).toBe(1);
    // undo after a no-op execute must not touch the scene
    cmd.undo();
    expect(scene.size).toBe(1);
  });

  it('null container aborts: sources restored, no container added', () => {
    const { scene, sm } = mkScene([mkLine('l1'), mkLine('l2', 5)]);
    const cmd = new TestContainerCommand(['l1', 'l2'], sm, { buildNull: true });
    cmd.execute();

    expect(scene.has('l1')).toBe(true);
    expect(scene.has('l2')).toBe(true);
    expect(scene.size).toBe(2);
    expect(cmd.createdId()).toBeNull();
  });

  it('getAffectedEntityIds includes sources and the container id after execute', () => {
    const { sm } = mkScene([mkLine('l1'), mkLine('l2', 5)]);
    const cmd = new TestContainerCommand(['l1', 'l2'], sm, { containerId: 'box1' });
    expect(cmd.affectedIds()).toEqual(['l1', 'l2']); // container not built yet
    cmd.execute();
    expect(cmd.affectedIds()).toEqual(['l1', 'l2', 'box1']);
  });
});
