/**
 * ADR-363 Slice D — `wall-rect-adapter` tests.
 *
 * Covers `isRectWall` (straight vs curved/polyline proxy) and `applyRectWallGrip`:
 *   - returns null for curved/polyline walls and for non-rect grip kinds,
 *   - corner / thickness / length resize via the shared rect-grip-engine,
 *   - wall semantics: preserves flip, clears miters, drops dna, clamps thickness,
 *   - axis round-trip (no drift) for axis-aligned + diagonal walls.
 */

import { applyRectWallGrip, isRectWall } from '../wall-rect-adapter';
import { buildDefaultWallParams } from '../../../hooks/drawing/wall-completion';
import type { WallParams } from '../../types/wall-types';

const START = { x: 0, y: 0 };
const END = { x: 1000, y: 0 };

function straight(extra: Partial<WallParams> = {}): WallParams {
  return { ...buildDefaultWallParams(START, END), ...extra };
}

const MITERS = {
  startMiter: { outer: { x: -5, y: 10 }, inner: { x: -5, y: -10 } },
  endMiter: { outer: { x: 1005, y: 10 }, inner: { x: 1005, y: -10 } },
};

describe('isRectWall', () => {
  it('true for a plain straight wall', () => {
    expect(isRectWall(straight())).toBe(true);
  });
  it('false when curveControl is present', () => {
    expect(isRectWall(straight({ curveControl: { x: 500, y: 200, z: 0 } }))).toBe(false);
  });
  it('false when polylineVertices has ≥3 points', () => {
    expect(isRectWall(straight({
      polylineVertices: [{ x: 0, y: 0, z: 0 }, { x: 500, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }],
    }))).toBe(false);
  });
});

describe('applyRectWallGrip — null fall-through', () => {
  it('returns null for a curved wall (caller uses legacy handlers)', () => {
    expect(applyRectWallGrip('wall-corner-end-pos', straight({ curveControl: { x: 500, y: 200, z: 0 } }), { x: 0, y: 100 }))
      .toBeNull();
  });
  it('returns null for a non-rect grip kind (rotation / endpoint)', () => {
    expect(applyRectWallGrip('wall-rotation', straight(), { x: 0, y: 100 })).toBeNull();
    expect(applyRectWallGrip('wall-start', straight(), { x: 0, y: 100 })).toBeNull();
  });
});

describe('applyRectWallGrip — wall semantics', () => {
  it('corner drag preserves flip, clears miters, drops dna', () => {
    const params = straight({ flip: true, ...MITERS });
    expect(params.dna).toBeDefined();
    const next = applyRectWallGrip('wall-corner-end-pos', params, { x: 0, y: 100 })!;
    expect(next).not.toBeNull();
    expect(next.flip).toBe(true);
    expect(next.startMiter).toBeUndefined();
    expect(next.endMiter).toBeUndefined();
    expect(next.dna).toBeUndefined();
  });

  it('thickness edge sign honours flip (+perp grows, flipped shrinks)', () => {
    const noFlip = straight({ flip: false });
    const t = noFlip.thickness;
    const grown = applyRectWallGrip('wall-thickness', noFlip, { x: 0, y: 100 })!;
    expect(grown.thickness).toBeCloseTo(t + 100, 6);

    const flipped = straight({ flip: true });
    const shrunk = applyRectWallGrip('wall-thickness', flipped, { x: 0, y: 100 })!;
    expect(shrunk.thickness).toBeCloseTo(t - 100, 6);
  });

  it('length edge moves the END short edge, start fixed', () => {
    const params = straight();
    const next = applyRectWallGrip('wall-edge-length', params, { x: 200, y: 0 })!;
    expect(next.start.x).toBeCloseTo(0, 6);
    expect(next.end.x).toBeCloseTo(1200, 6);
  });

  it('thickness clamps to the scene-unit minimum on a large shrink', () => {
    const next = applyRectWallGrip('wall-thickness', straight({ flip: false }), { x: 0, y: -10000 })!;
    expect(next.thickness).toBeGreaterThanOrEqual(50);
  });
});

describe('applyRectWallGrip — axis round-trip (zero delta = no drift)', () => {
  it('axis-aligned wall: start/end/thickness preserved', () => {
    const params = straight();
    const next = applyRectWallGrip('wall-corner-end-pos', params, { x: 0, y: 0 })!;
    expect(next.start.x).toBeCloseTo(0, 6);
    expect(next.start.y).toBeCloseTo(0, 6);
    expect(next.end.x).toBeCloseTo(1000, 6);
    expect(next.end.y).toBeCloseTo(0, 6);
    expect(next.thickness).toBeCloseTo(params.thickness, 6);
  });

  it('diagonal wall: endpoints reconstructed without drift', () => {
    const params = { ...buildDefaultWallParams({ x: 0, y: 0 }, { x: 1000, y: 1000 }) };
    const next = applyRectWallGrip('wall-corner-end-pos', params, { x: 0, y: 0 })!;
    expect(next.start.x).toBeCloseTo(0, 6);
    expect(next.start.y).toBeCloseTo(0, 6);
    expect(next.end.x).toBeCloseTo(1000, 6);
    expect(next.end.y).toBeCloseTo(1000, 6);
  });
});
