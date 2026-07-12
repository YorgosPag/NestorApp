/**
 * ADR-640 — BLOCK instance transforms (INSERT semantics).
 *
 * A BlockEntity is point-like for transforms: move/rotate/scale/mirror update
 * `position`/`scale`/`rotation` (the block definition / local members are immutable, unlike the
 * identity GROUP container which recurses into members). Verifies each per-entity SSoT handles
 * the `'block'` case consistently.
 */

jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

import { rotateEntity } from '../../../utils/rotation-math';
import { scaleEntity } from '../../scale/scale-entity-transform';
import { mirrorEntity } from '../../../utils/mirror-math';
import { calculateMovedGeometry } from '../../../core/commands/entity-commands/move-entity-geometry';
import type { BlockEntity, Entity } from '../../../types/entities';

function block(overrides: Partial<BlockEntity> = {}): BlockEntity {
  return {
    id: 'BLK1', type: 'block', name: 'B', layerId: 'L',
    position: { x: 100, y: 50 }, scale: { x: 1, y: 1 }, rotation: 0,
    entities: [{ id: 'm', type: 'line', layerId: 'L', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } } as Entity],
    ...overrides,
  } as BlockEntity;
}

describe('ADR-640 block transforms (INSERT semantics)', () => {
  it('MOVE translates the insertion point (members untouched)', () => {
    const r = calculateMovedGeometry(block(), { x: 5, y: -3 }) as { position?: { x: number; y: number } };
    expect(r.position).toEqual({ x: 105, y: 47 });
  });

  it('ROTATE rotates the insertion point about the pivot + accumulates the placement rotation', () => {
    const r = rotateEntity(block({ rotation: 10 }), { x: 0, y: 0 }, 90) as { position: { x: number; y: number }; rotation: number };
    expect(r.position.x).toBeCloseTo(-50);
    expect(r.position.y).toBeCloseTo(100);
    expect(r.rotation).toBeCloseTo(100);
  });

  it('SCALE scales the insertion point about base + multiplies the placement scale', () => {
    const r = scaleEntity(block(), { x: 0, y: 0 }, 2, 2) as unknown as { position: { x: number; y: number }; scale: { x: number; y: number } };
    expect(r.position).toEqual({ x: 200, y: 100 });
    expect(r.scale).toEqual({ x: 2, y: 2 });
  });

  it('MIRROR reflects the insertion point, mirrors the angle (2α−r), and negates one scale axis', () => {
    // Axis = the y-axis (angle 90°): position (100,50)→(-100,50); rotation 0→180; scale.y→−1.
    const r = mirrorEntity(block(), { p1: { x: 0, y: 0 }, p2: { x: 0, y: 1 } }) as unknown as {
      position: { x: number; y: number }; rotation: number; scale: { x: number; y: number };
    };
    expect(r.position.x).toBeCloseTo(-100);
    expect(r.position.y).toBeCloseTo(50);
    expect(r.rotation).toBeCloseTo(180);
    expect(r.scale).toEqual({ x: 1, y: -1 });
  });
});
