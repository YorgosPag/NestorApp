/**
 * ADR-510 Φ5 — ExplodeEntityCommand tests (undoable, multi-select).
 * Mirrors ExplodeArrayCommand.test using the shared mock scene manager.
 */

import { ExplodeEntityCommand } from '../ExplodeEntityCommand';
import type { SceneEntity } from '../../interfaces';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

const mkPoly = (id: string, vertices: { x: number; y: number }[], closed = false): SceneEntity =>
  ({ id, type: 'polyline', layer: '0', layerId: 'lyr_test', visible: true, vertices, closed } as unknown as SceneEntity);

const mkLine = (id: string): SceneEntity =>
  ({ id, type: 'line', layer: '0', layerId: 'lyr_test', visible: true, start: { x: 0, y: 0 }, end: { x: 1, y: 0 } } as unknown as SceneEntity);

const mkScene = (initial: SceneEntity[]) => {
  const sm = createMockSceneManager(initial, { getEntityIndex: () => -1 });
  return { scene: sm.store, sm };
};

describe('ADR-510 Φ5 — ExplodeEntityCommand', () => {
  it('execute: polyline (3 verts) → 2 lines, source removed', () => {
    const { scene, sm } = mkScene([mkPoly('p1', [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }])]);
    const cmd = new ExplodeEntityCommand(['p1'], sm);
    cmd.execute();

    expect(scene.has('p1')).toBe(false);
    expect(scene.size).toBe(2);
    for (const e of scene.values()) expect(e.type).toBe('line');
    expect(cmd.getCreatedEntityIds()).toHaveLength(2);
  });

  it('undo restores the source and removes the created primitives', () => {
    const { scene, sm } = mkScene([mkPoly('p1', [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }])]);
    const cmd = new ExplodeEntityCommand(['p1'], sm);
    cmd.execute();
    cmd.undo();

    expect(scene.has('p1')).toBe(true);
    expect(scene.size).toBe(1);
  });

  it('redo re-explodes after undo', () => {
    const { scene, sm } = mkScene([mkPoly('p1', [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }])]);
    const cmd = new ExplodeEntityCommand(['p1'], sm);
    cmd.execute();
    cmd.undo();
    cmd.redo();

    expect(scene.has('p1')).toBe(false);
    expect(scene.size).toBe(2);
  });

  it('multi-select: 2 polylines → 4 lines, both sources removed', () => {
    const { scene, sm } = mkScene([
      mkPoly('p1', [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }]),
      mkPoly('p2', [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }]),
    ]);
    const cmd = new ExplodeEntityCommand(['p1', 'p2'], sm);
    cmd.execute();

    expect(scene.has('p1')).toBe(false);
    expect(scene.has('p2')).toBe(false);
    expect(scene.size).toBe(4);
  });

  it('skips a primitive in the selection (line stays untouched)', () => {
    const { scene, sm } = mkScene([
      mkPoly('p1', [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }]),
      mkLine('l1'),
    ]);
    const cmd = new ExplodeEntityCommand(['p1', 'l1'], sm);
    cmd.execute();

    expect(scene.has('l1')).toBe(true);   // primitive untouched
    expect(scene.has('p1')).toBe(false);  // polyline exploded
    expect(scene.size).toBe(3);           // l1 + 2 lines
  });

  it('validate rejects an empty selection', () => {
    const { sm } = mkScene([]);
    expect(new ExplodeEntityCommand([], sm).validate()).not.toBeNull();
  });
});
