/**
 * ADR-920 §14.10 — the terrain inspector core: point reading, nearest contour, exact profile, water drop.
 *
 *   Α  reading on a known plane: elevation (barycentric), slope % / °, the direction it falls, measured, off-surface = null
 *   Ι  nearest contour from the snapshot's OWN contours (independent of what the map draws), with its distance
 *   Ο  boundary: inside / outside and the distance to the line
 *   Π  profile: a station at every edge crossing, exact elevations, gain / loss / steepest, gaps told — never bridged
 *   Ν  water drop: a cone ends in its pit; a plane runs off the survey; flat ground stays; a V-valley follows the gully
 */

import { terrainInspectIndexOf } from '../terrain-inspect-index';
import { traceFlowPath } from '../terrain-flow-path';
import { readTerrainAt } from '../terrain-point-reading';
import { profilePointAt, terrainProfileOf } from '../terrain-profile';
import type { ListingTerrainContour, ListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-types';

const HALF = 10;

/** A (2·HALF + 1)² grid, 1 m spacing, centred on 0, CCW triangles; `z(x, y)` gives the ground. */
function gridSnapshot(z: (x: number, y: number) => number, extra: Partial<ListingTerrainSnapshot> = {}): ListingTerrainSnapshot {
  const n = 2 * HALF + 1;
  const positions: number[] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) positions.push(i - HALF, j - HALF, z(i - HALF, j - HALF));
  const triangles: number[] = [];
  for (let j = 0; j + 1 < n; j++) {
    for (let i = 0; i + 1 < n; i++) {
      const a = j * n + i; const b = a + 1; const c = a + n + 1; const d = a + n;
      triangles.push(a, b, c, a, c, d);
    }
  }
  const zs = positions.filter((_, k) => k % 3 === 2);
  return {
    version: 2,
    mesh: { positions, triangles, slopeClass: new Array(triangles.length / 3).fill(1) },
    contours: [],
    contourIntervalM: 0.5,
    contourMajorEvery: 5,
    slopeBandsPct: [5, 15, 25],
    boundary: null,
    stats: {
      planAreaM2: (n - 1) ** 2, minElevationM: Math.min(...zs), maxElevationM: Math.max(...zs), reliefM: Math.max(...zs) - Math.min(...zs),
      meanSlopePct: 0, maxSlopePct: 0, downslopeAzimuthDeg: null,
    },
    envelope: null,
    envelopeOmission: null,
    plotOutline: null,
    plotOutlineOmission: null,
    georeference: null,
    georeferenceOmission: null,
    ...extra,
  };
}

/** Plane rising 10 % to the east ⇒ it FALLS to the west (270°). */
const RAMP = (x: number) => 100 + 0.1 * x;

describe('Α — reading a point', () => {
  const index = terrainInspectIndexOf(gridSnapshot(RAMP));

  it('elevation, slope, direction on a known plane', () => {
    const r = readTerrainAt(index, 1.3, 2.7);
    expect(r).not.toBeNull();
    expect(r!.elevationM).toBeCloseTo(100.13, 9);
    expect(r!.slopePct).toBeCloseTo(10, 9);
    expect(r!.slopeDeg).toBeCloseTo((Math.atan(0.1) * 180) / Math.PI, 9);
    expect(r!.downslopeAzimuthDeg).toBeCloseTo(270, 9);
    expect(r!.downslope).toBe('west');
    expect(r!.aboveLowestM).toBeCloseTo(1.13, 9);
    expect(r!.belowHighestM).toBeCloseTo(0.87, 9);
    expect(r!.measured).toBe(true);
    expect(r!.slopeClass).toBe(1);
  });

  it('off the published surface: nothing is invented', () => {
    expect(readTerrainAt(index, HALF + 0.5, 0)).toBeNull();
  });

  it('flat ground has no direction', () => {
    const flat = terrainInspectIndexOf(gridSnapshot(() => 5));
    const r = readTerrainAt(flat, 0.2, 0.3);
    expect(r!.slopePct).toBe(0);
    expect(r!.downslopeAzimuthDeg).toBeNull();
    expect(r!.downslope).toBeNull();
  });

  it('the index is built once per snapshot', () => {
    const snapshot = gridSnapshot(RAMP);
    expect(terrainInspectIndexOf(snapshot)).toBe(terrainInspectIndexOf(snapshot));
  });
});

describe('Ι — nearest contour', () => {
  /** Contours of the ramp: x = −5, 0, 5 ⇒ 99.5, 100, 100.5. Only the middle one is major. */
  const contours: ListingTerrainContour[] = [-5, 0, 5].map((x) => ({
    levelM: RAMP(x), major: x === 0, closed: false, points: [x, -HALF, x, 0, x, HALF],
  }));
  const index = terrainInspectIndexOf(gridSnapshot(RAMP, { contours }));

  it('finds the contour the point is closest to, and how far', () => {
    const near = readTerrainAt(index, 1.2, 3)!.nearestContour!;
    expect(near.contour).toBe(1);
    expect(near.levelM).toBeCloseTo(100, 9);
    expect(near.major).toBe(true);
    expect(near.distanceM).toBeCloseTo(1.2, 9);
  });

  it('picks the other side when it is closer', () => {
    expect(readTerrainAt(index, 3.9, -8)!.nearestContour!.contour).toBe(2);
    expect(readTerrainAt(index, -2.6, 9)!.nearestContour!.contour).toBe(0);
  });

  it('no contours ⇒ no answer, never an error', () => {
    expect(readTerrainAt(terrainInspectIndexOf(gridSnapshot(RAMP)), 0, 0)!.nearestContour).toBeNull();
  });
});

describe('Ο — boundary', () => {
  const square = [-5, -5, 5, -5, 5, 5, -5, 5];
  const index = terrainInspectIndexOf(gridSnapshot(RAMP, { boundary: square }));

  it('inside, with the distance to the line', () => {
    expect(readTerrainAt(index, 3, 0)!.boundary).toEqual({ inside: true, distanceM: 2 });
  });

  it('outside, with the distance to the line', () => {
    const b = readTerrainAt(index, 7, 0)!.boundary!;
    expect(b.inside).toBe(false);
    expect(b.distanceM).toBeCloseTo(2, 9);
  });
});

describe('Π — profile', () => {
  const index = terrainInspectIndexOf(gridSnapshot(RAMP));

  it('one station at every edge crossing, exact elevations, gain / loss / steepest', () => {
    const p = terrainProfileOf(index, { x: -4.5, y: 0.3 }, { x: 4.5, y: 0.3 })!;
    expect(p.lengthM).toBeCloseTo(9, 9);
    expect(p.stations[0].s).toBe(0);
    expect(p.stations[p.stations.length - 1].s).toBeCloseTo(9, 9);
    // Crosses x = −4 … 4 (9 vertical edges) and one diagonal per cell (9 cells): 18 crossings + 2 ends.
    expect(p.stations).toHaveLength(20);
    p.stations.forEach((st) => expect(st.z).toBeCloseTo(RAMP(st.x), 9));
    expect(p.gainM).toBeCloseTo(0.9, 9);
    expect(p.lossM).toBeCloseTo(0, 9);
    expect(p.maxGradePct).toBeCloseTo(10, 9);
    expect(p.hasGap).toBe(false);
  });

  it('a line leaving the survey has a gap — never bridged', () => {
    const p = terrainProfileOf(index, { x: -20, y: 0.5 }, { x: 0, y: 0.5 })!;
    expect(p.hasGap).toBe(true);
    expect(p.stations[0].z).toBeNull();
    expect(p.pieces[0].onSurface).toBe(false);
    expect(profilePointAt(p, 2).z).toBeNull();
    expect(profilePointAt(p, 19).z).toBeCloseTo(RAMP(-1), 9);
  });

  it('a click is not a profile', () => {
    expect(terrainProfileOf(index, { x: 0, y: 0 }, { x: 0.1, y: 0 })).toBeNull();
  });
});

describe('Ν — water drop', () => {
  it('a cone drains into its pit', () => {
    const index = terrainInspectIndexOf(gridSnapshot((x, y) => Math.hypot(x, y)));
    const flow = traceFlowPath(index, 3.3, 2.1)!;
    expect(flow.end).toBe('pit');
    const last = flow.points[flow.points.length - 1];
    expect(Math.hypot(last.x, last.y)).toBeLessThan(1e-6);
    expect(flow.dropM).toBeCloseTo(flow.points[0].z, 6);
  });

  it('a plane runs off the survey, downhill', () => {
    const flow = traceFlowPath(terrainInspectIndexOf(gridSnapshot(RAMP)), 2, 0.5)!;
    expect(flow.end).toBe('leaves-surface');
    expect(flow.points[flow.points.length - 1].x).toBeCloseTo(-HALF, 6);
    expect(flow.overallAzimuthDeg).toBeCloseTo(270, 6);
    expect(flow.lengthM).toBeCloseTo(12, 6);
  });

  it('flat ground keeps the water where it fell', () => {
    const flow = traceFlowPath(terrainInspectIndexOf(gridSnapshot(() => 5)), 0.2, 0.4)!;
    expect(flow.end).toBe('flat');
    expect(flow.points).toHaveLength(1);
    expect(flow.overallAzimuthDeg).toBeNull();
  });

  it('a V-valley sends the drop into the gully and down it', () => {
    const flow = traceFlowPath(terrainInspectIndexOf(gridSnapshot((x, y) => Math.abs(x) + 0.05 * y)), 3.4, 2.2)!;
    expect(flow.end).toBe('leaves-surface');
    const last = flow.points[flow.points.length - 1];
    expect(last.x).toBeCloseTo(0, 6);
    expect(last.y).toBeCloseTo(-HALF, 6);
    flow.points.slice(1).forEach((p, i) => expect(p.z).toBeLessThanOrEqual(flow.points[i].z + 1e-9));
  });

  it('off the surface: no drop', () => {
    expect(traceFlowPath(terrainInspectIndexOf(gridSnapshot(RAMP)), 50, 0)).toBeNull();
  });
});
