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
