/**
 * Tests for `resolveGhostFaceDimensions` (ADR-508 §dim) — pure along-face listening dims.
 */

import { resolveGhostFaceDimensions } from '../ghost-face-dim-references';
import type { GhostFaceFrame } from '../linear-member-face-snap';

/** Horizontal existing wall, axis +X from (0,0): u=(1,0), p=(0,-1), face on axis (facePerp=0),
 *  outward = +Y (outwardSign=-1 · p). Wall length 4000, ghost width 200 (half=100). */
function baseFrame(overrides: Partial<GhostFaceFrame> = {}): GhostFaceFrame {
  return {
    origin: { x: 0, y: 0 },
    axisDir: { x: 1, y: 0 },
    perpDir: { x: 0, y: -1 },
    facePerp: 0,
    outwardSign: -1,
    faceAlongMin: 0,
    faceAlongMax: 4000,
    ghostCenterAlong: 1200,
    ghostHalfWidth: 100,
    ...overrides,
  };
}

const OPTS = { gapOffsetScene: 24, centerOffsetScene: 52 };

describe('resolveGhostFaceDimensions', () => {
  it('emits all 3 dims (left of centre) with correct kinds + measured values', () => {
    const dims = resolveGhostFaceDimensions(baseFrame(), OPTS);
    expect(dims.map((d) => d.kind)).toEqual(['leftGap', 'rightGap', 'centerToCenter']);
    const byKind = Object.fromEntries(dims.map((d) => [d.kind, d.valueScene]));
    expect(byKind.leftGap).toBeCloseTo(1100); // 1100 - 0
    expect(byKind.rightGap).toBeCloseTo(2700); // 4000 - 1300
    expect(byKind.centerToCenter).toBeCloseTo(800); // |1200 - 2000|
  });

  it('places witness points ON the face line (facePerp=0 ⇒ y=0)', () => {
    const dims = resolveGhostFaceDimensions(baseFrame(), OPTS);
    const left = dims.find((d) => d.kind === 'leftGap')!;
    expect(left.p1).toEqual({ x: 0, y: 0 });
    expect(left.p2).toEqual({ x: 1100, y: 0 });
    const ctr = dims.find((d) => d.kind === 'centerToCenter')!;
    expect(ctr.p1).toEqual({ x: 2000, y: 0 });
    expect(ctr.p2).toEqual({ x: 1200, y: 0 });
  });

  it('offsets the dim line OUTWARD (toward the ghost, +Y here) by the supplied amount', () => {
    const dims = resolveGhostFaceDimensions(baseFrame(), OPTS);
    const left = dims.find((d) => d.kind === 'leftGap')!;
    expect(left.dimLineRef.x).toBeCloseTo(550); // midpoint of [0, 1100]
    expect(left.dimLineRef.y).toBeCloseTo(24); // gapOffset, outward +Y
    const ctr = dims.find((d) => d.kind === 'centerToCenter')!;
    expect(ctr.dimLineRef.y).toBeCloseTo(52); // centerOffset, larger outer row
  });

  it('drops the centre dim when the ghost is exactly at the face centre', () => {
    const dims = resolveGhostFaceDimensions(baseFrame({ ghostCenterAlong: 2000 }), OPTS);
    expect(dims.map((d) => d.kind)).toEqual(['leftGap', 'rightGap']);
  });

  it('drops a gap dim when the ghost is flush to that end', () => {
    // ghostCenterAlong=100, half=100 ⇒ left base corner at 0 ⇒ leftGap = 0 → dropped.
    const dims = resolveGhostFaceDimensions(baseFrame({ ghostCenterAlong: 100 }), OPTS);
    expect(dims.map((d) => d.kind)).toEqual(['rightGap', 'centerToCenter']);
    const ctr = dims.find((d) => d.kind === 'centerToCenter')!;
    expect(ctr.valueScene).toBeCloseTo(1900); // |100 - 2000|
  });

  it('respects the axis orientation (vertical wall) for witness geometry', () => {
    // u=(0,1) vertical, p=(u.y,-u.x)=(1,0), facePerp=0, outward=+X (outwardSign=+1).
    const dims = resolveGhostFaceDimensions(
      baseFrame({ axisDir: { x: 0, y: 1 }, perpDir: { x: 1, y: 0 }, outwardSign: 1 }),
      OPTS,
    );
    const left = dims.find((d) => d.kind === 'leftGap')!;
    expect(left.p1).toEqual({ x: 0, y: 0 });
    expect(left.p2).toEqual({ x: 0, y: 1100 }); // along +Y
    expect(left.dimLineRef.x).toBeCloseTo(24); // outward +X
    expect(left.dimLineRef.y).toBeCloseTo(550);
  });
});
