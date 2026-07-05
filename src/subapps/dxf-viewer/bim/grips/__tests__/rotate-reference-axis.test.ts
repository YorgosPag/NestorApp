/**
 * ADR-363 Slice G.6 — free-rotate reference baseline along the entity's MAJOR axis.
 *
 * `resolveRotateReferenceAnchor(entity, pivot)` returns `pivot + majorAxisUnit`
 * oriented toward the entity body, so the imaginary reference line starts parallel to
 * the longest side and its far end tracks the cursor. Null when the entity has no
 * orientation (caller falls back to the legacy first-move baseline).
 */

import { resolveRotateReferenceAnchor } from '../rotate-reference-axis';
import type { Entity } from '../../../types/entities';

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('resolveRotateReferenceAnchor — linear entities (axis = major)', () => {
  // Horizontal wall (0,0)→(1000,0), thickness 200 → bbox y ∈ [-100,100].
  const wall = {
    id: 'W1', type: 'wall',
    params: { start: { x: 0, y: 0 }, end: { x: 1000, y: 0 }, thickness: 200 },
    geometry: { bbox: { min: { x: 0, y: -100 }, max: { x: 1000, y: 100 } } },
  } as unknown as Entity;

  it("Giorgio's example: pivot at the NE corner → reference points WEST (toward NW / the body)", () => {
    const anchor = resolveRotateReferenceAnchor(wall, { x: 1000, y: 100 })!;
    expect(anchor).not.toBeNull();
    // Direction = anchor − pivot must be −X (toward NW), i.e. parallel to the long axis.
    near(anchor.x - 1000, -1); // −X unit
    near(anchor.y - 100, 0);
  });

  it('pivot at the WEST end → reference points EAST (toward the body), still along the axis', () => {
    const anchor = resolveRotateReferenceAnchor(wall, { x: 0, y: 0 })!;
    near(anchor.x - 0, 1); // +X unit
    near(anchor.y - 0, 0);
  });

  it('vertical wall → reference runs along the vertical axis (major = length)', () => {
    const vWall = {
      id: 'W2', type: 'wall',
      params: { start: { x: 0, y: 0 }, end: { x: 0, y: 1000 }, thickness: 200 },
      geometry: { bbox: { min: { x: -100, y: 0 }, max: { x: 100, y: 1000 } } },
    } as unknown as Entity;
    const anchor = resolveRotateReferenceAnchor(vWall, { x: 0, y: 1000 })!; // north end
    near(anchor.x, 0);
    near(anchor.y - 1000, -1); // −Y, toward the body (south)
  });
});

describe('resolveRotateReferenceAnchor — box entities (larger side = major)', () => {
  it('width < depth → reference uses the local +Y (depth) axis', () => {
    // Rectangular column, no rotation, width 300 (X) × depth 600 (Y), centred at origin.
    const column = {
      id: 'C1', type: 'column',
      params: { rotation: 0, width: 300, depth: 600, position: { x: 0, y: 0 } },
      geometry: { bbox: { min: { x: -150, y: -300 }, max: { x: 150, y: 300 } } },
    } as unknown as Entity;
    const anchor = resolveRotateReferenceAnchor(column, { x: 150, y: 300 })!; // a corner
    near(anchor.x - 150, 0);    // no X component → major axis is +Y
    near(anchor.y - 300, -1);   // toward the centre (−Y)
  });

  it('width > depth → reference uses the local +X (width) axis', () => {
    const column = {
      id: 'C2', type: 'column',
      params: { rotation: 0, width: 600, depth: 300, position: { x: 0, y: 0 } },
      geometry: { bbox: { min: { x: -300, y: -150 }, max: { x: 300, y: 150 } } },
    } as unknown as Entity;
    const anchor = resolveRotateReferenceAnchor(column, { x: 300, y: 150 })!;
    near(anchor.x - 300, -1);   // toward the centre (−X), major axis is +X
    near(anchor.y - 150, 0);
  });
});

describe('resolveRotateReferenceAnchor — wall 9-grip truth-table (Giorgio spec)', () => {
  // Horizontal wall start(0,0)→end(1000,0), thickness 200 → bbox x∈[0,1000] y∈[-100,100],
  // centre (500,0), major axis = +X. The reference must run along the major axis toward
  // the body: east-side grips → west (−X), west-side grips → east (+X), central-X grips
  // (mid-N / centre / mid-S) → west (−X). We assert the sign of `dir.x = anchor.x − pivot.x`.
  const wall = {
    id: 'W', type: 'wall',
    params: { start: { x: 0, y: 0 }, end: { x: 1000, y: 0 }, thickness: 200 },
    geometry: { bbox: { min: { x: 0, y: -100 }, max: { x: 1000, y: 100 } } },
  } as unknown as Entity;
  const dirX = (pivot: { x: number; y: number }) =>
    Math.sign(Math.round((resolveRotateReferenceAnchor(wall, pivot)!.x - pivot.x) * 1e6));

  it.each([
    ['NE corner',      { x: 1000, y: 100 },  -1], // → NW (west)
    ['mid east face',  { x: 1000, y: 0 },    -1], // → mid west
    ['SE corner',      { x: 1000, y: -100 }, -1], // → SW
    ['SW corner',      { x: 0, y: -100 },     1], // → SE (east)
    ['mid west face',  { x: 0, y: 0 },        1], // → mid east
    ['NW corner',      { x: 0, y: 100 },      1], // → NE
    ['mid north face', { x: 500, y: 100 },   -1], // central-X → west
    ['axis centre',    { x: 500, y: 0 },     -1], // central-X → west
    ['mid south face', { x: 500, y: -100 },  -1], // central-X → west
  ])('%s → dir.x sign %d', (_label, pivot, expected) => {
    expect(dirX(pivot)).toBe(expected);
  });
});

describe('resolveRotateReferenceAnchor — RECTANGLE (ADR-561, wall parity, ONE axis)', () => {
  // 40×20 axis-aligned rectangle polyline → major = +X (width 40 > height 20), centre (20,10).
  const rect = {
    type: 'polyline',
    vertices: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }, { x: 0, y: 20 }],
    closed: true,
  } as unknown as Entity;

  it('pivot at NE corner → reference along the major (long) side, toward the body (−X)', () => {
    const anchor = resolveRotateReferenceAnchor(rect, { x: 40, y: 20 })!;
    expect(anchor).not.toBeNull();
    near(anchor.x - 40, -1); // −X unit (coaxial with the long side, toward centre)
    near(anchor.y - 20, 0);
  });

  it('pivot at SW corner → reference points +X (toward the body), still coaxial with the side', () => {
    const anchor = resolveRotateReferenceAnchor(rect, { x: 0, y: 0 })!;
    near(anchor.x - 0, 1);
    near(anchor.y - 0, 0);
  });

  it('scene rectangle (corner1/corner2) resolves identically to its polyline form', () => {
    const sceneRect = { type: 'rectangle', corner1: { x: 0, y: 0 }, corner2: { x: 40, y: 20 } } as unknown as Entity;
    const anchor = resolveRotateReferenceAnchor(sceneRect, { x: 40, y: 20 })!;
    near(anchor.x - 40, -1);
    near(anchor.y - 20, 0);
  });

  it('TILTED rectangle (90°) → reference tilts with it (runs along the now-vertical long side)', () => {
    // 40×20 rect rotated 90° CCW: long side now vertical (world +Y), centre (−10,20).
    const tilted = {
      type: 'polyline',
      vertices: [{ x: 0, y: 0 }, { x: 0, y: 40 }, { x: -20, y: 40 }, { x: -20, y: 0 }],
      closed: true,
    } as unknown as Entity;
    const anchor = resolveRotateReferenceAnchor(tilted, { x: 0, y: 40 })!;
    near(anchor.x - 0, 0);   // no X → vertical axis (coaxial with the tilted long side)
    near(anchor.y - 40, -1); // toward the body (−Y)
  });

  it('taller-than-wide rectangle → major axis is the vertical (long) side', () => {
    // 20×40 rect → halfLength(20) > halfWidth(10) → major uses local +Y.
    const tall = {
      type: 'polyline',
      vertices: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 40 }, { x: 0, y: 40 }],
      closed: true,
    } as unknown as Entity;
    const anchor = resolveRotateReferenceAnchor(tall, { x: 20, y: 40 })!;
    near(anchor.x - 20, 0);   // vertical major axis
    near(anchor.y - 40, -1);  // toward the body (−Y)
  });
});

describe('resolveRotateReferenceAnchor — GENERIC polyline (2 lines joined at an angle, ADR-561)', () => {
  // Giorgio 2026-07-05 repro: an open «L» — vertical leg A→P (len 100) is the LONGEST
  // segment, horizontal leg P→B (len 60). bbox x∈[0,60] y∈[0,100], centre (30,50). The
  // reference axis must be COAXIAL with the dominant (vertical) leg, NEVER horizontal.
  const A = { x: 0, y: 100 }, P = { x: 0, y: 0 }, B = { x: 60, y: 0 };
  const lshape = { type: 'lwpolyline', vertices: [A, P, B], closed: false } as unknown as Entity;

  it('pivot at the corner P → reference runs UP the vertical leg toward the body (+Y), not horizontal', () => {
    const anchor = resolveRotateReferenceAnchor(lshape, P)!;
    expect(anchor).not.toBeNull();
    near(anchor.x - P.x, 0);  // no X component → coaxial with the vertical leg (NOT world-X)
    near(anchor.y - P.y, 1);  // +Y toward A / the body
  });

  it('pivot at the free end A → reference runs DOWN the leg toward the body (−Y), coaxial', () => {
    const anchor = resolveRotateReferenceAnchor(lshape, A)!;
    near(anchor.x - A.x, 0);
    near(anchor.y - A.y, -1);
  });

  it('the baseline is NEVER the world-horizontal IDENTITY axis (the pre-fix bug)', () => {
    const anchor = resolveRotateReferenceAnchor(lshape, P)!;
    // Pre-fix it returned pivot + (1,0) (world +X). Assert the X unit is gone.
    expect(Math.abs(anchor.x - P.x)).toBeLessThan(1e-6);
  });
});

describe('resolveRotateReferenceAnchor — no orientation → null (legacy fallback)', () => {
  it('params-less non-line primitive (circle) → null', () => {
    const circle = { id: 'X', type: 'circle', center: { x: 0, y: 0 }, radius: 50 } as unknown as Entity;
    expect(resolveRotateReferenceAnchor(circle, { x: 0, y: 0 })).toBeNull();
  });
});
