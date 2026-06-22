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

// ──────────────────────────────────────────────────────────────────────────────
// ADR-398 §3.12 — arc-length listening dimensions (ΚΥΚΛΟΣ + ΤΟΞΟ)
// ──────────────────────────────────────────────────────────────────────────────

const ARC_OPTS = { gapOffsetScene: 24, centerOffsetScene: 52 };

/** Frame όπου το facePointAt(ghostCenterAlong) = `colPt` (origin, facePerp=0, along=0). */
function arcFrame(colPt: { x: number; y: number }, arc: GhostFaceFrame['arc']): GhostFaceFrame {
  return {
    origin: { x: colPt.x, y: colPt.y },
    axisDir: { x: 1, y: 0 },
    perpDir: { x: 0, y: -1 },
    facePerp: 0,
    outwardSign: 1,
    faceAlongMin: 0,
    faceAlongMax: 0,
    ghostCenterAlong: 0,
    ghostHalfWidth: 0,
    arc,
  };
}

const CIRCLE = { center: { x: 0, y: 0 }, radius: 1000, startAngle: 0, endAngle: 360 };

describe('resolveGhostFaceDimensions — arc branch (§3.12)', () => {
  it('circle θ=60°: arc gaps to bracketing quadrants (0°/90°) + radius, with s=r·θ', () => {
    // column at 60° on r=1000 circle → (500, 866.03).
    const dims = resolveGhostFaceDimensions(arcFrame({ x: 500, y: 866.0254 }, CIRCLE), ARC_OPTS);
    expect(dims.map((d) => d.kind)).toEqual(['arcLeftGap', 'arcRightGap', 'radius']);
    const byKind = Object.fromEntries(dims.map((d) => [d.kind, d.valueScene]));
    expect(byKind.arcLeftGap).toBeCloseTo(1000 * (Math.PI / 3), 2); // 60° CW → quadrant 0° = 1047.2
    expect(byKind.arcRightGap).toBeCloseTo(1000 * (Math.PI / 6), 2); // 30° CCW → quadrant 90° = 523.6
    expect(byKind.radius).toBeCloseTo(1000, 6);
  });

  it('carries curved-render span + sweepDeg on the arc gaps, witness pts ON the circle', () => {
    const dims = resolveGhostFaceDimensions(arcFrame({ x: 500, y: 866.0254 }, CIRCLE), ARC_OPTS);
    const left = dims.find((d) => d.kind === 'arcLeftGap')!;
    expect(left.arc).toEqual({ center: { x: 0, y: 0 }, radius: 1000, startAngleDeg: 0, endAngleDeg: 60 });
    expect(left.sweepDeg).toBeCloseTo(60);
    expect(left.p1.x).toBeCloseTo(1000); // quadrant 0° = (1000,0)
    expect(left.p1.y).toBeCloseTo(0);
    expect(left.p2.x).toBeCloseTo(500); // column 60°
    expect(left.p2.y).toBeCloseTo(866.0254);
    // dim-arc ref sits OUTWARD at radius + gapOffset.
    expect(Math.hypot(left.dimLineRef.x, left.dimLineRef.y)).toBeCloseTo(1024);
    const radius = dims.find((d) => d.kind === 'radius')!;
    expect(radius.arc).toBeUndefined(); // ευθεία → χωρίς curved span
  });

  it('wraps around 0°/360° (θ=350° → quadrant 270° CW, quadrant 0° CCW)', () => {
    // 350° on r=1000 → (984.8, -173.6).
    const dims = resolveGhostFaceDimensions(
      arcFrame({ x: 1000 * Math.cos((350 * Math.PI) / 180), y: 1000 * Math.sin((350 * Math.PI) / 180) }, CIRCLE),
      ARC_OPTS,
    );
    const byKind = Object.fromEntries(dims.map((d) => [d.kind, d.valueScene]));
    expect(byKind.arcLeftGap).toBeCloseTo(1000 * ((80 * Math.PI) / 180), 2); // 350→270 CW = 80°
    expect(byKind.arcRightGap).toBeCloseTo(1000 * ((10 * Math.PI) / 180), 2); // 350→360 CCW = 10°
  });

  it('ARC entity uses real endpoints as datums (semicircle 0°→180°, θ=120°)', () => {
    const arc = { center: { x: 0, y: 0 }, radius: 1000, startAngle: 0, endAngle: 180 };
    // θ=120° → (-500, 866.03). cw datum = quadrant 90°, ccw datum = endpoint 180°.
    const dims = resolveGhostFaceDimensions(arcFrame({ x: -500, y: 866.0254 }, arc), ARC_OPTS);
    const byKind = Object.fromEntries(dims.map((d) => [d.kind, d.valueScene]));
    expect(byKind.arcLeftGap).toBeCloseTo(1000 * ((30 * Math.PI) / 180), 2); // 120→90 = 30°
    expect(byKind.arcRightGap).toBeCloseTo(1000 * ((60 * Math.PI) / 180), 2); // 120→180 endpoint = 60°
  });

  it('config gates which arc dims are emitted', () => {
    const noRadius = resolveGhostFaceDimensions(arcFrame({ x: 500, y: 866.0254 }, CIRCLE), {
      ...ARC_OPTS,
      arcConfig: { showArcGaps: true, showRadius: false, labelMode: 'length' },
    });
    expect(noRadius.map((d) => d.kind)).toEqual(['arcLeftGap', 'arcRightGap']);
    const noGaps = resolveGhostFaceDimensions(arcFrame({ x: 500, y: 866.0254 }, CIRCLE), {
      ...ARC_OPTS,
      arcConfig: { showArcGaps: false, showRadius: true, labelMode: 'length' },
    });
    expect(noGaps.map((d) => d.kind)).toEqual(['radius']);
  });

  it('straight frames remain unchanged (no arc → no regression)', () => {
    const dims = resolveGhostFaceDimensions(baseFrame(), ARC_OPTS);
    expect(dims.map((d) => d.kind)).toEqual(['leftGap', 'rightGap', 'centerToCenter']);
  });
});
