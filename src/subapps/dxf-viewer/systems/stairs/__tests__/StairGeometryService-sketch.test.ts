/**
 * ADR-358 Phase 4c — `StairGeometryService` sketch tests.
 *
 * Geometry parameterization (canonical mm):
 *   - walklinePath = [(0,0,0),(1000,0,0),(1000,1000,0),(2000,1000,0)] (4 vertices)
 *   - stepCount = 3 → walklinePath.length === stepCount + 1 ✓
 *   - rise = 600 → totalRise = 1800 (exceeds default cut plane 1200 at i=2)
 *
 * @see ../StairGeometryService.ts
 * @see ../stair-geometry-sketch.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  Point3D,
  Polygon3D,
  StairParams,
  StairTreadLabelDisplay,
  StairVariantSketch,
} from '../../../types/stair';

const Z_TOL = 1e-9;
const XY_TOL = 1e-6;

function makeSketchParams(overrides?: {
  walklinePath?: readonly Point3D[];
  stepCount?: number;
  rise?: number;
  width?: number;
  cutPlaneHeight?: number;
  treadLabelDisplay?: StairTreadLabelDisplay;
}): StairParams {
  const walklinePath: readonly Point3D[] = overrides?.walklinePath ?? [
    { x: 0, y: 0, z: 99 }, // z=99 → must be overridden to 0
    { x: 1000, y: 0, z: 99 },
    { x: 1000, y: 1000, z: 99 },
    { x: 2000, y: 1000, z: 99 },
  ];
  const stepCount = overrides?.stepCount ?? walklinePath.length - 1;
  const rise = overrides?.rise ?? 600;
  const variant: StairVariantSketch = { kind: 'sketch', walklinePath };
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: 0,
    rise,
    tread: 250,
    nosing: 0,
    nosingSide: 'none',
    width: overrides?.width ?? 800,
    stepCount,
    totalRise: rise * stepCount,
    totalRun: 0,
    pitch: 30,
    structureType: 'monolithic',
    riserType: 'closed',
    antiskidNosing: false,
    adaContrastStrip: false,
    cutPlaneHeight: overrides?.cutPlaneHeight,
    variant,
    walklineOffset: 300,
    handrails: { inner: false, outer: false, height: 900 },
    upDirection: 'forward',
    treadNumberStart: 1,
    treadLabelDisplay: overrides?.treadLabelDisplay ?? 'none',
    treadLabelRestartPerFlight: false,
    codeProfile: 'none',
  };
}

function allTreads(g: ReturnType<typeof computeStairGeometry>): readonly Polygon3D[] {
  return [...g.treadsBelowCut, ...g.treadsAboveCut];
}

describe('StairGeometryService — sketch', () => {
  it('Test 1: stepCount=3 with 4-vertex walklinePath → 3 treads', () => {
    const g = computeStairGeometry(makeSketchParams());
    expect(allTreads(g)).toHaveLength(3);
    expect(g.walkline).toHaveLength(4);
  });

  it('Test 2: walklinePath length ≠ stepCount+1 → throws', () => {
    expect(() =>
      computeStairGeometry(makeSketchParams({ stepCount: 5 })),
    ).toThrow(/sketch walklinePath length must equal stepCount\+1/);
  });

  it('Test 3: treads extend ±halfW·perp(chord-tangent) around walkline', () => {
    const g = computeStairGeometry(makeSketchParams());
    const treads = allTreads(g);
    // Segment 0: chord = (0,0)→(1000,0), tangent=(1,0), perp=(0,1), halfW=400.
    // innerA = (0, -400, 0), outerA = (0, +400, 0)
    expect(treads[0][0].x).toBeCloseTo(0, 6);
    expect(treads[0][0].y).toBeCloseTo(-400, 6);
    expect(treads[0][1].x).toBeCloseTo(0, 6);
    expect(treads[0][1].y).toBeCloseTo(400, 6);
    // Segment 1: chord = (1000,0)→(1000,1000), tangent=(0,1), perp=(-1,0), halfW=400.
    // innerA at walkline[1] = (1000+400, 0) = (1400, 0)
    expect(treads[1][0].x).toBeCloseTo(1400, 6);
    expect(treads[1][0].y).toBeCloseTo(0, 6);
  });

  it('Test 4: z = i·rise overrides input z values', () => {
    const g = computeStairGeometry(makeSketchParams());
    const rise = 600;
    for (let i = 0; i < g.walkline.length; i++) {
      expect(Math.abs(g.walkline[i].z - rise * i)).toBeLessThan(Z_TOL);
    }
    const treads = allTreads(g);
    for (let i = 0; i < treads.length; i++) {
      for (const v of treads[i]) expect(Math.abs(v.z - rise * i)).toBeLessThan(Z_TOL);
    }
  });

  it('Test 5: cutLine emitted when totalRise > cutPlaneHeight, undefined when below', () => {
    const high = computeStairGeometry(makeSketchParams()); // 1800 > 1200
    expect(high.cutLine).toBeDefined();
    const low = computeStairGeometry(makeSketchParams({ rise: 100 })); // totalRise=300
    expect(low.cutLine).toBeUndefined();
  });

  it('Test 6: stringers via offsetPolyline — inner/outer present, length = walkline length', () => {
    const g = computeStairGeometry(makeSketchParams());
    expect(g.stringers.inner.length).toBe(g.walkline.length);
    expect(g.stringers.outer.length).toBe(g.walkline.length);
  });

  it('Test 7: arrow runs from walkline[0] to walkline[last]', () => {
    const g = computeStairGeometry(makeSketchParams());
    expect(g.arrowSymbol.label).toBe('UP');
    expect(g.arrowSymbol.start.x).toBeCloseTo(g.walkline[0].x, 6);
    expect(g.arrowSymbol.start.y).toBeCloseTo(g.walkline[0].y, 6);
    expect(g.arrowSymbol.end.x).toBeCloseTo(g.walkline[g.walkline.length - 1].x, 6);
    expect(g.arrowSymbol.end.y).toBeCloseTo(g.walkline[g.walkline.length - 1].y, 6);
  });

  it("Test 8: treadLabels 'all' → stepCount labels at tread centroids", () => {
    const g = computeStairGeometry(makeSketchParams({ treadLabelDisplay: 'all' }));
    const treads = allTreads(g);
    const labels = g.treadLabels ?? [];
    expect(labels).toHaveLength(3);
    for (let i = 0; i < labels.length; i++) {
      const t = treads[i];
      const cx = (t[0].x + t[1].x + t[2].x + t[3].x) / 4;
      const cy = (t[0].y + t[1].y + t[2].y + t[3].y) / 4;
      expect(labels[i].position.x).toBeCloseTo(cx, 6);
      expect(labels[i].position.y).toBeCloseTo(cy, 6);
      expect(Math.abs(labels[i].position.x - cx)).toBeLessThan(XY_TOL);
    }
  });
});
