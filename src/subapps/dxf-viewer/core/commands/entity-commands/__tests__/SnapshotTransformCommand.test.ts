/**
 * ADR-507 §8 — `SnapshotTransformCommand` base tests.
 *
 * Exercises the shared in-place spine (execute/undo/redo), the snapshot restore
 * (geometry restored except id/layer/visible), the delta-style `undoInPlaceWith`
 * variant, the merge gate, and the canonical serialize payload — via a tiny
 * concrete subclass (mirrors `MergeableUpdateCommand.test.ts`).
 */
import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../../interfaces';
import { SnapshotTransformCommand } from '../SnapshotTransformCommand';

function makeMockScene(initial: SceneEntity[] = []): {
  scene: Map<string, SceneEntity>;
  sm: ISceneManager;
} {
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

type Pt = { x: number; y: number };
const lineAt = (id: string, x: number): SceneEntity =>
  ({ id, type: 'line', layer: 'L0', visible: true, p: { x, y: 0 } } as unknown as SceneEntity);
const px = (e: SceneEntity | undefined): number => (e as unknown as { p: Pt }).p.x;

/** Shifts the entity's `p.x` by a fixed delta — snapshot-restore undo (Rotate/Scale style). */
class ShiftCommand extends SnapshotTransformCommand {
  readonly name = 'Shift';
  readonly type = 'test-shift';
  constructor(entityIds: string[], protected readonly dx: number, sm: ISceneManager, isDragging = false) {
    super(entityIds, sm, isDragging);
  }
  protected computeUpdates(entity: SceneEntity): Partial<SceneEntity> {
    return { p: { x: (entity as unknown as { p: Pt }).p.x + this.dx, y: 0 } } as unknown as Partial<SceneEntity>;
  }
  getDescription(): string { return `Shift by ${this.dx}`; }
  canMergeWith(other: ICommand): boolean { return this.canMergeTransform(other); }
  mergeWith(other: ICommand): ICommand {
    return new ShiftCommand(this.entityIds, this.dx + (other as ShiftCommand).dx, this.sceneManager, true);
  }
  serialize(): SerializedCommand {
    return { type: this.type, id: this.id, name: this.name, timestamp: this.timestamp, data: { ...this.baseTransformData(), dx: this.dx }, version: 1 };
  }
}

/** Same shift, but undo recomputes the inverse from the live entity (Move style). */
class DeltaShiftCommand extends ShiftCommand {
  override readonly type = 'test-delta-shift';
  override undo(): void {
    this.undoInPlaceWith((entity) => ({ p: { x: (entity as unknown as { p: Pt }).p.x - this.dx, y: 0 } } as unknown as Partial<SceneEntity>));
  }
}

describe('SnapshotTransformCommand — shared in-place spine', () => {
  it('execute applies computeUpdates to every entity', () => {
    const { scene, sm } = makeMockScene([lineAt('a', 0), lineAt('b', 100)]);
    new ShiftCommand(['a', 'b'], 10, sm).execute();
    expect(px(scene.get('a'))).toBe(10);
    expect(px(scene.get('b'))).toBe(110);
  });

  it('undo restores geometry from snapshot (Rotate/Scale style)', () => {
    const { scene, sm } = makeMockScene([lineAt('a', 0)]);
    const cmd = new ShiftCommand(['a'], 25, sm);
    cmd.execute();
    expect(px(scene.get('a'))).toBe(25);
    cmd.undo();
    expect(px(scene.get('a'))).toBe(0);
  });

  it('undo preserves identity fields (id/layer/visible not clobbered)', () => {
    const { scene, sm } = makeMockScene([lineAt('a', 0)]);
    const cmd = new ShiftCommand(['a'], 5, sm);
    cmd.execute();
    cmd.undo();
    const e = scene.get('a') as unknown as { id: string; layer: string; visible: boolean };
    expect(e.id).toBe('a');
    expect(e.layer).toBe('L0');
    expect(e.visible).toBe(true);
  });

  it('redo re-applies the transform from the snapshot', () => {
    const { scene, sm } = makeMockScene([lineAt('a', 0)]);
    const cmd = new ShiftCommand(['a'], 7, sm);
    cmd.execute();
    cmd.undo();
    cmd.redo();
    expect(px(scene.get('a'))).toBe(7);
  });

  it('undoInPlaceWith recomputes the inverse from the live entity (Move style)', () => {
    const { scene, sm } = makeMockScene([lineAt('a', 50)]);
    const cmd = new DeltaShiftCommand(['a'], 30, sm);
    cmd.execute();
    expect(px(scene.get('a'))).toBe(80);
    cmd.undo();
    expect(px(scene.get('a'))).toBe(50);
  });

  it('execute is a no-op flag-wise when no entity exists (undo guarded)', () => {
    const { scene, sm } = makeMockScene([]);
    const cmd = new ShiftCommand(['missing'], 10, sm);
    cmd.execute();
    expect(() => cmd.undo()).not.toThrow();
    expect(scene.size).toBe(0);
  });

  it('getAffectedEntityIds returns the target ids', () => {
    const { sm } = makeMockScene([lineAt('a', 0), lineAt('b', 0)]);
    expect(new ShiftCommand(['a', 'b'], 1, sm).getAffectedEntityIds()).toEqual(['a', 'b']);
  });
});

describe('SnapshotTransformCommand — merge gate', () => {
  it('merges same target while both dragging (combined delta)', () => {
    const { scene, sm } = makeMockScene([lineAt('a', 0)]);
    const a = new ShiftCommand(['a'], 3, sm, true);
    const b = new ShiftCommand(['a'], 4, sm, true);
    expect(a.canMergeWith(b)).toBe(true);
    a.mergeWith(b).execute(); // combined dx = 3 + 4 = 7
    expect(px(scene.get('a'))).toBe(7);
  });

  it('does NOT merge when not dragging', () => {
    const { sm } = makeMockScene([lineAt('a', 0)]);
    expect(new ShiftCommand(['a'], 1, sm, false).canMergeWith(new ShiftCommand(['a'], 1, sm, true))).toBe(false);
  });

  it('does NOT merge a different entity set', () => {
    const { sm } = makeMockScene([lineAt('a', 0), lineAt('b', 0)]);
    expect(new ShiftCommand(['a'], 1, sm, true).canMergeWith(new ShiftCommand(['b'], 1, sm, true))).toBe(false);
  });

  it('does NOT merge across different command types', () => {
    const { sm } = makeMockScene([lineAt('a', 0)]);
    expect(new ShiftCommand(['a'], 1, sm, true).canMergeWith(new DeltaShiftCommand(['a'], 1, sm, true))).toBe(false);
  });
});

describe('SnapshotTransformCommand — serialize', () => {
  it('baseTransformData carries entityIds + per-entity snapshots after execute', () => {
    const { sm } = makeMockScene([lineAt('a', 0)]);
    const cmd = new ShiftCommand(['a'], 9, sm);
    cmd.execute();
    const data = cmd.serialize().data as { entityIds: string[]; entitySnapshots: Array<{ id: string }>; dx: number };
    expect(data.entityIds).toEqual(['a']);
    expect(data.entitySnapshots.map((s) => s.id)).toEqual(['a']);
    expect(data.dx).toBe(9);
  });
});
