/**
 * ADR-358 Phase 3a — `StairGeometryService` L-shape tests.
 *
 * Parameterization (canonical mm, +X/+Y math frame):
 *   - stepCount=10, flightSplit=[5,5], turnRight by default
 *   - rise=175, tread=280, nosing=25, width=1000
 *   - basePoint=(0,0,0), direction=0° (+X), upDirection='forward'
 *
 * The L-shape z-model places the landing at z = n1·rise; flight 2 treads at
 * z = (n1+1+i)·rise (last tread at stepCount·rise — top floor level). This
 * differs from the straight convention by one rise — see prompt + Test 5.
 *
 * Tolerance: 1e-6 for xy, 1e-9 for z.
 *
 * @see ../StairGeometryService.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  StairParams,
  StairVariantLShape,
  Polygon3D,
  StairTurnDirectionLR,
  StairLandingCornerStyle,
} from '../../../types/stair';

const COORD_TOL = 1e-6;
const Z_TOL = 1e-9;

function makeLShapeParams(overrides?: {
  flightSplit?: readonly [number, number];
  turnDirection?: StairTurnDirectionLR;
  landingDepth?: 'auto' | number;
  landingCornerStyle?: StairLandingCornerStyle;
  rise?: number;
  tread?: number;
  width?: number;
  nosing?: number;
  direction?: number;
}): StairParams {
  const flightSplit = overrides?.flightSplit ?? ([5, 5] as const);
  const stepCount = flightSplit[0] + flightSplit[1];
  const rise = overrides?.rise ?? 175;
  const tread = overrides?.tread ?? 280;
  const variant: StairVariantLShape = {
    kind: 'l-shape',
    turnDirection: overrides?.turnDirection ?? 'right',
    landingDepth: overrides?.landingDepth ?? 'auto',
    landingCornerStyle: overrides?.landingCornerStyle,
    flightSplit,
  };
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: overrides?.direction ?? 0,
    rise,
    tread,
    nosing: overrides?.nosing ?? 25,
    nosingSide: 'front',
    width: overrides?.width ?? 1000,
    stepCount,
    totalRise: rise * stepCount,
    totalRun: tread * Math.max(stepCount - 1, 0),
    pitch: 30,
    structureType: 'monolithic',
    riserType: 'closed',
    antiskidNosing: false,
    adaContrastStrip: false,
    variant,
    walklineOffset: 300,
    handrails: { inner: false, outer: false, height: 900 },
    upDirection: 'forward',
    treadNumberStart: 1,
    treadLabelDisplay: 'none',
    treadLabelRestartPerFlight: false,
    codeProfile: 'none',
  };
}

function centroidXY(poly: Polygon3D): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  for (const p of poly) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / poly.length, y: sy / poly.length };
}

function polygonAreaXY(polygon: Polygon3D): number {
  let sum = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) * 0.5;
}

describe('StairGeometryService — L-shape', () => {
  it('Test 1: stepCount=10, flightSplit=[5,5], turnRight → 10 treads + 1 landing', () => {
    const g = computeStairGeometry(makeLShapeParams());
    const total = g.treadsBelowCut.length + g.treadsAboveCut.length;
    expect(total).toBe(10);
    expect(g.landings).toHaveLength(1);
  });

  it("Test 2: flight 2 direction = flight 1 − 90° for 'right', + 90° for 'left'", () => {
    const right = computeStairGeometry(makeLShapeParams({ turnDirection: 'right' }));
    const left = computeStairGeometry(makeLShapeParams({ turnDirection: 'left' }));
    // Direction 0° → u1=(1,0). Flight 2 first 2 treads should advance along u2.
    // turnRight: u2 = (0, -1) → Δy < 0. turnLeft: u2 = (0, +1) → Δy > 0.
    const rightTreads: readonly Polygon3D[] = [...right.treadsBelowCut, ...right.treadsAboveCut];
    const leftTreads: readonly Polygon3D[] = [...left.treadsBelowCut, ...left.treadsAboveCut];
    const r0 = centroidXY(rightTreads[5]);
    const r1 = centroidXY(rightTreads[6]);
    expect(r1.y - r0.y).toBeCloseTo(-280, 6);
    expect(Math.abs(r1.x - r0.x)).toBeLessThan(COORD_TOL);
    const l0 = centroidXY(leftTreads[5]);
    const l1 = centroidXY(leftTreads[6]);
    expect(l1.y - l0.y).toBeCloseTo(280, 6);
    expect(Math.abs(l1.x - l0.x)).toBeLessThan(COORD_TOL);
  });

  it('Test 3: landing is a width × width square when landingDepth=auto', () => {
    const g = computeStairGeometry(makeLShapeParams());
    const landing = g.landings[0];
    expect(polygonAreaXY(landing)).toBeCloseTo(1000 * 1000, 3);
  });

  it('Test 4: landing z = rise · n1', () => {
    const g = computeStairGeometry(makeLShapeParams());
    const landing = g.landings[0];
    for (const v of landing) {
      expect(Math.abs(v.z - 175 * 5)).toBeLessThan(Z_TOL);
    }
  });

  it('Test 5: flight 2 z range = [rise·(n1+1), rise·stepCount]', () => {
    const g = computeStairGeometry(makeLShapeParams());
    const allTreads: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
    const flight2 = allTreads.slice(5); // n1 = 5
    expect(flight2).toHaveLength(5);
    const zs = flight2.map(t => t[0].z);
    expect(zs[0]).toBeCloseTo(175 * 6, 9);
    expect(zs[4]).toBeCloseTo(175 * 10, 9);
    for (let i = 0; i < zs.length; i++) {
      expect(zs[i]).toBeCloseTo(175 * (6 + i), 9);
    }
  });

  it('Test 6: walkline has 4 vertices spanning start → L-corner → flight 2 end', () => {
    const g = computeStairGeometry(makeLShapeParams());
    expect(g.walkline).toHaveLength(4);
    // v3 is the L corner: (n1·tread + halfW, 0, n1·rise) = (1900, 0, 875) for our params.
    expect(g.walkline[2].x).toBeCloseTo(1900, 6);
    expect(g.walkline[2].y).toBeCloseTo(0, 6);
    expect(g.walkline[2].z).toBeCloseTo(875, 9);
  });

  it('Test 7: stringers have 4 vertices each; outer miter = d·√2 at the L corner', () => {
    const g = computeStairGeometry(makeLShapeParams());
    const outer = g.stringers.outer;
    const inner = g.stringers.inner;
    expect(outer).toHaveLength(4);
    expect(inner).toHaveLength(4);
    const pivot = g.walkline[2];
    const expectedDistance = 500 * Math.sqrt(2);
    const outerMiter = outer[2];
    const innerMiter = inner[2];
    const dOuter = Math.hypot(outerMiter.x - pivot.x, outerMiter.y - pivot.y);
    const dInner = Math.hypot(innerMiter.x - pivot.x, innerMiter.y - pivot.y);
    expect(dOuter).toBeCloseTo(expectedDistance, 6);
    expect(dInner).toBeCloseTo(expectedDistance, 6);
  });

  it('Test 8: landingDepth=1500 number override → landing area = width × 1500', () => {
    const g = computeStairGeometry(makeLShapeParams({ landingDepth: 1500 }));
    expect(polygonAreaXY(g.landings[0])).toBeCloseTo(1000 * 1500, 3);
  });

  it('Test 9: turnLeft mirrors turnRight across the flight-1 axis (y=0)', () => {
    const right = computeStairGeometry(makeLShapeParams({ turnDirection: 'right' }));
    const left = computeStairGeometry(makeLShapeParams({ turnDirection: 'left' }));
    const rightTreads: readonly Polygon3D[] = [...right.treadsBelowCut, ...right.treadsAboveCut];
    const leftTreads: readonly Polygon3D[] = [...left.treadsBelowCut, ...left.treadsAboveCut];
    for (let i = 0; i < 10; i++) {
      const rc = centroidXY(rightTreads[i]);
      const lc = centroidXY(leftTreads[i]);
      expect(lc.x).toBeCloseTo(rc.x, 6);
      expect(lc.y).toBeCloseTo(-rc.y, 6);
    }
  });

  it('Test 10: arrowSymbol.end matches last walkline vertex (flight 2 end)', () => {
    const g = computeStairGeometry(makeLShapeParams());
    const last = g.walkline[g.walkline.length - 1];
    expect(g.arrowSymbol.end.x).toBeCloseTo(last.x, 6);
    expect(g.arrowSymbol.end.y).toBeCloseTo(last.y, 6);
    expect(g.arrowSymbol.end.z).toBeCloseTo(last.z, 9);
    expect(g.arrowSymbol.label).toBe('UP');
  });

  it("Test 11: landingCornerStyle='chamfer' throws (Phase 3c feature)", () => {
    expect(() => computeStairGeometry(makeLShapeParams({ landingCornerStyle: 'chamfer' }))).toThrow(
      /Phase 3c/,
    );
    expect(() => computeStairGeometry(makeLShapeParams({ landingCornerStyle: 'fillet' }))).toThrow(
      /Phase 3c/,
    );
  });
});
