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

describe('resolveRotateReferenceAnchor — no orientation → null (legacy fallback)', () => {
  it('params-less non-line primitive (circle) → null', () => {
    const circle = { id: 'X', type: 'circle', center: { x: 0, y: 0 }, radius: 50 } as unknown as Entity;
    expect(resolveRotateReferenceAnchor(circle, { x: 0, y: 0 })).toBeNull();
  });
});
