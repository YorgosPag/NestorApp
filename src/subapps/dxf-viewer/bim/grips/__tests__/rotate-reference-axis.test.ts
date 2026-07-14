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

describe('resolveRotateReferenceAnchor — annotation symbol (axis = glyph rotation, ADR-583)', () => {
  // Point-glyph: no params / no geometry.bbox; orientation lives in the top-level `rotation`.
  const symbol = (rotation: number, position = { x: 0, y: 0 }) =>
    ({
      id: 'S1', type: 'annotation-symbol', position, rotation,
      kind: 'north-arrow', symbolId: 'northArrowSimple', sizeMm: 20,
    } as unknown as Entity);

  it('unrotated symbol → reference axis is horizontal (coaxial with the local +X face)', () => {
    // Body at origin, pivot to the EAST → axis runs back toward the body (−X), purely horizontal.
    const anchor = resolveRotateReferenceAnchor(symbol(0), { x: 100, y: 0 })!;
    expect(anchor).not.toBeNull();
    near(anchor.x - 100, -1);
    near(anchor.y - 0, 0);
  });

  it('rotated symbol → reference axis follows the glyph rotation exactly (never diverges from the faces)', () => {
    const rad = (30 * Math.PI) / 180;
    const anchor = resolveRotateReferenceAnchor(symbol(30), { x: 100, y: 0 })!;
    const dir = { x: anchor.x - 100, y: anchor.y - 0 };
    // Collinear with the rotated local ±X (cos30, sin30): cross product ≈ 0, and a UNIT step.
    near(dir.x * Math.sin(rad) - dir.y * Math.cos(rad), 0);
    near(Math.hypot(dir.x, dir.y), 1);
  });

  it('reference points from the pivot toward the symbol body (top-level position)', () => {
    // Body at (500,0), pivot to its RIGHT → axis points LEFT (toward body), still along ±X.
    const anchor = resolveRotateReferenceAnchor(symbol(0, { x: 500, y: 0 }), { x: 900, y: 0 })!;
    near(anchor.x - 900, -1);
    near(anchor.y, 0);
  });
});

describe('resolveRotateReferenceAnchor — raster image / entourage (axis = rotation deg, ADR-654)', () => {
  // Params-less flat sprite: orientation in top-level `rotation` (deg); body centre from imageRectFrame
  // (position = κάτω-αριστερή γωνία → +R(θ)·(w/2,h/2)). Wall-parity: axis coaxial with a side, toward body.
  const image = (rotation: number, position = { x: 0, y: 0 }, width = 100, height = 50) =>
    ({ id: 'IMG1', type: 'image', position, width, height, rotation, url: 'x' } as unknown as Entity);

  it('unrotated image → horizontal reference axis, pointing from the pivot toward the body', () => {
    // 100×50 at (0,0) → centre (50,25). Pivot to the EAST → axis runs back toward the body (−X).
    const anchor = resolveRotateReferenceAnchor(image(0), { x: 200, y: 25 })!;
    expect(anchor).not.toBeNull();
    near(anchor.x - 200, -1);
    near(anchor.y - 25, 0);
  });

  it('rotated image → reference axis follows the sprite rotation exactly (coaxial with the sides)', () => {
    const rad = (90 * Math.PI) / 180;
    const anchor = resolveRotateReferenceAnchor(image(90), { x: 100, y: 100 })!;
    const dir = { x: anchor.x - 100, y: anchor.y - 100 };
    // Collinear with the rotated local ±X (cos90, sin90) = vertical: cross ≈ 0, unit step.
    near(dir.x * Math.sin(rad) - dir.y * Math.cos(rad), 0);
    near(Math.hypot(dir.x, dir.y), 1);
  });
});

describe('resolveRotateReferenceAnchor — graphic scale-bar (axis = angleRad, ADR-583 Φ3)', () => {
  // DERIVED geometry.bbox uses the FLAT {minX,minY,maxX,maxY} shape — entityCentre must read it
  // without throwing (the generic {min,max} path would crash on `bbox.min.x`).
  const bar = (angleRad: number, position = { x: 0, y: 0 }) =>
    ({
      id: 'B1', type: 'scale-bar', position, angleRad, length: 10, unit: 'm',
      geometry: { bbox: { minX: 0, minY: 0, maxX: 10_000, maxY: 0 }, endPosition: { x: 10_000, y: 0 } },
    } as unknown as Entity);

  it('horizontal bar → reference axis is horizontal (coaxial with the bar length, no crash on flat bbox)', () => {
    // Body spans x∈[0,10000] (centre 5000,0); pivot EAST of the centre → axis points −X (toward body).
    const anchor = resolveRotateReferenceAnchor(bar(0), { x: 9_000, y: 0 })!;
    expect(anchor).not.toBeNull();
    near(anchor.x - 9_000, -1);
    near(anchor.y, 0);
  });

  it('tilted bar → reference axis follows angleRad exactly (never diverges from the faces)', () => {
    const rad = Math.PI / 6;
    const anchor = resolveRotateReferenceAnchor(bar(rad, { x: 0, y: 0 }), { x: 100, y: 0 })!;
    const dir = { x: anchor.x - 100, y: anchor.y };
    near(dir.x * Math.sin(rad) - dir.y * Math.cos(rad), 0); // collinear with (cos,sin)
    near(Math.hypot(dir.x, dir.y), 1);
  });
});

describe('resolveRotateReferenceAnchor — HATCH boundary edge alignment (ADR-627)', () => {
  // Axis-aligned square hatch → bottom/top edges are HORIZONTAL, centre (50,50).
  const square = {
    type: 'hatch',
    boundaryPaths: [[{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]],
  } as unknown as Entity;

  it('horizontal edge exists + pivot at its endpoint → reference COINCIDES with it (world +X, toward body)', () => {
    const anchor = resolveRotateReferenceAnchor(square, { x: 0, y: 0 })!; // SW corner, on the bottom edge
    expect(anchor).not.toBeNull();
    near(anchor.x - 0, 1); // +X → coaxial with the bottom edge, toward the far end / body
    near(anchor.y - 0, 0);
  });

  it('horizontal edge exists → axis stays horizontal, orientation flips toward the body', () => {
    const anchor = resolveRotateReferenceAnchor(square, { x: 100, y: 0 })!; // SE corner
    near(anchor.x - 100, -1); // −X toward the body (west)
    near(anchor.y - 0, 0);
  });

  it('NO horizontal edge (45° diamond) + pivot on a vertex → reference coincides with the clicked edge', () => {
    // Diamond edges are all ±45°; ring order makes (0,10)→(10,0) the first edge incident to (0,10).
    const diamond = {
      type: 'hatch',
      boundaryPaths: [[{ x: 0, y: 10 }, { x: 10, y: 0 }, { x: 20, y: 10 }, { x: 10, y: 20 }]],
    } as unknown as Entity;
    const anchor = resolveRotateReferenceAnchor(diamond, { x: 0, y: 10 })!;
    const dir = { x: anchor.x - 0, y: anchor.y - 10 };
    near(dir.x, Math.SQRT1_2);   // +45° down-right, coaxial with the incident edge toward the body
    near(dir.y, -Math.SQRT1_2);
    near(Math.hypot(dir.x, dir.y), 1);
  });

  it('NO horizontal edge + pivot NOT on a vertex → reference aligns with the LONGEST edge', () => {
    // Triangle: longest edge (0,0)→(100,50); pivot at the centroid (not near any vertex).
    const tri = {
      type: 'hatch',
      boundaryPaths: [[{ x: 0, y: 0 }, { x: 100, y: 50 }, { x: 20, y: 80 }]],
    } as unknown as Entity;
    const anchor = resolveRotateReferenceAnchor(tri, { x: 40, y: 130 / 3 })!;
    const dir = { x: anchor.x - 40, y: anchor.y - 130 / 3 };
    const ux = 100 / Math.hypot(100, 50);
    const uy = 50 / Math.hypot(100, 50);
    near(dir.x * uy - dir.y * ux, 0); // collinear with the longest edge's axis
    near(Math.hypot(dir.x, dir.y), 1);
  });

  it('empty / degenerate boundary → null (legacy first-move fallback)', () => {
    expect(resolveRotateReferenceAnchor({ type: 'hatch', boundaryPaths: [] } as unknown as Entity, { x: 0, y: 0 })).toBeNull();
    expect(
      resolveRotateReferenceAnchor({ type: 'hatch', boundaryPaths: [[{ x: 1, y: 1 }]] } as unknown as Entity, { x: 0, y: 0 }),
    ).toBeNull();
  });
});

describe('resolveRotateReferenceAnchor — no orientation → null (legacy fallback)', () => {
  it('params-less non-line primitive (circle) → null', () => {
    const circle = { id: 'X', type: 'circle', center: { x: 0, y: 0 }, radius: 50 } as unknown as Entity;
    expect(resolveRotateReferenceAnchor(circle, { x: 0, y: 0 })).toBeNull();
  });
});
