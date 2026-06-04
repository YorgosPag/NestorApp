/**
 * ADR-408 Φ11 — computeElbowBend / tessellateBendFootprint tests (the bend SSoT).
 *
 * Covers the Revit long-radius elbow maths used by the 2D footprint, the 3D torus
 * and the pipe trim: a 90° bend's centre/radii/tangent points, the collinear &
 * degenerate null cases, the bendFactor scaling, and the closed footprint ring.
 */

import { computeElbowBend, tessellateBendFootprint, DEFAULT_BEND_FACTOR } from '../mep-fitting-bend';

const RIGHT = { x: 1, y: 0 };
const LEFT = { x: -1, y: 0 };
const UP = { x: 0, y: 1 };
const NODE = { x: 0, y: 0 };

describe('computeElbowBend — 90° long-radius elbow', () => {
  const D = 10;
  const bend = computeElbowBend(NODE, RIGHT, UP, D)!;

  it('resolves a non-null bend for two perpendicular legs', () => {
    expect(bend).not.toBeNull();
  });

  it('uses the Revit long-radius R = 1.5·D as the centreline radius', () => {
    expect(bend.centerRadius).toBeCloseTo(DEFAULT_BEND_FACTOR * D); // 15
  });

  it('places concentric walls at R ± D/2', () => {
    expect(bend.outerRadius).toBeCloseTo(20);
    expect(bend.innerRadius).toBeCloseTo(10);
  });

  it('tangent length T = R/tan(φ/2) = R for a 90° bend', () => {
    expect(bend.tangentLen).toBeCloseTo(15);
  });

  it('lands the tangent points on the two legs', () => {
    expect(bend.tangentA.x).toBeCloseTo(15);
    expect(bend.tangentA.y).toBeCloseTo(0);
    expect(bend.tangentB.x).toBeCloseTo(0);
    expect(bend.tangentB.y).toBeCloseTo(15);
  });

  it('centres the arc on the bisector at (R, R)', () => {
    expect(bend.center.x).toBeCloseTo(15);
    expect(bend.center.y).toBeCloseTo(15);
  });
});

describe('computeElbowBend — uniform elbow end radii', () => {
  const bend = computeElbowBend(NODE, RIGHT, UP, 10)!;
  it('sets equal start/end radii at D/2 when both legs share a diameter', () => {
    expect(bend.radiusStart).toBeCloseTo(5);
    expect(bend.radiusEnd).toBeCloseTo(5);
  });
});

describe('computeElbowBend — reducing elbow (differing Ø)', () => {
  // Leg A = Ø20 (radius 10), leg B = Ø6 (radius 3).
  const bend = computeElbowBend(NODE, RIGHT, UP, 20, DEFAULT_BEND_FACTOR, 6)!;

  it('tapers radiusStart (leg A) → radiusEnd (leg B)', () => {
    expect(bend.radiusStart).toBeCloseTo(10);
    expect(bend.radiusEnd).toBeCloseTo(3);
  });

  it('sizes the centreline radius on the LARGER pipe (R = 1.5 · maxØ)', () => {
    expect(bend.centerRadius).toBeCloseTo(DEFAULT_BEND_FACTOR * 20); // 30, not 1.5·6
  });

  it('bounds the outer wall with the larger radius (back-compat field)', () => {
    expect(bend.outerRadius).toBeCloseTo(30 + 10); // R + maxØ/2
  });

  it('returns null when either diameter is non-positive', () => {
    expect(computeElbowBend(NODE, RIGHT, UP, 20, DEFAULT_BEND_FACTOR, 0)).toBeNull();
  });
});

describe('tessellateBendFootprint — reducing taper', () => {
  const bend = computeElbowBend(NODE, RIGHT, UP, 20, DEFAULT_BEND_FACTOR, 6)!;
  it('narrows the wall band from tangentA to tangentB', () => {
    const segments = 8;
    const ring = tessellateBendFootprint(bend, segments);
    // Ring = [outer(0..segments), inner(segments..0)]. Band width at a sample =
    // |outer_i − inner_i| measured radially ≈ 2·r_i, so it must shrink start → end.
    const outer = ring.slice(0, segments + 1);
    const inner = ring.slice(segments + 1).reverse(); // back to start→end order
    const band = (i: number) =>
      Math.hypot(outer[i]!.x - inner[i]!.x, outer[i]!.y - inner[i]!.y);
    expect(band(0)).toBeGreaterThan(band(segments));
  });
});

describe('computeElbowBend — null cases', () => {
  it('returns null for collinear legs (straight pass-through, no bend)', () => {
    expect(computeElbowBend(NODE, RIGHT, LEFT, 10)).toBeNull();
  });

  it('returns null for a degenerate (zero-length) direction', () => {
    expect(computeElbowBend(NODE, { x: 0, y: 0 }, UP, 10)).toBeNull();
  });

  it('returns null for a non-positive diameter', () => {
    expect(computeElbowBend(NODE, RIGHT, UP, 0)).toBeNull();
  });
});

describe('computeElbowBend — bendFactor scaling', () => {
  it('scales the centreline radius with the bendFactor', () => {
    const tight = computeElbowBend(NODE, RIGHT, UP, 10, 1.0)!;
    const wide = computeElbowBend(NODE, RIGHT, UP, 10, 2.0)!;
    expect(tight.centerRadius).toBeCloseTo(10);
    expect(wide.centerRadius).toBeCloseTo(20);
  });
});

describe('tessellateBendFootprint', () => {
  const bend = computeElbowBend(NODE, RIGHT, UP, 10)!;

  it('returns a closed ring of 2·(segments+1) vertices', () => {
    const segments = 8;
    const ring = tessellateBendFootprint(bend, segments);
    expect(ring).toHaveLength(2 * (segments + 1));
  });

  it('keeps every vertex on the z=0 plan plane', () => {
    for (const v of tessellateBendFootprint(bend, 8)) expect(v.z).toBe(0);
  });
});
