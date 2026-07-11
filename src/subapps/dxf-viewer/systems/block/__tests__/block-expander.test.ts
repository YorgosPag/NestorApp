/**
 * ADR-640 — BLOCK instance expansion (render/snap/bounds SSoT).
 *
 * Verifies that a preserved DXF INSERT (`type:'block'`) places its BLOCK-LOCAL members into world
 * space via the shared placement transform, and that `expandBlockInstance` re-tags every placed
 * member with the block id (so click/hit-test resolve to the whole block — GROUP/ARRAY mechanism).
 */

// Firebase auth mock — the type barrels touch auth on the import path (handoff trap, mirror of
// rotate-entity-coverage.test.ts).
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

import { expandBlockInstance, placeBlockMembersWorld } from '../block-expander';
import type { BlockEntity, Entity, LineEntity } from '../../../types/entities';

function lineMember(id: string, start: { x: number; y: number }, end: { x: number; y: number }): LineEntity {
  return { id, type: 'line', layerId: 'L', start, end } as LineEntity;
}

function block(overrides: Partial<BlockEntity> = {}): BlockEntity {
  return {
    id: 'BLK1',
    type: 'block',
    name: 'NEC32_BLOCK',
    layerId: 'L',
    position: { x: 100, y: 50 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    entities: [lineMember('m1', { x: 0, y: 0 }, { x: 10, y: 0 })],
    ...overrides,
  } as BlockEntity;
}

describe('ADR-640 expandBlockInstance / placeBlockMembersWorld', () => {
  it('places a local member into world space by the insertion point (identity scale/rotation)', () => {
    const placed = placeBlockMembersWorld(block()) as LineEntity[];
    expect(placed).toHaveLength(1);
    expect(placed[0].start).toEqual({ x: 100, y: 50 });
    expect(placed[0].end).toEqual({ x: 110, y: 50 });
  });

  it('applies rotation about the insertion point (90° CCW)', () => {
    const placed = placeBlockMembersWorld(block({ rotation: 90 })) as LineEntity[];
    // (0,0)→(100,50); (10,0) rotated 90° about origin →(0,10), +pos →(100,60)
    expect(placed[0].start.x).toBeCloseTo(100);
    expect(placed[0].start.y).toBeCloseTo(50);
    expect(placed[0].end.x).toBeCloseTo(100);
    expect(placed[0].end.y).toBeCloseTo(60);
  });

  it('applies scale about the origin then translates by the insertion point', () => {
    const placed = placeBlockMembersWorld(block({ scale: { x: 2, y: 2 } })) as LineEntity[];
    // (10,0)*2 =(20,0), +pos(100,50) →(120,50)
    expect(placed[0].end).toEqual({ x: 120, y: 50 });
  });

  it('expandBlockInstance re-tags every placed member with the block id (click → whole block)', () => {
    const expanded = expandBlockInstance(block({ id: 'BLK-XYZ' }));
    expect(expanded.every((e: Entity) => e.id === 'BLK-XYZ')).toBe(true);
  });

  it('returns [] for an empty block', () => {
    expect(expandBlockInstance(block({ entities: [] }))).toEqual([]);
  });
});
