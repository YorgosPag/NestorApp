import {
  getPathSamplerStrategy,
  isPathEntity,
  pathTotalLength,
  samplePath,
} from '../path-arc-length-sampler';
import type {
  Entity,
  LineEntity,
  PolylineEntity,
  LWPolylineEntity,
  ArcEntity,
  CircleEntity,
} from '../../../types/entities';

// ── Minimal entity factories ───────────────────────────────────────────────

function line(x1: number, y1: number, x2: number, y2: number): LineEntity {
  return { id: 'l', type: 'line', start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, name: 'l' };
}

function poly(pts: [number, number][], closed = false): PolylineEntity {
  return {
    id: 'p', type: 'polyline', closed,
    vertices: pts.map(([x, y]) => ({ x, y })), name: 'p',
  };
}

function lwpoly(pts: [number, number][], closed = false): LWPolylineEntity {
  return {
    id: 'lp', type: 'lwpolyline', closed,
    vertices: pts.map(([x, y]) => ({ x, y })), name: 'lp',
  };
}

function arc(cx: number, cy: number, r: number, startAngle: number, endAngle: number, ccw = false): ArcEntity {
  return { id: 'a', type: 'arc', center: { x: cx, y: cy }, radius: r, startAngle, endAngle, counterclockwise: ccw, name: 'a' };
}

function circle(cx: number, cy: number, r: number): CircleEntity {
  return { id: 'c', type: 'circle', center: { x: cx, y: cy }, radius: r, name: 'c' };
}

const COS45 = Math.SQRT2 / 2;
const PI = Math.PI;

// ── Dispatcher: getPathSamplerStrategy ────────────────────────────────────

describe('getPathSamplerStrategy', () => {
  it('returns strategy for LINE', () => {
    expect(getPathSamplerStrategy(line(0, 0, 1, 0))).not.toBeNull();
  });

  it('returns strategy for POLYLINE', () => {
    expect(getPathSamplerStrategy(poly([[0, 0], [1, 0]]))).not.toBeNull();
  });

  it('returns strategy for LWPOLYLINE', () => {
    expect(getPathSamplerStrategy(lwpoly([[0, 0], [1, 0]]))).not.toBeNull();
  });

  it('returns strategy for ARC', () => {
    expect(getPathSamplerStrategy(arc(0, 0, 1, 0, 90))).not.toBeNull();
  });

  it('returns strategy for CIRCLE', () => {
    expect(getPathSamplerStrategy(circle(0, 0, 1))).not.toBeNull();
  });

  it('returns null for SPLINE (C2)', () => {
    const spline = { id: 's', type: 'spline', name: 's' } as unknown as Entity;
    expect(getPathSamplerStrategy(spline)).toBeNull();
  });

  it('returns null for ELLIPSE (C2)', () => {
    const ellipse = { id: 'e', type: 'ellipse', name: 'e' } as unknown as Entity;
    expect(getPathSamplerStrategy(ellipse)).toBeNull();
  });

  it('returns null for TEXT', () => {
    const text = { id: 't', type: 'text', name: 't' } as unknown as Entity;
    expect(getPathSamplerStrategy(text)).toBeNull();
  });

  it('returns null for RECTANGLE', () => {
    const rect = { id: 'r', type: 'rectangle', name: 'r' } as unknown as Entity;
    expect(getPathSamplerStrategy(rect)).toBeNull();
  });
});

// ── isPathEntity ──────────────────────────────────────────────────────────

describe('isPathEntity', () => {
  it('true for supported types', () => {
    expect(isPathEntity(line(0, 0, 1, 0))).toBe(true);
    expect(isPathEntity(circle(0, 0, 1))).toBe(true);
  });

  it('false for unsupported types', () => {
    const spline = { id: 's', type: 'spline', name: 's' } as unknown as Entity;
    expect(isPathEntity(spline)).toBe(false);
  });
});

// ── LINE strategy ─────────────────────────────────────────────────────────

describe('LineStrategy', () => {
  it('totalLength: horizontal line 0→10', () => {
    expect(pathTotalLength(line(0, 0, 10, 0))).toBeCloseTo(10);
  });

  it('totalLength: diagonal line', () => {
    expect(pathTotalLength(line(0, 0, 3, 4))).toBeCloseTo(5);
  });

  it('totalLength: degenerate (start=end) → 0', () => {
    expect(pathTotalLength(line(5, 5, 5, 5))).toBe(0);
  });

  it('sample(0.5) → midpoint, tangent 0°', () => {
    const s = samplePath(line(0, 0, 10, 0), 0.5)!;
    expect(s.position.x).toBeCloseTo(5);
    expect(s.position.y).toBeCloseTo(0);
    expect(s.tangentDeg).toBeCloseTo(0);
  });

  it('sample(0) → start', () => {
    const s = samplePath(line(0, 0, 10, 0), 0)!;
    expect(s.position.x).toBeCloseTo(0);
    expect(s.position.y).toBeCloseTo(0);
  });

  it('sample(1) → end', () => {
    const s = samplePath(line(0, 0, 10, 0), 1)!;
    expect(s.position.x).toBeCloseTo(10);
    expect(s.position.y).toBeCloseTo(0);
  });

  it('sample(u < 0) clamped to 0', () => {
    const s = samplePath(line(0, 0, 10, 0), -1)!;
    expect(s.position.x).toBeCloseTo(0);
  });

  it('sample(u > 1) clamped to 1', () => {
    const s = samplePath(line(0, 0, 10, 0), 2)!;
    expect(s.position.x).toBeCloseTo(10);
  });

  it('reversed: tangent flips 180°', () => {
    const fwd = samplePath(line(0, 0, 10, 0), 0.5, false)!;
    const rev = samplePath(line(0, 0, 10, 0), 0.5, true)!;
    expect(fwd.tangentDeg).toBeCloseTo(0);
    expect(rev.tangentDeg).toBeCloseTo(180);
  });

  it('degenerate line: sample returns start, tangent 0', () => {
    const s = samplePath(line(3, 4, 3, 4), 0.5)!;
    expect(s.position.x).toBeCloseTo(3);
    expect(s.position.y).toBeCloseTo(4);
    expect(s.tangentDeg).toBe(0);
  });
});

// ── POLYLINE strategy ─────────────────────────────────────────────────────

describe('PolylineStrategy', () => {
  const v3 = poly([[0, 0], [0, 10], [10, 10]]);

  it('totalLength: L-shape (0,0)→(0,10)→(10,10) = 20', () => {
    expect(pathTotalLength(v3)).toBeCloseTo(20);
  });

  it('sample(0.25) → (0,5), tangent 90°', () => {
    const s = samplePath(v3, 0.25)!;
    expect(s.position.x).toBeCloseTo(0);
    expect(s.position.y).toBeCloseTo(5);
    expect(s.tangentDeg).toBeCloseTo(90);
  });

  it('sample(0.75) → (5,10), tangent 0°', () => {
    const s = samplePath(v3, 0.75)!;
    expect(s.position.x).toBeCloseTo(5);
    expect(s.position.y).toBeCloseTo(10);
    expect(s.tangentDeg).toBeCloseTo(0);
  });

  it('reversed: tangent flips direction', () => {
    const fwd = samplePath(v3, 0.25, false)!;
    const rev = samplePath(v3, 0.75, true)!;
    // Both reach (0,5) but from opposite directions
    expect(fwd.position.y).toBeCloseTo(5);
    expect(rev.position.y).toBeCloseTo(5);
    expect(fwd.tangentDeg).toBeCloseTo(90);
    expect(rev.tangentDeg).toBeCloseTo(-90);
  });

  it('1-vertex polyline: totalLength=0, sample returns that vertex', () => {
    const single = poly([[3, 7]]);
    expect(pathTotalLength(single)).toBe(0);
    const s = samplePath(single, 0.5)!;
    expect(s.position.x).toBeCloseTo(3);
    expect(s.position.y).toBeCloseTo(7);
  });

  it('closed: closing segment included in totalLength', () => {
    const square = poly([[0, 0], [10, 0], [10, 10], [0, 10]], true);
    expect(pathTotalLength(square)).toBeCloseTo(40);
  });

  it('closed: sample(1) ≈ sample(0)', () => {
    const square = poly([[0, 0], [10, 0], [10, 10], [0, 10]], true);
    const s0 = samplePath(square, 0)!;
    const s1 = samplePath(square, 1)!;
    expect(s0.position.x).toBeCloseTo(s1.position.x, 5);
    expect(s0.position.y).toBeCloseTo(s1.position.y, 5);
  });

  it('LWPOLYLINE handled by same strategy', () => {
    const lw = lwpoly([[0, 0], [10, 0]]);
    expect(pathTotalLength(lw)).toBeCloseTo(10);
    const s = samplePath(lw, 0.5)!;
    expect(s.position.x).toBeCloseTo(5);
    expect(s.tangentDeg).toBeCloseTo(0);
  });

  it('u < 0 clamped', () => {
    const s = samplePath(v3, -0.5)!;
    expect(s.position.x).toBeCloseTo(0);
    expect(s.position.y).toBeCloseTo(0);
  });

  it('u > 1 clamped', () => {
    const s = samplePath(v3, 1.5)!;
    expect(s.position.x).toBeCloseTo(10);
    expect(s.position.y).toBeCloseTo(10);
  });
});

// ── ARC strategy ──────────────────────────────────────────────────────────

describe('ArcStrategy', () => {
  // 0°→90° CCW, radius=1, center=(0,0)
  const a90ccw = arc(0, 0, 1, 0, 90, true);

  it('totalLength: 90° arc r=1 = π/2', () => {
    expect(pathTotalLength(a90ccw)).toBeCloseTo(PI / 2);
  });

  it('sample(0.5) → (cos45°, sin45°), tangent 135°', () => {
    const s = samplePath(a90ccw, 0.5)!;
    expect(s.position.x).toBeCloseTo(COS45);
    expect(s.position.y).toBeCloseTo(COS45);
    expect(s.tangentDeg).toBeCloseTo(135);
  });

  it('sample(0) → start point (1,0)', () => {
    const s = samplePath(a90ccw, 0)!;
    expect(s.position.x).toBeCloseTo(1);
    expect(s.position.y).toBeCloseTo(0);
  });

  it('sample(1) → end point (0,1)', () => {
    const s = samplePath(a90ccw, 1)!;
    expect(s.position.x).toBeCloseTo(0);
    expect(s.position.y).toBeCloseTo(1);
  });

  it('reversed: traverses from end→start (tangent flips)', () => {
    const fwd = samplePath(a90ccw, 0.5, false)!;
    const rev = samplePath(a90ccw, 0.5, true)!;
    expect(fwd.position.x).toBeCloseTo(COS45);
    expect(fwd.position.y).toBeCloseTo(COS45);
    expect(rev.position.x).toBeCloseTo(COS45);
    expect(rev.position.y).toBeCloseTo(COS45);
    // Tangent flips: fwd=135°, rev=135-180=−45°
    expect(rev.tangentDeg).toBeCloseTo(-45);
  });

  it('CW arc 0°→90° (counterclockwise=false): sweep=270° (long way CW)', () => {
    // CW from 0° to 90° goes the long way: 0°→350°→...→90° = 270° sweep
    const cw = arc(0, 0, 1, 0, 90, false);
    expect(pathTotalLength(cw)).toBeCloseTo((3 * PI) / 2);
  });

  it('degenerate arc (sweep=0): totalLength=0', () => {
    const degen = arc(0, 0, 1, 45, 45, true);
    expect(pathTotalLength(degen)).toBeCloseTo(0);
  });

  it('radius=0 degenerate: sample returns center', () => {
    const zero = arc(5, 3, 0, 0, 90, true);
    const s = samplePath(zero, 0.5)!;
    expect(s.position.x).toBeCloseTo(5);
    expect(s.position.y).toBeCloseTo(3);
  });

  it('u < 0 clamped', () => {
    const s = samplePath(a90ccw, -1)!;
    expect(s.position.x).toBeCloseTo(1);
    expect(s.position.y).toBeCloseTo(0);
  });

  it('u > 1 clamped', () => {
    const s = samplePath(a90ccw, 2)!;
    expect(s.position.x).toBeCloseTo(0);
    expect(s.position.y).toBeCloseTo(1);
  });
});

// ── CIRCLE strategy ───────────────────────────────────────────────────────

describe('CircleStrategy', () => {
  const c1 = circle(0, 0, 1);

  it('totalLength: r=1 → 2π', () => {
    expect(pathTotalLength(c1)).toBeCloseTo(2 * PI);
  });

  it('sample(0) → (1,0), tangent 90°', () => {
    const s = samplePath(c1, 0)!;
    expect(s.position.x).toBeCloseTo(1);
    expect(s.position.y).toBeCloseTo(0);
    expect(s.tangentDeg).toBeCloseTo(90);
  });

  it('sample(1) position ≈ sample(0) — closed path continuity', () => {
    const s0 = samplePath(c1, 0)!;
    const s1 = samplePath(c1, 1)!;
    expect(s1.position.x).toBeCloseTo(s0.position.x, 10);
    expect(s1.position.y).toBeCloseTo(s0.position.y, 10);
  });

  it('sample(0.25) → (0,1), tangent 180°', () => {
    const s = samplePath(c1, 0.25)!;
    expect(s.position.x).toBeCloseTo(0);
    expect(s.position.y).toBeCloseTo(1);
    expect(s.tangentDeg).toBeCloseTo(180);
  });

  it('reversed: sample(0) tangent −90° (CW direction)', () => {
    const s = samplePath(c1, 0, true)!;
    expect(s.position.x).toBeCloseTo(1);
    expect(s.position.y).toBeCloseTo(0);
    expect(s.tangentDeg).toBeCloseTo(-90);
  });

  it('radius=0 degenerate: returns center, tangent 0', () => {
    const zero = circle(3, 4, 0);
    const s = samplePath(zero, 0.5)!;
    expect(s.position.x).toBeCloseTo(3);
    expect(s.position.y).toBeCloseTo(4);
    expect(s.tangentDeg).toBe(0);
  });

  it('u < 0 clamped', () => {
    const s = samplePath(c1, -1)!;
    expect(s.position.x).toBeCloseTo(1);
  });

  it('u > 1 clamped', () => {
    const s = samplePath(c1, 2)!;
    expect(s.position.x).toBeCloseTo(1);
  });
});

// ── samplePath null for unsupported ──────────────────────────────────────

describe('samplePath null for unsupported types', () => {
  it('returns null for SPLINE', () => {
    const spline = { id: 's', type: 'spline', name: 's' } as unknown as Entity;
    expect(samplePath(spline, 0.5)).toBeNull();
  });

  it('pathTotalLength returns 0 for unsupported', () => {
    const spline = { id: 's', type: 'spline', name: 's' } as unknown as Entity;
    expect(pathTotalLength(spline)).toBe(0);
  });
});
