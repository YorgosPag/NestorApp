/**
 * ADR-049 Phase 2 — 3D move delta (`MoveElement(dx,dy,dz)`) unit tests.
 *
 * Covers the command-layer contract of the unified vertical move:
 *  - a PURE vertical delta (x=y=0, z≠0) is VALID (the axis-Y gizmo)
 *  - merge sums z; a pure-plan merge stays 2D (no spurious `z: 0`)
 *  - `getDelta` round-trips z
 *
 * (Undo no longer uses `reverseDelta` — `MoveEntityCommand` now restores from the
 * pre-move snapshot via the `SnapshotTransformCommand` base, ADR-507 §8 item α.)
 */

import { MoveEntityCommand, MoveMultipleEntitiesCommand } from '../MoveEntityCommand';
import type { ISceneManager, SceneEntity } from '../interfaces';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

// validate / mergeWith / getDelta never touch the scene manager.
const sm = {} as unknown as ISceneManager;

// Minimal in-memory scene for the execute/undo/redo spine (no MEP/slab → follower
// cascades no-op, so a plain DXF circle exercises the move geometry + snapshot restore).
function makeMockScene(initial: SceneEntity[] = []): { scene: Map<string, SceneEntity>; sm: ReturnType<typeof createMockSceneManager> } {
  const localSm = createMockSceneManager(initial, { getEntityIndex: () => -1 });
  return { scene: localSm.store, sm: localSm };
}

const circleAt = (id: string, x: number, y: number): SceneEntity =>
  ({ id, type: 'circle', layer: 'L0', visible: true, center: { x, y }, radius: 5 } as unknown as SceneEntity);
const center = (e: SceneEntity | undefined) => (e as unknown as { center: { x: number; y: number } }).center;

describe('MoveEntityCommand — spine (extends SnapshotTransformCommand, ADR-507 §8 item α)', () => {
  it('execute moves the entity by delta', () => {
    const { scene, sm: s } = makeMockScene([circleAt('c1', 0, 0)]);
    new MoveEntityCommand('c1', { x: 10, y: 20 }, s).execute();
    expect(center(scene.get('c1'))).toEqual({ x: 10, y: 20 });
  });

  it('undo restores from the pre-move SNAPSHOT (not reverseDelta recompute)', () => {
    const { scene, sm: s } = makeMockScene([circleAt('c1', 3, 7)]);
    const cmd = new MoveEntityCommand('c1', { x: 100, y: -50 }, s);
    cmd.execute();
    expect(center(scene.get('c1'))).toEqual({ x: 103, y: -43 });
    cmd.undo();
    expect(center(scene.get('c1'))).toEqual({ x: 3, y: 7 }); // exact original
  });

  it('undo preserves identity fields (id/layer/visible)', () => {
    const { scene, sm: s } = makeMockScene([circleAt('c1', 0, 0)]);
    const cmd = new MoveEntityCommand('c1', { x: 5, y: 5 }, s);
    cmd.execute();
    cmd.undo();
    const e = scene.get('c1') as unknown as { id: string; layer: string; visible: boolean };
    expect([e.id, e.layer, e.visible]).toEqual(['c1', 'L0', true]);
  });

  it('redo re-applies the move', () => {
    const { scene, sm: s } = makeMockScene([circleAt('c1', 0, 0)]);
    const cmd = new MoveEntityCommand('c1', { x: 8, y: 0 }, s);
    cmd.execute();
    cmd.undo();
    cmd.redo();
    expect(center(scene.get('c1'))).toEqual({ x: 8, y: 0 });
  });

  it('multi-entity move + undo restores all from snapshot', () => {
    const { scene, sm: s } = makeMockScene([circleAt('a', 0, 0), circleAt('b', 100, 0)]);
    const cmd = new MoveMultipleEntitiesCommand(['a', 'b'], { x: 10, y: 10 }, s);
    cmd.execute();
    expect(center(scene.get('a'))).toEqual({ x: 10, y: 10 });
    expect(center(scene.get('b'))).toEqual({ x: 110, y: 10 });
    cmd.undo();
    expect(center(scene.get('a'))).toEqual({ x: 0, y: 0 });
    expect(center(scene.get('b'))).toEqual({ x: 100, y: 0 });
  });
});

describe('ADR-049 Phase 2 — MoveEntityCommand 3D delta', () => {
  it('validate allows a PURE vertical delta (x=y=0, z≠0)', () => {
    expect(new MoveEntityCommand('e1', { x: 0, y: 0, z: 500 }, sm, false).validate()).toBeNull();
  });

  it('validate rejects an all-zero delta (including z=0)', () => {
    expect(new MoveEntityCommand('e1', { x: 0, y: 0, z: 0 }, sm, false).validate()).not.toBeNull();
    expect(new MoveEntityCommand('e1', { x: 0, y: 0 }, sm, false).validate()).not.toBeNull();
  });

  it('getDelta round-trips the z component', () => {
    expect(new MoveEntityCommand('e1', { x: 1, y: 2, z: 3 }, sm, false).getDelta()).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('mergeWith sums the z of two consecutive drag samples', () => {
    const a = new MoveEntityCommand('e1', { x: 1, y: 2, z: 3 }, sm, true);
    const b = new MoveEntityCommand('e1', { x: 4, y: 5, z: 6 }, sm, true);
    expect((a.mergeWith(b) as MoveEntityCommand).getDelta()).toEqual({ x: 5, y: 7, z: 9 });
  });

  it('mergeWith of two plan-only deltas stays 2D (no spurious z key)', () => {
    const a = new MoveEntityCommand('e1', { x: 1, y: 0 }, sm, true);
    const b = new MoveEntityCommand('e1', { x: 2, y: 0 }, sm, true);
    const merged = (a.mergeWith(b) as MoveEntityCommand).getDelta();
    expect(merged).toEqual({ x: 3, y: 0 });
    expect('z' in merged).toBe(false);
  });

  it('mergeWith drops z when the combined elevation nets to zero', () => {
    const a = new MoveEntityCommand('e1', { x: 1, y: 0, z: 5 }, sm, true);
    const b = new MoveEntityCommand('e1', { x: 1, y: 0, z: -5 }, sm, true);
    const merged = (a.mergeWith(b) as MoveEntityCommand).getDelta();
    expect(merged).toEqual({ x: 2, y: 0 });
    expect('z' in merged).toBe(false);
  });
});

describe('ADR-049 Phase 2 — MoveMultipleEntitiesCommand 3D delta', () => {
  it('validate allows a pure vertical delta', () => {
    expect(new MoveMultipleEntitiesCommand(['a', 'b'], { x: 0, y: 0, z: 300 }, sm, false).validate()).toBeNull();
  });

  it('mergeWith sums z across the batch', () => {
    const a = new MoveMultipleEntitiesCommand(['a', 'b'], { x: 0, y: 0, z: 100 }, sm, true);
    const b = new MoveMultipleEntitiesCommand(['a', 'b'], { x: 0, y: 0, z: 50 }, sm, true);
    expect((a.mergeWith(b) as MoveMultipleEntitiesCommand).getDelta()).toEqual({ x: 0, y: 0, z: 150 });
  });
});
