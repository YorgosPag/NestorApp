/**
 * ADR-398 §3.15 — rect-cartesian-snap (Cartesian Magnet) pure resolver tests.
 * 9-point/grid snap, Shift κλάσματα, center, edge-clearance→null, rotated u/v, 4 dims, findRectContaining.
 */

import {
  resolveRectCartesianSnap,
  buildRectGrid,
  findRectContaining,
  resolveRectCartesianDims,
  type RectFrame,
} from '../rect-cartesian-snap';

// Ορθογώνιο 6000×4000 axis-aligned: center 0,0· u=+X (halfW 3000)· v=+Y (halfV 2000).
const RECT: RectFrame = { center: { x: 0, y: 0 }, u: { x: 1, y: 0 }, v: { x: 0, y: 1 }, halfW: 3000, halfV: 2000 };
const WPP = 20; // adaptiveDistanceStep(20) = niceRound(500) = 500
const OPTS = { worldPerPixel: WPP, clearanceScene: 250 }; // maxHalfW 2750, maxHalfV 1750

describe('resolveRectCartesianSnap (ADR-398 §3.15)', () => {
  it('snaps to CENTER within center capture', () => {
    const r = resolveRectCartesianSnap({ x: 5, y: 5 }, RECT, 'mm', OPTS);
    expect(r!.isCenter).toBe(true);
    expect(r!.position).toEqual({ x: 0, y: 0 });
  });

  it('snaps to a CORNER node (±(half−cover))', () => {
    const r = resolveRectCartesianSnap({ x: 2700, y: 1700 }, RECT, 'mm', OPTS);
    expect(r!.position).toEqual({ x: 2750, y: 1750 });
    expect(r!.isNode).toBe(true);
  });

  it('snaps to an EDGE-MID node (0, +(halfV−cover))', () => {
    const r = resolveRectCartesianSnap({ x: 30, y: 1700 }, RECT, 'mm', OPTS);
    expect(r!.position).toEqual({ x: 0, y: 1750 });
    expect(r!.isNode).toBe(true);
  });

  it('snaps to nice-absolute grid multiple of the adaptive step', () => {
    const r = resolveRectCartesianSnap({ x: 1230, y: 0 }, RECT, 'mm', OPTS);
    expect(r!.position).toEqual({ x: 1000, y: 0 });
    expect(r!.isNode).toBe(false);
  });

  it('Shift → rings on dimension fractions (half/2)', () => {
    const r = resolveRectCartesianSnap({ x: 1400, y: 0 }, RECT, 'mm', { ...OPTS, shiftFractions: true });
    expect(r!.position).toEqual({ x: 1500, y: 0 }); // halfW/2 = 1500
  });

  it('returns null near the rim (beyond cover → §3.11 edge takes over)', () => {
    expect(resolveRectCartesianSnap({ x: 2900, y: 0 }, RECT, 'mm', OPTS)).toBeNull();
  });

  it('works for a ROTATED rectangle (local u/v) — one code path', () => {
    const a = (30 * Math.PI) / 180;
    const rot: RectFrame = {
      center: { x: 0, y: 0 },
      u: { x: Math.cos(a), y: Math.sin(a) },
      v: { x: -Math.sin(a), y: Math.cos(a) },
      halfW: 3000, halfV: 2000,
    };
    // κόμβος local (2750, 0) → world κατά μήκος του στραμμένου u.
    const worldNode = { x: 2750 * Math.cos(a), y: 2750 * Math.sin(a) };
    const r = resolveRectCartesianSnap(worldNode, rot, 'mm', OPTS);
    expect(r!.position.x).toBeCloseTo(worldNode.x, 5);
    expect(r!.position.y).toBeCloseTo(worldNode.y, 5);
    expect(r!.isNode).toBe(true);
  });
});

describe('findRectContaining', () => {
  it('returns the containing rect, null otherwise', () => {
    expect(findRectContaining({ x: 100, y: 100 }, [RECT])).toBe(RECT);
    expect(findRectContaining({ x: 9999, y: 0 }, [RECT])).toBeNull();
  });
});

describe('buildRectGrid', () => {
  it('returns sorted xs/ys including center + cover-node edges', () => {
    const g = buildRectGrid(RECT, 'mm', OPTS);
    expect(g.xs).toContain(0);
    expect(g.xs).toContain(2750);
    expect(g.xs).toContain(-2750);
    expect(g.ys).toContain(1750);
  });
});

describe('resolveRectCartesianDims', () => {
  it('produces 4 distinct straight dims = distances to the 4 edges', () => {
    const dims = resolveRectCartesianDims(RECT, { x: 1000, y: 0 });
    expect(dims).toHaveLength(4);
    expect(dims.map((d) => d.valueScene)).toEqual([4000, 2000, 2000, 2000]); // −u/+u/−v/+v
    expect(new Set(dims.map((d) => d.kind)).size).toBe(4); // distinct render slots
  });
});
