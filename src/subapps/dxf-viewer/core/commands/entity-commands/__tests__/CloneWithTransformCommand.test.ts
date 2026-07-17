/**
 * ADR-507 §8 — `CloneWithTransformCommand`: the ONE copy path of the transform family.
 *
 * Consolidates the behaviour formerly guarded by `transform-copy-mode.test.ts`
 * (Scale/Mirror copy branches) and `RotateEntityCommand.copy.test.ts` (ADR-561 EXT
 * rotate-copy hinge) — those branches no longer exist per-command, so their
 * behavioural assertions live here against the single command that replaced them.
 *
 * Also locks the two defects the consolidation FIXED, which Rotate/Scale copy had
 * and Mirror copy did not (see the file header of CloneWithTransformCommand):
 *   - redo is id-STABLE (Rotate/Scale used to mint a fresh id on every redo);
 *   - `getAffectedEntityIds()` reports the CLONES (Rotate never overrode it).
 * BIM identity + Firestore broadcasts: see `CloneWithTransformCommand.persistence.test.ts`.
 */
import type { ISceneManager, SceneEntity } from '../../interfaces';
import { CloneWithTransformCommand } from '../CloneWithTransformCommand';
import {
  buildRotatePatch,
  buildScalePatch,
  buildMirrorPatch,
  rotateParamError,
  scaleParamError,
  mirrorParamError,
} from '../transform-patch-builders';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

function makeMockScene(initial: SceneEntity[]): { scene: Map<string, SceneEntity>; sm: ISceneManager } {
  const sm = createMockSceneManager(initial, { getEntityIndex: () => -1 });
  return { scene: sm.store, sm };
}

const line = (id: string, start = { x: 10, y: 10 }, end = { x: 20, y: 20 }): SceneEntity =>
  ({ id, type: 'line', layer: 'L0', visible: true, start, end } as unknown as SceneEntity);

const Y_AXIS = { p1: { x: 0, y: 0 }, p2: { x: 0, y: 100 } };

describe('CloneWithTransformCommand — rotate (ADR-561 EXT endpoint hinge)', () => {
  // A(0,0) → B(100,0); pivot = the B endpoint.
  const hinge = (): SceneEntity => line('line_1', { x: 0, y: 0 }, { x: 100, y: 0 });

  it('rotate-copy a line 90° about its B endpoint → new line, original untouched, hinge shared', () => {
    const { scene, sm } = makeMockScene([hinge()]);
    // pivot = B(100,0); +90° CCW rotates A(0,0) about B to (100,-100), B stays put.
    const cmd = new CloneWithTransformCommand(
      ['line_1'], sm, buildRotatePatch({ x: 100, y: 0 }, 90), 'rotate', rotateParamError(90),
    );
    expect(cmd.validate()).toBeNull();
    cmd.execute();

    // Original is preserved verbatim.
    const original = scene.get('line_1') as unknown as { start: { x: number; y: number }; end: { x: number; y: number } };
    expect(original.start).toEqual({ x: 0, y: 0 });
    expect(original.end).toEqual({ x: 100, y: 0 });

    // Exactly ONE new entity was created (2 total).
    expect(scene.size).toBe(2);
    const clone = [...scene.values()].find((e) => e.id !== 'line_1') as unknown as {
      start: { x: number; y: number }; end: { x: number; y: number };
    };
    expect(clone).toBeDefined();
    // A(0,0) rotated 90° CCW about B → (100,-100); B(100,0) is the pivot → unchanged (hinge).
    expect(clone.start.x).toBeCloseTo(100, 4);
    expect(clone.start.y).toBeCloseTo(-100, 4);
    expect(clone.end.x).toBeCloseTo(100, 4);
    expect(clone.end.y).toBeCloseTo(0, 4);
  });

  it('undo removes the clone and restores a single original', () => {
    const { scene, sm } = makeMockScene([hinge()]);
    const cmd = new CloneWithTransformCommand(
      ['line_1'], sm, buildRotatePatch({ x: 100, y: 0 }, 90), 'rotate', rotateParamError(90),
    );
    cmd.execute();
    expect(scene.size).toBe(2);
    cmd.undo();
    expect(scene.size).toBe(1);
    expect(scene.get('line_1')).toBeDefined();
  });
});

describe('CloneWithTransformCommand — scale', () => {
  it('execute clones (original untouched), undo removes clone, redo re-creates', () => {
    const { scene, sm } = makeMockScene([line('a')]);
    const cmd = new CloneWithTransformCommand(
      ['a'], sm, buildScalePatch({ x: 0, y: 0 }, { mode: 'uniform', factor: 2 }), 'scale', null,
    );

    cmd.execute();
    expect(scene.size).toBe(2);            // original + 1 clone
    expect(scene.get('a')).toBeDefined();  // original kept

    cmd.undo();
    expect(scene.size).toBe(1);            // clone removed
    expect(scene.get('a')).toBeDefined();

    cmd.redo();
    expect(scene.size).toBe(2);
  });

  it('affected ids are the clones, never the sources', () => {
    const { sm } = makeMockScene([line('a')]);
    const cmd = new CloneWithTransformCommand(
      ['a'], sm, buildScalePatch({ x: 0, y: 0 }, { mode: 'uniform', factor: 2 }), 'scale', null,
    );
    cmd.execute();
    const affected = cmd.getAffectedEntityIds();
    expect(affected).toHaveLength(1);
    expect(affected[0]).not.toBe('a');
  });
});

describe('CloneWithTransformCommand — mirror', () => {
  it('execute adds mirrored clone, undo removes it, redo re-adds same id', () => {
    const { scene, sm } = makeMockScene([line('a')]);
    const cmd = new CloneWithTransformCommand(['a'], sm, buildMirrorPatch(Y_AXIS), 'mirror', null);

    cmd.execute();
    expect(scene.size).toBe(2);
    const cloneId = cmd.getAffectedEntityIds()[0];
    expect(cloneId).not.toBe('a');

    cmd.undo();
    expect(scene.size).toBe(1);

    cmd.redo();
    expect(scene.size).toBe(2);
    expect(scene.get(cloneId)).toBeDefined(); // id-stable across undo/redo
  });
});

describe('CloneWithTransformCommand — id stability across undo/redo (regression)', () => {
  // Rotate/Scale copy used to re-mint via generateEntityId() on every redo, orphaning
  // the previous Firestore doc. Only Mirror kept the clone objects. Now all three do.
  it.each([
    ['rotate', () => buildRotatePatch({ x: 0, y: 0 }, 90)],
    ['scale', () => buildScalePatch({ x: 0, y: 0 }, { mode: 'uniform' as const, factor: 2 })],
    ['mirror', () => buildMirrorPatch(Y_AXIS)],
  ])('%s: redo re-adds the SAME clone id, never a fresh one', (kind, patch) => {
    const { scene, sm } = makeMockScene([line('a')]);
    const cmd = new CloneWithTransformCommand(
      ['a'], sm, patch(), kind as 'rotate' | 'scale' | 'mirror', null,
    );

    cmd.execute();
    const idAfterExecute = cmd.getAffectedEntityIds()[0];
    cmd.undo();
    cmd.redo();

    expect(cmd.getAffectedEntityIds()).toEqual([idAfterExecute]);
    expect(scene.has(idAfterExecute)).toBe(true);
    expect(scene.size).toBe(2); // no orphan left behind by a second id
  });
});

describe('CloneWithTransformCommand — validate', () => {
  it('rejects an empty id list', () => {
    const { sm } = makeMockScene([line('a')]);
    const cmd = new CloneWithTransformCommand([], sm, buildMirrorPatch(Y_AXIS), 'mirror', null);
    expect(cmd.validate()).toBe('At least one entity ID is required');
  });

  it('surfaces degenerate params exactly like the in-place command does', () => {
    const { sm } = makeMockScene([line('a')]);

    const zeroAngle = new CloneWithTransformCommand(
      ['a'], sm, buildRotatePatch({ x: 0, y: 0 }, 0), 'rotate', rotateParamError(0),
    );
    expect(zeroAngle.validate()).toBe('Rotation angle must be non-zero');

    const zeroFactor = new CloneWithTransformCommand(
      ['a'], sm, buildScalePatch({ x: 0, y: 0 }, { mode: 'uniform', factor: 0 }), 'scale',
      scaleParamError({ mode: 'uniform', factor: 0 }),
    );
    expect(zeroFactor.validate()).toBe('Scale factor cannot be zero');

    const degenerateAxis = { p1: { x: 5, y: 5 }, p2: { x: 5, y: 5 } };
    const badMirror = new CloneWithTransformCommand(
      ['a'], sm, buildMirrorPatch(degenerateAxis), 'mirror', mirrorParamError(degenerateAxis),
    );
    expect(badMirror.validate()).toBe('Mirror axis points must be distinct');
  });
});

describe('CloneWithTransformCommand — misc contract', () => {
  it('skips ids that are not in the scene without failing', () => {
    const { scene, sm } = makeMockScene([line('a')]);
    const cmd = new CloneWithTransformCommand(
      ['a', 'ghost'], sm, buildMirrorPatch(Y_AXIS), 'mirror', null,
    );
    cmd.execute();
    expect(scene.size).toBe(2); // only 'a' cloned
    expect(cmd.getAffectedEntityIds()).toHaveLength(1);
  });

  it('undo is a no-op when nothing was created', () => {
    const { scene, sm } = makeMockScene([line('a')]);
    const cmd = new CloneWithTransformCommand(
      ['ghost'], sm, buildMirrorPatch(Y_AXIS), 'mirror', null,
    );
    cmd.execute();
    cmd.undo();
    expect(scene.size).toBe(1);
  });

  it('describes itself by kind and clone count', () => {
    const { sm } = makeMockScene([line('a'), line('b')]);
    const cmd = new CloneWithTransformCommand(
      ['a', 'b'], sm, buildRotatePatch({ x: 0, y: 0 }, 45), 'rotate', null,
    );
    cmd.execute();
    expect(cmd.getDescription()).toBe('Copy+rotate 2 entities');
    expect(cmd.type).toBe('clone-rotate-entities');
  });
});
