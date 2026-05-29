/**
 * ADR-396 Phase P3 — Tests για envelope geometry SSoT:
 *   - envelope-perimeter.ts (wall chaining → exterior loop → outward offset)
 *   - exposed-slab-classifier.ts (Z2/Z3 detection)
 *   - polygon-utils offset/centroid helpers (extracted SSoT)
 */

import {
  computeEnvelopePerimeter,
  selectExteriorFace,
  type WallForEnvelope,
} from '../envelope-perimeter';
import {
  classifyExposedSlab,
  filterExposedSlabs,
  type SlabForZoneClassification,
} from '../exposed-slab-classifier';
import { offsetPolyline, polygonCentroid } from '../shared/polygon-utils';
import { computeWallGeometry } from '../wall-geometry';
import type { Point3D } from '../../types/bim-base';
import type { WallParams } from '../../types/wall-types';
import type { StoreyRef } from '../../utils/bim-floor-utils';

// ─── Builders ────────────────────────────────────────────────────────────────

function wallParams(start: Point3D, end: Point3D, units: 'mm' | 'm' = 'mm'): WallParams {
  return {
    category: 'exterior',
    start,
    end,
    height: 3000,
    thickness: 200,
    flip: false,
    sceneUnits: units,
    baseBinding: 'storey-floor',
    topBinding: 'storey-ceiling',
    baseOffset: 0,
    topOffset: 0,
  };
}

function wall(id: string, start: Point3D, end: Point3D, units: 'mm' | 'm' = 'mm'): WallForEnvelope {
  return { id, kind: 'straight', params: wallParams(start, end, units) };
}

/** Κλειστό τετράγωνο `size`×`size` με origin (ox,oy). 4 τοίχοι CCW. */
function square(prefix: string, ox: number, oy: number, size: number, units: 'mm' | 'm' = 'mm'): WallForEnvelope[] {
  const p = (x: number, y: number): Point3D => ({ x: ox + x, y: oy + y, z: 0 });
  return [
    wall(`${prefix}1`, p(0, 0), p(size, 0), units),
    wall(`${prefix}2`, p(size, 0), p(size, size), units),
    wall(`${prefix}3`, p(size, size), p(0, size), units),
    wall(`${prefix}4`, p(0, size), p(0, 0), units),
  ];
}

function slab(levelElevation: number, extra: Partial<SlabForZoneClassification['params']> = {}, top: Partial<Omit<SlabForZoneClassification, 'params'>> = {}): SlabForZoneClassification {
  return { ...top, params: { levelElevation, thickness: 200, ...extra } };
}

// ─── offsetPolyline / polygonCentroid (extracted SSoT) ────────────────────────

describe('polygon-utils — offsetPolyline / polygonCentroid (ADR-396 P3 SSoT)', () => {
  it('offsets a horizontal axis +y (CCW) and −y', () => {
    const axis: Point3D[] = [{ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }];
    const plus = offsetPolyline(axis, 100, 1);
    expect(plus[0].y).toBeCloseTo(100, 6);
    expect(plus[1].y).toBeCloseTo(100, 6);
    const minus = offsetPolyline(axis, 100, -1);
    expect(minus[0].y).toBeCloseTo(-100, 6);
  });

  it('mitres an L-corner via averaged vertex normal', () => {
    const axis: Point3D[] = [{ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }, { x: 1000, y: 1000, z: 0 }];
    const out = offsetPolyline(axis, 100, 1);
    // Corner vertex normal = avg((0,1),(-1,0)) → (-0.5, 0.5).
    expect(out[1].x).toBeCloseTo(950, 6);
    expect(out[1].y).toBeCloseTo(50, 6);
  });

  it('computes arithmetic-mean centroid', () => {
    const square4: Point3D[] = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }];
    expect(polygonCentroid(square4)).toEqual({ x: 500, y: 500 });
    const tri: Point3D[] = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 3 }];
    const c = polygonCentroid(tri);
    expect(c.x).toBeCloseTo(1, 6);
    expect(c.y).toBeCloseTo(1, 6);
  });

  it('returns {0,0} for empty vertices', () => {
    expect(polygonCentroid([])).toEqual({ x: 0, y: 0 });
  });
});

// ─── selectExteriorFace (D2) ──────────────────────────────────────────────────

describe('selectExteriorFace — D2 face away from centroid', () => {
  it('picks the outer edge when it is farther from centroid', () => {
    const g = computeWallGeometry(wallParams({ x: 0, y: 5000, z: 0 }, { x: 10000, y: 5000, z: 0 }));
    // Centroid below the wall → exterior face is the one with larger |y|.
    const face = selectExteriorFace(g, { x: 5000, y: 0 });
    const mid = (face === 'outer' ? g.outerEdge : g.innerEdge).points;
    expect(Math.abs(mid[0].y)).toBeGreaterThan(5000);
  });

  it('respects flip (inner edge can be the exterior one)', () => {
    const normal = computeWallGeometry(wallParams({ x: 0, y: 5000, z: 0 }, { x: 10000, y: 5000, z: 0 }));
    const flipped = computeWallGeometry({ ...wallParams({ x: 0, y: 5000, z: 0 }, { x: 10000, y: 5000, z: 0 }), flip: true });
    const c = { x: 5000, y: 0 };
    expect(selectExteriorFace(normal, c)).not.toBe(selectExteriorFace(flipped, c));
  });
});

// ─── computeEnvelopePerimeter ─────────────────────────────────────────────────

describe('computeEnvelopePerimeter — closed loops', () => {
  it('chains a 10m square into one closed loop of 4 walls', () => {
    const r = computeEnvelopePerimeter(square('w', 0, 0, 10000), 0.1);
    expect(r.primaryChain).not.toBeNull();
    expect(r.primaryChain?.closed).toBe(true);
    expect(r.primaryChain?.wallIds).toHaveLength(4);
    expect(r.chains).toHaveLength(1);
  });

  it('insulation outer perimeter exceeds the building axis perimeter (40m)', () => {
    const r = computeEnvelopePerimeter(square('w', 0, 0, 10000), 0.1);
    // axis perimeter = 40m; faces offset 0.1m + insulation 0.1m outward → larger.
    expect(r.primaryChain!.perimeterM).toBeGreaterThan(40);
    expect(r.primaryChain!.perimeterM).toBeLessThan(43);
  });

  it('chains an L-shaped building (6 walls) into one closed loop', () => {
    const p = (x: number, y: number): Point3D => ({ x, y, z: 0 });
    const ring = [p(0, 0), p(6000, 0), p(6000, 3000), p(3000, 3000), p(3000, 6000), p(0, 6000)];
    const walls: WallForEnvelope[] = ring.map((s, i) => wall(`L${i}`, s, ring[(i + 1) % ring.length]));
    const r = computeEnvelopePerimeter(walls, 0.1);
    expect(r.primaryChain?.closed).toBe(true);
    expect(r.primaryChain?.wallIds).toHaveLength(6);
  });

  it('returns two closed chains for two detached buildings', () => {
    const walls = [...square('a', 0, 0, 5000), ...square('b', 50000, 50000, 5000)];
    const r = computeEnvelopePerimeter(walls, 0.1);
    expect(r.chains.filter(c => c.closed)).toHaveLength(2);
  });
});

describe('computeEnvelopePerimeter — open / degenerate', () => {
  it('returns an open chain (closed:false, primaryChain:null) for an incomplete square', () => {
    const walls = square('w', 0, 0, 10000).slice(0, 3); // drop closing wall
    const r = computeEnvelopePerimeter(walls, 0.1);
    expect(r.primaryChain).toBeNull();
    expect(r.chains.some(c => !c.closed)).toBe(true);
  });

  it('handles an empty wall list', () => {
    const r = computeEnvelopePerimeter([], 0.1);
    expect(r.chains).toHaveLength(0);
    expect(r.primaryChain).toBeNull();
  });
});

describe('computeEnvelopePerimeter — unit invariance', () => {
  it('yields the same meters perimeter for mm-scene and m-scene buildings', () => {
    const mm = computeEnvelopePerimeter(square('m', 0, 0, 4000, 'mm'), 0.1, 'mm');
    const m = computeEnvelopePerimeter(square('s', 0, 0, 4, 'm'), 0.1, 'm');
    expect(mm.primaryChain).not.toBeNull();
    expect(m.primaryChain).not.toBeNull();
    expect(m.primaryChain!.perimeterM).toBeCloseTo(mm.primaryChain!.perimeterM, 2);
  });
});

// ─── classifyExposedSlab (Z2/Z3) ──────────────────────────────────────────────

describe('classifyExposedSlab — Z2 (πιλοτή) / Z3 (δώμα) / null', () => {
  it('single-storey roof slab → Z3 (no storey above)', () => {
    expect(classifyExposedSlab(slab(3000), [{ id: 'g', elevation: 0 }])).toBe('Z3');
  });

  it('two-storey ground slab → Z2 (no storey below)', () => {
    const floors: StoreyRef[] = [{ id: 'f0', elevation: 0 }, { id: 'f1', elevation: 3 }];
    expect(classifyExposedSlab(slab(0), floors)).toBe('Z2');
  });

  it('two-storey top slab → Z3', () => {
    const floors: StoreyRef[] = [{ id: 'f0', elevation: 0 }, { id: 'f1', elevation: 3 }];
    expect(classifyExposedSlab(slab(3000), floors)).toBe('Z3');
  });

  it('interior slab (storey above and below) → null', () => {
    const floors: StoreyRef[] = [{ id: 'f0', elevation: 0 }, { id: 'f1', elevation: 3 }, { id: 'f2', elevation: 6 }];
    expect(classifyExposedSlab(slab(3000), floors)).toBeNull();
  });

  it('empty floor list → Z3 (degenerate safe default)', () => {
    expect(classifyExposedSlab(slab(0), [])).toBe('Z3');
  });

  it('storey-linked slab uses absolute elevation (overrides stale levelElevation)', () => {
    const floors: StoreyRef[] = [{ id: 'top', elevation: 6 }];
    const linked = slab(0, { storeyId: 'top', offsetFromStorey: 0 });
    expect(classifyExposedSlab(linked, floors)).toBe('Z3');
  });

  it('filterExposedSlabs keeps only Z2/Z3 slabs with their zone', () => {
    const floors: StoreyRef[] = [{ id: 'f0', elevation: 0 }, { id: 'f1', elevation: 3 }, { id: 'f2', elevation: 6 }];
    const slabs = [slab(0), slab(3000), slab(6000)]; // Z2, interior(null), Z3
    const exposed = filterExposedSlabs(slabs, floors);
    expect(exposed).toHaveLength(2);
    expect(exposed.map(e => e.zone).sort()).toEqual(['Z2', 'Z3']);
  });
});
