/**
 * ADR-561 EXT — `RotateEntityCommand.copyMode` tests for the Ctrl-endpoint rotate-COPY
 * hinge. When `copyMode === true` the command rotates a CLONE about the pivot and leaves
 * the source untouched — the new primitive shares the pivot with the original (hinge).
 */
import { RotateEntityCommand } from '../RotateEntityCommand';
import type { SceneEntity } from '../../interfaces';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

function makeLine(): SceneEntity {
  // A(0,0) → B(100,0); pivot = the B endpoint.
  return { id: 'line_1', type: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } } as unknown as SceneEntity;
}

describe('RotateEntityCommand.copyMode (ADR-561 EXT — endpoint hinge)', () => {
  it('rotate-copy a line 90° about its B endpoint → new line, original untouched, hinge shared', () => {
    const line = makeLine();
    const sm = createMockSceneManager([line]);
    // pivot = B(100,0); +90° CCW rotates A(0,0) about B to (100,-100), B stays put.
    const cmd = new RotateEntityCommand([line.id], { x: 100, y: 0 }, 90, sm, false, /*copyMode*/ true);
    expect(cmd.validate()).toBeNull();
    cmd.execute();

    // Original is preserved verbatim.
    const original = sm.store.get('line_1') as unknown as { start: { x: number; y: number }; end: { x: number; y: number } };
    expect(original.start).toEqual({ x: 0, y: 0 });
    expect(original.end).toEqual({ x: 100, y: 0 });

    // Exactly ONE new entity was created (2 total).
    expect(sm.store.size).toBe(2);
    const clone = [...sm.store.values()].find((e) => e.id !== 'line_1') as unknown as {
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
    const line = makeLine();
    const sm = createMockSceneManager([line]);
    const cmd = new RotateEntityCommand([line.id], { x: 100, y: 0 }, 90, sm, false, true);
    cmd.execute();
    expect(sm.store.size).toBe(2);
    cmd.undo();
    expect(sm.store.size).toBe(1);
    expect(sm.store.get('line_1')).toBeDefined();
  });
});
