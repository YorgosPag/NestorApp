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

import {
  computeOpeningGeometry,
  projectPointToWallOffset,
  projectPointToWallOffsetMm,
  structuralRevealHeightRangeMm,
} from '../opening-geometry';
import { computeWallGeometry } from '../wall-geometry';
import { selfOpeningHost } from '../opening-host';
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
    flip: false, baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
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
  } as unknown as WallEntity;
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

describe('computeOpeningGeometry — outline projects onto actual wall edges (mitered/slanted)', () => {
  // Straight wall με miters που κάνουν την OUTER ακμή ΛΟΞΗ ως προς τον άξονα.
  const miteredWall = (): WallEntity => makeWall({
    thickness: 200,
    startMiter: { outer: { x: -300, y: 350 }, inner: { x: 80, y: -100 } },
    endMiter: { outer: { x: 5000, y: 100 }, inner: { x: 5000, y: -100 } },
  } as Partial<WallParams>);
  const miteredOpening = () => makeOpening({ kind: 'window', width: 1000, offsetFromStart: 2000, sillHeight: 900 });
  const yOnLine = (p0: { x: number; y: number }, p1: { x: number; y: number }, x: number) =>
    p0.y + (p1.y - p0.y) * ((x - p0.x) / (p1.x - p0.x));

  it('reaches the slanted outer/inner edges (μηδέν τραπεζοειδές υπόλειμμα)', () => {
    const wall = miteredWall();
    const outer = wall.geometry.outerEdge.points;
    const inner = wall.geometry.innerEdge.points;
    const v = computeOpeningGeometry(miteredOpening(), wall).outline.vertices;
    // Σειρά: v0,v1 = inner side· v2,v3 = outer side. Κάθε κορυφή ΠΑΝΩ στην ακμή.
    expect(v[0].y).toBeCloseTo(yOnLine(inner[0], inner[1], v[0].x), 4);
    expect(v[1].y).toBeCloseTo(yOnLine(inner[0], inner[1], v[1].x), 4);
    expect(v[2].y).toBeCloseTo(yOnLine(outer[0], outer[1], v[2].x), 4);
    expect(v[3].y).toBeCloseTo(yOnLine(outer[0], outer[1], v[3].x), 4);
    // Επιβεβαίωση ότι ΟΝΤΩΣ έφτασε τη λοξή ακμή (όχι το παλιό halfT=100).
    expect(v[3].y).toBeGreaterThan(200);
  });

  it('jamb faces μένουν κάθετες στον άξονα (ίδιο x ανά παρειά, horizontal wall)', () => {
    const v = computeOpeningGeometry(miteredOpening(), miteredWall()).outline.vertices;
    expect(v[0].x).toBeCloseTo(v[3].x, 4); // start jamb: inner & outer ίδιο x
    expect(v[1].x).toBeCloseTo(v[2].x, 4); // end jamb
  });
});

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

  it('bbox folds all outline vertices (window — no arc)', () => {
    // Use window kind (no hingeArc) so bbox covers exactly the outline rectangle.
    const g = computeOpeningGeometry(makeOpening({ kind: 'window' }), makeWall());
    const xs = g.outline.vertices.map((v) => v.x);
    const ys = g.outline.vertices.map((v) => v.y);
    expect(g.bbox.min.x).toBeCloseTo(Math.min(...xs), EDGE_TOL);
    expect(g.bbox.max.x).toBeCloseTo(Math.max(...xs), EDGE_TOL);
    expect(g.bbox.min.y).toBeCloseTo(Math.min(...ys), EDGE_TOL);
    expect(g.bbox.max.y).toBeCloseTo(Math.max(...ys), EDGE_TOL);
  });

  it('bbox for door expands beyond outline to include hingeArc tip (Bug 4 spatial pre-filter)', () => {
    // Horizontal wall, door handing=left inward: arc swings upward (+Y).
    // arc.points[12] = (1000, 900) — well outside outline y: -125..125.
    // bbox.max.y must cover the arc tip so spatial pre-filter includes the entity
    // when cursor is over leaf line / swing arc (not just the outline rectangle).
    const g = computeOpeningGeometry(makeOpening({ kind: 'door', handing: 'left', openDirection: 'inward' }), makeWall());
    const outlineMaxY = Math.max(...g.outline.vertices.map((v) => v.y));
    expect(g.bbox.max.y).toBeGreaterThan(outlineMaxY + 100);
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

describe('projectPointToWallOffsetMm (SSoT scene-units → mm)', () => {
  it('mm scene → same scalar as the raw scene-unit projection', () => {
    const wall = makeWall(); // sceneUnits undefined → 'mm' → factor 1
    expect(projectPointToWallOffsetMm({ x: 2500, y: 0 }, wall)).toBeCloseTo(2500, EDGE_TOL);
  });

  it('metres scene → converts scene-units to mm (the drag/creation bug guard)', () => {
    // 5m wall whose coords are in METRES (sceneUnits='m'): a point at 2.5m must
    // resolve to 2500mm, not 2.5 (which would clamp every opening to a boundary).
    const wall = makeWall({
      start: { x: 0, y: 0, z: 0 },
      end: { x: 5, y: 0, z: 0 },
      sceneUnits: 'm',
    } as Partial<WallParams>);
    expect(projectPointToWallOffsetMm({ x: 2.5, y: 0 }, wall)).toBeCloseTo(2500, 0);
    expect(projectPointToWallOffset({ x: 2.5, y: 0 }, wall)).toBeCloseTo(2.5, EDGE_TOL); // raw = scene-units
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
    flip: false, baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
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
  } as unknown as WallEntity;
}

function makeCurvedWall(): WallEntity {
  // Curved wall: start=(0,0), end=(2000,0), control=(1000,800).
  const params: WallParams = {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 2000, y: 0, z: 0 },
    height: 3000,
    thickness: 200,
    flip: false, baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
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
  } as unknown as WallEntity;
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

// ─── ADR-363 Phase 2 carry-over — scene-units thread (edit-path callers) ─────

describe("computeOpeningGeometry — scene units 'm'", () => {
  function makeMetersWall(): WallEntity {
    return makeWall({
      sceneUnits: 'm',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 5, y: 0, z: 0 },
    });
  }

  it("scales outline to scene units when host wall is in 'm'", () => {
    const wall = makeMetersWall();
    const g = computeOpeningGeometry(makeOpening(), wall, 'm');
    // offsetFromStart=1000mm + width/2=450mm = 1450mm = 1.45m
    expect(g.position.x).toBeCloseTo(1.45, 5);
    expect(g.position.y).toBeCloseTo(0, 5);
    // Outline span = width=900mm → 0.9m along the wall axis.
    const xs = g.outline.vertices.map((v) => v.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(0.9, 5);
    // Outline span perpendicular = thickness=250mm → 0.25m.
    const ys = g.outline.vertices.map((v) => v.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(0.25, 5);
  });

  it("scales hingeArc to scene units when host wall is in 'm'", () => {
    const wall = makeMetersWall();
    const g = computeOpeningGeometry(makeOpening({ kind: 'door' }), wall, 'm');
    expect(g.hingeArc).toBeDefined();
    // handing='left' → hinge anchor at center.x - widthScene/2 = 1.45 - 0.45 = 1.0m.
    // points[0] (t=0): hinge.x + widthScene * (1 * startVecX) = 1.0 + 0.9 * 1 = 1.9m.
    expect(g.hingeArc!.points[0].x).toBeCloseTo(1.9, 5);
  });

  it("default sceneUnits='mm' regression — outline unchanged when omitted", () => {
    const wall = makeWall();
    const gDefault = computeOpeningGeometry(makeOpening(), wall);
    const gExplicit = computeOpeningGeometry(makeOpening(), wall, 'mm');
    expect(gDefault.position.x).toBeCloseTo(gExplicit.position.x, FLOAT_TOL);
    expect(gDefault.outline.vertices[0].x).toBeCloseTo(
      gExplicit.outline.vertices[0].x,
      FLOAT_TOL,
    );
  });
});

// ─── ADR-396 — Structural reveal outline (η μόνωση τρώει τον τοίχο) ────────────

const REVEAL = { materialId: 'mat-eps-graphite', thickness_m: 0.05, zone: 'Z4' } as const;

describe('computeOpeningGeometry — revealOutline (structural)', () => {
  it('απουσιάζει χωρίς revealInsulation', () => {
    const g = computeOpeningGeometry(makeOpening({ kind: 'window' }), makeWall());
    expect(g.revealOutline).toBeUndefined();
  });

  it('διευρύνει το free outline κατά t σε κάθε άκρο ΚΑΤΑ ΤΟΝ ΑΞΟΝΑ (horizontal wall)', () => {
    // free width 1000 @ offset 2000 → x∈[2000,3000]· reveal 50mm → structural x∈[1950,3050].
    const op = makeOpening({ kind: 'window', width: 1000, offsetFromStart: 2000, revealInsulation: { ...REVEAL } });
    const g = computeOpeningGeometry(op, makeWall());
    expect(g.revealOutline).toBeDefined();
    const xs = g.revealOutline!.vertices.map((v) => v.x);
    expect(Math.min(...xs)).toBeCloseTo(1950, 4);
    expect(Math.max(...xs)).toBeCloseTo(3050, 4);
    // πάχος (perpendicular) αμετάβλητο = free (250).
    const ys = g.revealOutline!.vertices.map((v) => v.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(250, 4);
    // το ελεύθερο outline ΜΕΝΕΙ 1000 (κούφωμα σταθερό).
    const fxs = g.outline.vertices.map((v) => v.x);
    expect(Math.max(...fxs) - Math.min(...fxs)).toBeCloseTo(1000, 4);
  });

  it('παρειές structural ΚΑΘΕΤΕΣ στον άξονα (ίδιο x ανά παρειά, horizontal)', () => {
    const op = makeOpening({ kind: 'window', revealInsulation: { ...REVEAL } });
    const v = computeOpeningGeometry(op, makeWall()).revealOutline!.vertices;
    expect(v[0].x).toBeCloseTo(v[3].x, 4); // start jamb
    expect(v[1].x).toBeCloseTo(v[2].x, 4); // end jamb
  });
});

describe('structuralRevealHeightRangeMm', () => {
  it('πόρτα (sill 0) + reveal 50 → [0 .. head+50]', () => {
    const r = structuralRevealHeightRangeMm(makeOpening({ kind: 'door', sillHeight: 0, height: 2100, revealInsulation: { ...REVEAL } }));
    expect(r.bottomMm).toBe(0);
    expect(r.topMm).toBe(2150); // 0+2100 + 50
  });

  it('παράθυρο (sill 900) + reveal 50 → [850 .. 2350]', () => {
    const r = structuralRevealHeightRangeMm(makeOpening({ kind: 'window', sillHeight: 900, height: 1400, revealInsulation: { ...REVEAL } }));
    expect(r.bottomMm).toBe(850);  // 900 − 50
    expect(r.topMm).toBe(2350);    // 900+1400 + 50
  });

  it('χωρίς reveal → αμετάβλητο (door [0..head], window [sill..head])', () => {
    expect(structuralRevealHeightRangeMm(makeOpening({ kind: 'door', sillHeight: 0, height: 2100 }))).toEqual({ bottomMm: 0, topMm: 2100 });
    expect(structuralRevealHeightRangeMm(makeOpening({ kind: 'window', sillHeight: 900, height: 1400 }))).toEqual({ bottomMm: 900, topMm: 2300 });
  });
});

// ─── ADR-615 — self-hosted (free-standing, no WallEntity) opening ────────────

describe('computeOpeningGeometry — self-hosted (ADR-615, WallEntity | OpeningHost union)', () => {
  it('resolves position from the selfOpeningHost anchor when there is NO WallEntity', () => {
    const anchor = { x: 2000, y: 500, z: 0 };
    const params = makeOpening({
      wallId: undefined,
      selfHost: { anchor, rotationRad: 0, hostThicknessMm: 100 },
      offsetFromStart: 0,
      width: 900,
    });
    const host = selfOpeningHost(params, 'mm');
    const g = computeOpeningGeometry(params, host, 'mm');
    // offsetFromStart=0 + width/2=450 walks exactly to the synthetic axis
    // midpoint (halfLength = width/2) → position === anchor.
    expect(g.position.x).toBeCloseTo(anchor.x, EDGE_TOL);
    expect(g.position.y).toBeCloseTo(anchor.y, EDGE_TOL);
    expect(g.rotation).toBeCloseTo(0, EDGE_TOL);
    // No outer/inner edges on a self-host → axis ± thicknessMm/2 fallback.
    const ys = g.outline.vertices.map((v) => v.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(100, EDGE_TOL);
  });

  it('rotationRad orients the synthesized axis (π/2 → vertical opening)', () => {
    const anchor = { x: 0, y: 0, z: 0 };
    const params = makeOpening({
      wallId: undefined,
      selfHost: { anchor, rotationRad: Math.PI / 2, hostThicknessMm: 100 },
      offsetFromStart: 0,
      width: 900,
    });
    const host = selfOpeningHost(params, 'mm');
    const g = computeOpeningGeometry(params, host, 'mm');
    expect(g.rotation).toBeCloseTo(Math.PI / 2, 5);
  });

  it('WallEntity call-sites keep working unchanged (zero-ripple normalize)', () => {
    // Same call as the wall-hosted describe blocks above — passing a raw
    // WallEntity (not an OpeningHost) must still resolve via wallAsOpeningHost.
    const g = computeOpeningGeometry(makeOpening(), makeWall());
    expect(g.position.x).toBeCloseTo(1450, EDGE_TOL);
  });
});

// ─── ADR-611 — constant-cross-section κάσα frame jambs ────────────────────────

/**
 * A jamb rectangle's edges (CCW `[start−perp, end−perp, end+perp, start+perp]`):
 *   - faceWidth edge = along the wall axis = dist(v0, v1)
 *   - depth edge     = across the axis     = dist(v1, v2)
 * On a horizontal host wall these are axis-aligned; measuring edge lengths is
 * therefore rotation-independent and captures the swept-profile cross-section.
 */
function jambCrossSection(poly: { vertices: readonly { x: number; y: number }[] }): { faceWidth: number; depth: number } {
  const v = poly.vertices;
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(b.x - a.x, b.y - a.y);
  return { faceWidth: dist(v[0], v[1]), depth: dist(v[1], v[2]) };
}

describe('computeOpeningGeometry — frameOutlines (ADR-611 constant cross-section)', () => {
  it('emits exactly two jamb outlines (one per opening end), each a 4-vertex rect', () => {
    const g = computeOpeningGeometry(makeOpening({ kind: 'window' }), makeWall());
    expect(g.frameOutlines).toBeDefined();
    expect(g.frameOutlines!).toHaveLength(2);
    for (const poly of g.frameOutlines!) expect(poly.vertices).toHaveLength(4);
  });

  it('κάσα cross-section stays CONSTANT across 6 widths (Revit swept-profile invariant)', () => {
    // Default resolve (no frameProfileId / no legacy frameWidth) → catalog GENERIC-70x70.
    const widths = [600, 900, 1200, 1500, 2000, 3000];
    for (const width of widths) {
      const g = computeOpeningGeometry(makeOpening({ kind: 'window', width }), makeWall());
      const left = jambCrossSection(g.frameOutlines![0]);
      const right = jambCrossSection(g.frameOutlines![1]);
      // Both jambs, every width → identical 70 × 70 cross-section.
      expect(left.faceWidth).toBeCloseTo(70, EDGE_TOL);
      expect(left.depth).toBeCloseTo(70, EDGE_TOL);
      expect(right.faceWidth).toBeCloseTo(70, EDGE_TOL);
      expect(right.depth).toBeCloseTo(70, EDGE_TOL);
    }
  });

  it('depth is INDEPENDENT of wall thickness (70mm profile in 150 vs 400 wall)', () => {
    const thin = computeOpeningGeometry(makeOpening({ kind: 'window' }), makeWall({ thickness: 150 }));
    const thick = computeOpeningGeometry(makeOpening({ kind: 'window' }), makeWall({ thickness: 400 }));
    expect(jambCrossSection(thin.frameOutlines![0]).depth).toBeCloseTo(70, EDGE_TOL);
    expect(jambCrossSection(thick.frameOutlines![0]).depth).toBeCloseTo(70, EDGE_TOL);
  });

  it('explicit catalog profile → non-square faceWidth ≠ depth, depth ≠ wall thickness', () => {
    // ALUMIL M9660 frame = 72 × 60; host wall thickness = 250.
    const g = computeOpeningGeometry(
      makeOpening({ kind: 'window', frameProfileId: 'ALUMIL-M9660-frame' }),
      makeWall({ thickness: 250 }),
    );
    const cs = jambCrossSection(g.frameOutlines![0]);
    expect(cs.faceWidth).toBeCloseTo(72, EDGE_TOL);
    expect(cs.depth).toBeCloseTo(60, EDGE_TOL);
    expect(cs.depth).not.toBeCloseTo(250, 0); // decoupled from wall
  });

  it('per-instance overrides win (faceWidth/depth hand-edit) and stay constant vs width', () => {
    for (const width of [700, 1100, 1800]) {
      const g = computeOpeningGeometry(
        makeOpening({ kind: 'window', width, frameProfileOverrides: { faceWidth: 90, depth: 45 } }),
        makeWall(),
      );
      const cs = jambCrossSection(g.frameOutlines![0]);
      expect(cs.faceWidth).toBeCloseTo(90, EDGE_TOL);
      expect(cs.depth).toBeCloseTo(45, EDGE_TOL);
    }
  });

  it('legacy frameWidth (no profileId) → square cross-section = frameWidth (zero regression)', () => {
    const g = computeOpeningGeometry(
      makeOpening({ kind: 'window', frameWidth: 50 }),
      makeWall(),
    );
    const cs = jambCrossSection(g.frameOutlines![0]);
    expect(cs.faceWidth).toBeCloseTo(50, EDGE_TOL);
    expect(cs.depth).toBeCloseTo(50, EDGE_TOL);
  });

  it("scales the κάσα cross-section to scene units when host wall is in 'm'", () => {
    const wall = makeWall({ sceneUnits: 'm', start: { x: 0, y: 0, z: 0 }, end: { x: 5, y: 0, z: 0 } });
    const g = computeOpeningGeometry(makeOpening({ kind: 'window' }), wall, 'm');
    const cs = jambCrossSection(g.frameOutlines![0]);
    // 70mm face/depth → 0.07m in a metres scene.
    expect(cs.faceWidth).toBeCloseTo(0.07, 5);
    expect(cs.depth).toBeCloseTo(0.07, 5);
  });

  it('left jamb sits at the opening start, right jamb at the opening end (axis order)', () => {
    // Horizontal wall, offset 1000 + width 900 → x∈[1000,1900]. faceWidth 70.
    const g = computeOpeningGeometry(makeOpening({ kind: 'window', offsetFromStart: 1000, width: 900 }), makeWall());
    const leftXs = g.frameOutlines![0].vertices.map((v) => v.x);
    const rightXs = g.frameOutlines![1].vertices.map((v) => v.x);
    expect(Math.min(...leftXs)).toBeCloseTo(1000, EDGE_TOL);   // start jamb outer edge
    expect(Math.max(...leftXs)).toBeCloseTo(1070, EDGE_TOL);   // start + faceWidth
    expect(Math.max(...rightXs)).toBeCloseTo(1900, EDGE_TOL);  // end jamb inner edge
    expect(Math.min(...rightXs)).toBeCloseTo(1830, EDGE_TOL);  // end − faceWidth
  });
});
