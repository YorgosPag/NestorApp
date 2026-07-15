/**
 * ADR-650 M10d — `contourLinesToGeometries` ground truth.
 *
 * The test does NOT re-implement the transform. It fixes contour lines at KNOWN world coordinates
 * and elevations, reads each built vertex back out of the buffer (world metres → plan mm) and
 * asserts: (1) major/minor split into two geometries, (2) every vertex sits at `z = level − datum`,
 * (3) the projector re-seats the plan, (4) closed rings emit the wrap-around segment, and (5) a
 * non-finite vertex drops only its own segment (the ADR-537 Box3-poison guard).
 */

import { contourLinesToGeometries } from '../contour-to-three';
import { makeWorldToDisplayProjector } from '../../../systems/geo-referencing/geo-transform';
import type { ContourLine } from '../../../systems/topography/topo-types';

const M_TO_MM = 1000;

/** Read the position buffer of a geometry as plain [x,y,z] metre triples. */
function readVerts(geo: { getAttribute: (n: string) => { array: ArrayLike<number> } } | null): number[][] {
  if (!geo) return [];
  const a = geo.getAttribute('position').array;
  const out: number[][] = [];
  for (let i = 0; i < a.length; i += 3) out.push([a[i]!, a[i + 1]!, a[i + 2]!]);
  return out;
}

const line = (over: Partial<ContourLine> = {}): ContourLine => ({
  level: 1000,
  vertices: [{ x: 2000, y: 3000 }, { x: 5000, y: 3000 }],
  isMajor: false,
  closed: false,
  ...over,
});

describe('contourLinesToGeometries', () => {
  it('splits major and minor into separate geometries', () => {
    const { major, minor } = contourLinesToGeometries([
      line({ isMajor: true }),
      line({ isMajor: false }),
    ]);
    expect(major).not.toBeNull();
    expect(minor).not.toBeNull();
    expect(readVerts(major)).toHaveLength(2); // one segment = 2 vertices
    expect(readVerts(minor)).toHaveLength(2);
  });

  it('seats every vertex at z = level − datum (Y-up, mm→m)', () => {
    const { minor } = contourLinesToGeometries([line({ level: 3000 })], { datumMm: 1000 });
    // world Y = (level − datum)/1000 = (3000 − 1000)/1000 = 2 m; plan (x,−z) round-trips the mm.
    for (const [wx, wy, wz] of readVerts(minor)) {
      expect(wy).toBeCloseTo(2, 6);
      expect(wx * M_TO_MM).toBeGreaterThanOrEqual(2000 - 1e-6);
      expect(-wz * M_TO_MM).toBeCloseTo(3000, 3);
    }
  });

  it('applies the geo-reference projector to the plan coordinates', () => {
    // Inverse 90° rotation about the world origin (world→local): (x,y) → (y, −x).
    // Vertex (2000,3000) → local (3000, −2000).
    const projector = makeWorldToDisplayProjector({ originWorld: { x: 0, y: 0 }, rotationDeg: 90 });
    const { minor } = contourLinesToGeometries([line()], { projector });
    const [first] = readVerts(minor);
    expect(first![0] * M_TO_MM).toBeCloseTo(3000, 3); // world X = projected plan X
    expect(-first![2] * M_TO_MM).toBeCloseTo(-2000, 3); // world −Z = projected plan Y
  });

  it('emits the wrap-around segment for a closed ring', () => {
    const closed = contourLinesToGeometries([line({
      closed: true,
      vertices: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }],
    })]);
    const open = contourLinesToGeometries([line({
      closed: false,
      vertices: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }],
    })]);
    expect(readVerts(closed.minor)).toHaveLength(6); // 3 segments × 2 vertices
    expect(readVerts(open.minor)).toHaveLength(4); // 2 segments × 2 vertices
  });

  it('drops only the segment carrying a non-finite vertex (no NaN in the buffer)', () => {
    const { minor } = contourLinesToGeometries([line({
      vertices: [{ x: 0, y: 0 }, { x: Number.NaN, y: 0 }, { x: 2000, y: 0 }],
    })]);
    const verts = readVerts(minor);
    for (const v of verts.flat()) expect(Number.isFinite(v)).toBe(true);
    expect(verts).toHaveLength(0); // both segments touch the NaN vertex → both dropped
  });

  it('returns null geometries when there are no drawable lines', () => {
    const { major, minor } = contourLinesToGeometries([line({ vertices: [{ x: 0, y: 0 }] })]);
    expect(major).toBeNull();
    expect(minor).toBeNull();
  });
});
