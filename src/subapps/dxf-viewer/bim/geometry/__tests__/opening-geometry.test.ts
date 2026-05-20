/**
 * ADR-363 Phase 2 — `computeOpeningGeometry` + `projectPointToWallOffset` tests.
 *
 * Coverage:
 *   - Outline rectangle (4 vertices, mm world coords)
 *   - Center positioning along host wall axis (offsetFromStart + width/2)
 *   - Rotation matches host axis direction (horizontal / vertical / 45°)
 *   - Bbox folds outline vertices
 *   - Area in m² (mm² → m² conversion)
 *   - Perimeter in m
 *   - Hinge arc present for door / french-door; absent for window / fixed / sliding
 *   - French-door arc roughly twice the vertex count of a single-leaf door arc
 *   - `projectPointToWallOffset` clamps below 0 / above wall length
 *   - `projectPointToWallOffset` returns the axis-projected scalar for valid points
 */

import { computeOpeningGeometry, projectPointToWallOffset } from '../opening-geometry';
import { computeWallGeometry } from '../wall-geometry';
import type { WallEntity, WallParams } from '../../types/wall-types';
import type { OpeningParams } from '../../types/opening-types';

const EDGE_TOL = 1e-6;
const FLOAT_TOL = 1e-9;

function makeWall(overrides?: Partial<WallParams>): WallEntity {
  const params: WallParams = {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 5000, y: 0, z: 0 },
    height: 3000,
    thickness: 250,
    flip: false,
    ...overrides,
  };
  return {
    id: 'wall_test',
    type: 'wall',
    kind: 'straight',
    layerId: '0',
    params,
    geometry: computeWallGeometry(params, 'straight'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as WallEntity;
}

function makeOpening(overrides?: Partial<OpeningParams>): OpeningParams {
  return {
    kind: 'door',
    wallId: 'wall_test',
    offsetFromStart: 1000,
    width: 900,
    height: 2100,
    sillHeight: 0,
    handing: 'left',
    openDirection: 'inward',
    ...overrides,
  };
}

describe('computeOpeningGeometry — outline', () => {
  it('produces a 4-vertex rectangle outline', () => {
    const g = computeOpeningGeometry(makeOpening(), makeWall());
    expect(g.outline.vertices).toHaveLength(4);
  });

  it('centers the outline on offsetFromStart + width/2 for a horizontal wall', () => {
    // offset 1000 + width 900 / 2 = 1450 along +X.
    const g = computeOpeningGeometry(makeOpening(), makeWall());
    expect(g.position.x).toBeCloseTo(1450, EDGE_TOL);
    expect(g.position.y).toBeCloseTo(0, EDGE_TOL);
  });

  it('produces rotation = 0 for a horizontal east-pointing wall', () => {
    const g = computeOpeningGeometry(makeOpening(), makeWall());
    expect(g.rotation).toBeCloseTo(0, EDGE_TOL);
  });

  it('produces rotation = PI/2 for a vertical north-pointing wall', () => {
    const vertical = makeWall({ end: { x: 0, y: 5000, z: 0 } });
    const g = computeOpeningGeometry(makeOpening(), vertical);
    expect(g.rotation).toBeCloseTo(Math.PI / 2, EDGE_TOL);
  });
});

describe('computeOpeningGeometry — scalars', () => {
  it('computes area in m² (width × height / 1e6)', () => {
    const g = computeOpeningGeometry(makeOpening({ width: 1200, height: 1400 }), makeWall());
    expect(g.area).toBeCloseTo((1200 * 1400) / 1e6, FLOAT_TOL); // 1.68 m²
  });

  it('computes perimeter in m (2 × (w + h) / 1000)', () => {
    const g = computeOpeningGeometry(makeOpening({ width: 900, height: 2100 }), makeWall());
    expect(g.perimeter).toBeCloseTo((2 * (900 + 2100)) / 1000, FLOAT_TOL); // 6.0 m
  });

  it('bbox folds all outline vertices', () => {
    const g = computeOpeningGeometry(makeOpening(), makeWall());
    const xs = g.outline.vertices.map((v) => v.x);
    const ys = g.outline.vertices.map((v) => v.y);
    expect(g.bbox.min.x).toBeCloseTo(Math.min(...xs), EDGE_TOL);
    expect(g.bbox.max.x).toBeCloseTo(Math.max(...xs), EDGE_TOL);
    expect(g.bbox.min.y).toBeCloseTo(Math.min(...ys), EDGE_TOL);
    expect(g.bbox.max.y).toBeCloseTo(Math.max(...ys), EDGE_TOL);
  });

  it('bbox z in metres: door sillHeight=0, height=2100mm → [0, 2.1] (ADR-369 Phase B)', () => {
    const g = computeOpeningGeometry(makeOpening({ kind: 'door', sillHeight: 0, height: 2100 }), makeWall());
    expect(g.bbox.min.z).toBeCloseTo(0, FLOAT_TOL);
    expect(g.bbox.max.z).toBeCloseTo(2.1, FLOAT_TOL);
  });

  it('bbox z in metres: window sillHeight=900mm, height=1400mm → [0.9, 2.3]', () => {
    const g = computeOpeningGeometry(
      makeOpening({ kind: 'window', sillHeight: 900, height: 1400 }),
      makeWall(),
    );
    expect(g.bbox.min.z).toBeCloseTo(0.9, FLOAT_TOL);
    expect(g.bbox.max.z).toBeCloseTo(2.3, FLOAT_TOL);
  });
});

describe('computeOpeningGeometry — hinge arc', () => {
  it('produces a hingeArc for a door', () => {
    const g = computeOpeningGeometry(makeOpening({ kind: 'door' }), makeWall());
    expect(g.hingeArc).toBeDefined();
    expect(g.hingeArc!.points.length).toBeGreaterThan(1);
  });

  it('omits hingeArc for a window', () => {
    const g = computeOpeningGeometry(
      makeOpening({ kind: 'window', sillHeight: 900, height: 1400 }),
      makeWall(),
    );
    expect(g.hingeArc).toBeUndefined();
  });

  it('omits hingeArc for a fixed glazing', () => {
    const g = computeOpeningGeometry(makeOpening({ kind: 'fixed' }), makeWall());
    expect(g.hingeArc).toBeUndefined();
  });

  it('omits hingeArc for a sliding-door', () => {
    const g = computeOpeningGeometry(makeOpening({ kind: 'sliding-door' }), makeWall());
    expect(g.hingeArc).toBeUndefined();
  });

  it('produces ~twice as many arc points for a french-door (dual leaf)', () => {
    const door = computeOpeningGeometry(makeOpening({ kind: 'door' }), makeWall());
    const french = computeOpeningGeometry(makeOpening({ kind: 'french-door' }), makeWall());
    expect(french.hingeArc!.points.length).toBeGreaterThan(door.hingeArc!.points.length);
  });
});

describe('projectPointToWallOffset', () => {
  it('returns 0 for a point before the wall start', () => {
    const wall = makeWall();
    expect(projectPointToWallOffset({ x: -500, y: 0 }, wall)).toBe(0);
  });

  it('returns wall length for a point past the wall end', () => {
    const wall = makeWall();
    expect(projectPointToWallOffset({ x: 9000, y: 0 }, wall)).toBeCloseTo(5000, EDGE_TOL);
  });

  it('returns the axis-projected scalar for a valid in-bounds point', () => {
    const wall = makeWall();
    expect(projectPointToWallOffset({ x: 2500, y: 200 }, wall)).toBeCloseTo(2500, EDGE_TOL);
  });
});

// ─── Phase 2 leftover — polyline + curved host walls ─────────────────────────

function makePolylineWall(): WallEntity {
  // L-shaped wall: (0,0)→(1000,0)→(1000,2000), total arc 3000 mm.
  const params: WallParams = {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 1000, y: 2000, z: 0 },
    height: 3000,
    thickness: 200,
    flip: false,
    polylineVertices: [
      { x: 0, y: 0, z: 0 },
      { x: 1000, y: 0, z: 0 },
      { x: 1000, y: 2000, z: 0 },
    ],
  };
  return {
    id: 'wall_poly',
    type: 'wall',
    kind: 'polyline',
    layerId: '0',
    params,
    geometry: computeWallGeometry(params, 'polyline'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as WallEntity;
}

function makeCurvedWall(): WallEntity {
  // Curved wall: start=(0,0), end=(2000,0), control=(1000,800).
  const params: WallParams = {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 2000, y: 0, z: 0 },
    height: 3000,
    thickness: 200,
    flip: false,
    curveControl: { x: 1000, y: 800, z: 0 },
  };
  return {
    id: 'wall_curved',
    type: 'wall',
    kind: 'curved',
    layerId: '0',
    params,
    geometry: computeWallGeometry(params, 'curved'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as WallEntity;
}

describe('computeOpeningGeometry — polyline wall', () => {
  it('positions opening on the second segment (past the first corner)', () => {
    const wall = makePolylineWall();
    // offset=1200 + width/2=450 = 1650 mm arc. First segment=1000mm → remaining 650mm on second (north).
    // Position should be (1000, 650).
    const g = computeOpeningGeometry(
      makeOpening({ wallId: 'wall_poly', offsetFromStart: 1200, width: 900 }),
      wall,
    );
    expect(g.position.x).toBeCloseTo(1000, 0);
    expect(g.position.y).toBeCloseTo(650, 0);
  });

  it('rotation is π/2 for opening on the north-pointing segment', () => {
    const wall = makePolylineWall();
    const g = computeOpeningGeometry(
      makeOpening({ wallId: 'wall_poly', offsetFromStart: 1200, width: 900 }),
      wall,
    );
    expect(g.rotation).toBeCloseTo(Math.PI / 2, 5);
  });

  it('rotation is 0 for opening on the east-pointing segment', () => {
    const wall = makePolylineWall();
    // offset=100 + width/2=450 = 550 mm — within first segment (1000mm east).
    const g = computeOpeningGeometry(
      makeOpening({ wallId: 'wall_poly', offsetFromStart: 100, width: 900 }),
      wall,
    );
    expect(g.rotation).toBeCloseTo(0, 5);
  });
});

describe('projectPointToWallOffset — polyline wall', () => {
  it('returns arc offset on the second segment', () => {
    const wall = makePolylineWall();
    // Point (1000, 800) is on the second segment at arc offset 1000+800=1800.
    expect(projectPointToWallOffset({ x: 1000, y: 800 }, wall)).toBeCloseTo(1800, 0);
  });

  it('returns 0 for a point before the polyline start', () => {
    const wall = makePolylineWall();
    expect(projectPointToWallOffset({ x: -300, y: 0 }, wall)).toBe(0);
  });

  it('returns arc length for a point past the end', () => {
    const wall = makePolylineWall();
    // Total arc = 3000. Point far past end.
    expect(projectPointToWallOffset({ x: 1000, y: 3000 }, wall)).toBeCloseTo(3000, 0);
  });
});

describe('computeOpeningGeometry — curved wall', () => {
  it('position is NOT at the chord midpoint for a curved wall', () => {
    const wall = makeCurvedWall();
    // Straight chord midpoint at arc offset 500+450=950 would be (950,0).
    // Curved arc midpoint is different (near the Bezier apex).
    const g = computeOpeningGeometry(
      makeOpening({ wallId: 'wall_curved', offsetFromStart: 500, width: 900 }),
      wall,
    );
    // Curved wall bows north — y must be > 0 near midpoint.
    expect(g.position.y).toBeGreaterThan(0);
  });
});
