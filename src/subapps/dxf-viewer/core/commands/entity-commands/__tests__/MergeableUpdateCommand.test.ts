/**
 * ADR-507 §8 — `MergeableUpdateCommand` abstract base tests.
 *
 * Verifies the SHARED skeleton that every `Update*ParamsCommand` inherits:
 *   - execute / undo / redo round-trip via the template `applyPatch`
 *   - undo before execute is a no-op (wasExecuted guard)
 *   - canMergeWith: type-equality + same entity + both dragging + time window
 *   - canMergeWith: FALSE across different `type` even on the same entity
 *     (the reason canMergeWith uses type-equality, not bare `instanceof base`)
 *   - mergeWith keeps the earliest `previousPatch`, adopts the latest `patch`
 *   - getAffectedEntityIds + serialize envelope + serializedData override
 */

import { MergeableUpdateCommand } from '../MergeableUpdateCommand';
import type { ICommand, SceneEntity } from '../../interfaces';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

function makeMockScene(initial: SceneEntity[] = []): {
  scene: Map<string, SceneEntity>;
  sm: ReturnType<typeof createMockSceneManager>;
} {
  const sm = createMockSceneManager(initial, { getEntityIndex: () => -1 });
  return { scene: sm.store, sm };
}

interface NumPatch { value: number }

/** Minimal concrete subclass exercising the base template. */
class TestUpdateCommand extends MergeableUpdateCommand<NumPatch> {
  readonly name = 'TestUpdate';
  readonly type = 'test-update';

  protected applyPatch(patch: NumPatch): void {
    this.sceneManager.updateEntity(this.entityId, { value: patch.value } as unknown as Partial<SceneEntity>);
  }

  protected withMergedPatch(nextPatch: NumPatch): TestUpdateCommand {
    return new TestUpdateCommand(this.entityId, nextPatch, this.previousPatch, this.sceneManager, true);
  }

  getDescription(): string {
    return `Test update (${this.patch.value})`;
  }

  validate(): string | null {
    if (!this.entityId) return 'entity id required';
    return null;
  }

  protected serializedData(): Record<string, unknown> {
    return { entityId: this.entityId, value: this.patch.value, isDragging: this.isDragging };
  }
}

/** A DIFFERENT subclass on the same entity — must NOT merge with TestUpdateCommand. */
class OtherUpdateCommand extends MergeableUpdateCommand<NumPatch> {
  readonly name = 'OtherUpdate';
  readonly type = 'other-update';
  protected applyPatch(): void { /* no-op */ }
  protected withMergedPatch(nextPatch: NumPatch): OtherUpdateCommand {
    return new OtherUpdateCommand(this.entityId, nextPatch, this.previousPatch, this.sceneManager, true);
  }
  getDescription(): string { return 'other'; }
  validate(): string | null { return null; }
}

describe('MergeableUpdateCommand (base)', () => {
  it('1. execute applies the forward patch', () => {
    const { scene, sm } = makeMockScene([{ id: 'e1', type: 't', visible: true, value: 1 }]);
    const cmd = new TestUpdateCommand('e1', { value: 9 }, { value: 1 }, sm);
    cmd.execute();
    expect(scene.get('e1')?.value).toBe(9);
  });

  it('2. undo restores the previous patch', () => {
    const { scene, sm } = makeMockScene([{ id: 'e1', type: 't', visible: true, value: 1 }]);
    const cmd = new TestUpdateCommand('e1', { value: 9 }, { value: 1 }, sm);
    cmd.execute();
    cmd.undo();
    expect(scene.get('e1')?.value).toBe(1);
  });

  it('3. redo re-applies after undo', () => {
    const { scene, sm } = makeMockScene([{ id: 'e1', type: 't', visible: true, value: 1 }]);
    const cmd = new TestUpdateCommand('e1', { value: 9 }, { value: 1 }, sm);
    cmd.execute();
    cmd.undo();
    cmd.redo();
    expect(scene.get('e1')?.value).toBe(9);
  });

  it('4. undo before execute is a no-op', () => {
    const { scene, sm } = makeMockScene([{ id: 'e1', type: 't', visible: true, value: 1 }]);
    const cmd = new TestUpdateCommand('e1', { value: 9 }, { value: 1 }, sm);
    cmd.undo();
    expect(scene.get('e1')?.value).toBe(1);
  });

  it('5. canMergeWith: same type+entity, both dragging, within window', () => {
    const { sm } = makeMockScene();
    const a = new TestUpdateCommand('e1', { value: 2 }, { value: 1 }, sm, true);
    const b = new TestUpdateCommand('e1', { value: 3 }, { value: 2 }, sm, true);
    expect(a.canMergeWith(b)).toBe(true);
  });

  it('6. canMergeWith: false when either side is not dragging', () => {
    const { sm } = makeMockScene();
    const a = new TestUpdateCommand('e1', { value: 2 }, { value: 1 }, sm, false);
    const b = new TestUpdateCommand('e1', { value: 3 }, { value: 2 }, sm, true);
    expect(a.canMergeWith(b)).toBe(false);
    expect(b.canMergeWith(a)).toBe(false);
  });

  it('7. canMergeWith: false across different entity ids', () => {
    const { sm } = makeMockScene();
    const a = new TestUpdateCommand('e1', { value: 2 }, { value: 1 }, sm, true);
    const b = new TestUpdateCommand('e2', { value: 3 }, { value: 2 }, sm, true);
    expect(a.canMergeWith(b)).toBe(false);
  });

  it('8. canMergeWith: false across different command TYPE on same entity', () => {
    const { sm } = makeMockScene();
    const a = new TestUpdateCommand('e1', { value: 2 }, { value: 1 }, sm, true);
    const other = new OtherUpdateCommand('e1', { value: 3 }, { value: 2 }, sm, true);
    expect(a.canMergeWith(other)).toBe(false);
  });

  it('9. mergeWith keeps earliest previousPatch + adopts latest patch', () => {
    const { scene, sm } = makeMockScene([{ id: 'e1', type: 't', visible: true, value: 1 }]);
    const a = new TestUpdateCommand('e1', { value: 2 }, { value: 1 }, sm, true);
    const b = new TestUpdateCommand('e1', { value: 5 }, { value: 2 }, sm, true);
    const merged = a.mergeWith(b) as TestUpdateCommand;
    merged.execute();
    expect(scene.get('e1')?.value).toBe(5); // latest patch
    merged.undo();
    expect(scene.get('e1')?.value).toBe(1); // earliest previousPatch (from `a`)
  });

  it('10. getAffectedEntityIds returns the entity id', () => {
    const { sm } = makeMockScene();
    const cmd = new TestUpdateCommand('e1', { value: 2 }, { value: 1 }, sm);
    expect(cmd.getAffectedEntityIds()).toEqual(['e1']);
  });

  it('11. serialize: canonical envelope + subclass serializedData override', () => {
    const { sm } = makeMockScene();
    const cmd = new TestUpdateCommand('e1', { value: 7 }, { value: 1 }, sm, true);
    const s = cmd.serialize();
    expect(s.type).toBe('test-update');
    expect(s.name).toBe('TestUpdate');
    expect(s.version).toBe(1);
    expect(typeof s.id).toBe('string');
    expect(typeof s.timestamp).toBe('number');
    expect(s.data).toMatchObject({ entityId: 'e1', value: 7, isDragging: true });
  });

  it('12. serialize: default serializedData shape when not overridden', () => {
    const { sm } = makeMockScene();
    const other = new OtherUpdateCommand('e1', { value: 7 }, { value: 1 }, sm, true);
    const s = other.serialize();
    expect(s.data).toMatchObject({
      entityId: 'e1',
      patch: { value: 7 },
      previousPatch: { value: 1 },
      isDragging: true,
    });
  });

  it('13. validate delegates to subclass', () => {
    const { sm } = makeMockScene();
    expect(new TestUpdateCommand('', { value: 1 }, { value: 1 }, sm).validate()).toMatch(/entity id/);
    expect(new TestUpdateCommand('e1', { value: 1 }, { value: 1 }, sm).validate()).toBeNull();
  });

  it('14. base satisfies the ICommand contract', () => {
    const { sm } = makeMockScene();
    const cmd: ICommand = new TestUpdateCommand('e1', { value: 1 }, { value: 1 }, sm);
    expect(typeof cmd.execute).toBe('function');
    expect(typeof cmd.serialize).toBe('function');
  });
});
