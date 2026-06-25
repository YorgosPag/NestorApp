/**
 * ADR-507 §8 — copy-mode paths of the migrated transform commands.
 *
 * The in-place spine is covered by `SnapshotTransformCommand.test.ts`; this
 * guards the per-command copy branches that intentionally stay OUT of the base
 * (Scale id-clones, Mirror whole-entity clones): execute adds clones leaving
 * originals untouched, undo removes them, redo re-creates them.
 */
import type { ISceneManager, SceneEntity } from '../../interfaces';
import { ScaleEntityCommand } from '../ScaleEntityCommand';
import { MirrorEntityCommand } from '../MirrorEntityCommand';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

function makeMockScene(initial: SceneEntity[]): { scene: Map<string, SceneEntity>; sm: ISceneManager } {
  const sm = createMockSceneManager(initial, { getEntityIndex: () => -1 });
  return { scene: sm.store, sm };
}

const line = (id: string): SceneEntity =>
  ({ id, type: 'line', layer: 'L0', visible: true, start: { x: 10, y: 10 }, end: { x: 20, y: 20 } } as unknown as SceneEntity);

describe('ScaleEntityCommand — copy mode', () => {
  it('execute clones (original untouched), undo removes clone, redo re-creates', () => {
    const { scene, sm } = makeMockScene([line('a')]);
    const cmd = new ScaleEntityCommand(['a'], { x: 0, y: 0 }, { mode: 'uniform', factor: 2 }, true, sm);

    cmd.execute();
    expect(scene.size).toBe(2);            // original + 1 clone
    expect(scene.get('a')).toBeDefined();  // original kept

    cmd.undo();
    expect(scene.size).toBe(1);            // clone removed
    expect(scene.get('a')).toBeDefined();

    cmd.redo();
    expect(scene.size).toBe(2);
  });

  it('affected ids are the clones in copy mode', () => {
    const { sm } = makeMockScene([line('a')]);
    const cmd = new ScaleEntityCommand(['a'], { x: 0, y: 0 }, { mode: 'uniform', factor: 2 }, true, sm);
    cmd.execute();
    const affected = cmd.getAffectedEntityIds();
    expect(affected).toHaveLength(1);
    expect(affected[0]).not.toBe('a');
  });
});

describe('MirrorEntityCommand — keepOriginals (copy) mode', () => {
  it('execute adds mirrored clone, undo removes it, redo re-adds same id', () => {
    const { scene, sm } = makeMockScene([line('a')]);
    const cmd = new MirrorEntityCommand(['a'], { p1: { x: 0, y: 0 }, p2: { x: 0, y: 100 } }, true, sm);

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
