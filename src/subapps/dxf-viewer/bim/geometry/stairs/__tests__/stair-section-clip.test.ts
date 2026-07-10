/**
 * ADR-619 Bug #4 — section-slider clip SSoT tests.
 *
 * Verifies the vertical «Επίπεδο τομής» slider behaves as a pure visibility clip
 * on the stair geometry: treads above the plane vanish, ascending polylines
 * truncate (with an interpolated crossing vertex), and an inactive plane
 * (`Infinity`) is an identity that returns the ORIGINAL references.
 */

import {
  clipTreadsAtSection,
  clipPolylineAtSection,
  clipStairGeometryAtSection,
  type StairSectionGeometry,
} from '../stair-section-clip';
import type { Point3D } from '../../../../rendering/types/Types';

/** A horizontal tread quad at elevation `z`. */
function treadAt(z: number): Point3D[] {
  return [
    { x: 0, y: 0, z }, { x: 900, y: 0, z },
    { x: 900, y: 280, z }, { x: 0, y: 280, z },
  ];
}

describe('clipTreadsAtSection', () => {
  const treads = [treadAt(0), treadAt(600), treadAt(1200), treadAt(1800), treadAt(2400)];

  it('keeps only treads at or below the plane', () => {
    const kept = clipTreadsAtSection(treads, 1200);
    expect(kept.map((t) => t[0].z)).toEqual([0, 600, 1200]);
  });

  it('drops the whole flight when the plane is below the base tread', () => {
    expect(clipTreadsAtSection(treads, -1)).toHaveLength(0);
  });

  it('returns the SAME array reference (identity) for an inactive plane', () => {
    expect(clipTreadsAtSection(treads, Infinity)).toBe(treads);
  });
});

describe('clipPolylineAtSection', () => {
  const walkline: Point3D[] = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 300, z: 1000 },
    { x: 0, y: 600, z: 2000 },
    { x: 0, y: 900, z: 3000 },
  ];

  it('truncates at the plane and interpolates the crossing vertex', () => {
    const clipped = clipPolylineAtSection(walkline, 1500);
    // keeps the two vertices ≤ 1500, then the interpolated crossing at z=1500
    // (halfway along the 1000→2000 edge → y = 300 + 0.5*300 = 450).
    expect(clipped).toEqual([
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 300, z: 1000 },
      { x: 0, y: 450, z: 1500 },
    ]);
  });

  it('keeps a vertex that sits exactly on the plane', () => {
    const clipped = clipPolylineAtSection(walkline, 2000);
    expect(clipped.map((p) => p.z)).toEqual([0, 1000, 2000]);
  });

  it('returns the SAME reference (identity) for an inactive plane', () => {
    expect(clipPolylineAtSection(walkline, Infinity)).toBe(walkline);
  });
});

describe('clipStairGeometryAtSection', () => {
  const geometry: StairSectionGeometry = {
    // Unified tread set (below + above internal cut merged — ADR-619 Bug #5).
    treads: [treadAt(0), treadAt(600), treadAt(1000), treadAt(1200), treadAt(1800), treadAt(2400)],
    stringers: {
      inner: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 900, z: 3000 }],
      outer: [{ x: 900, y: 0, z: 0 }, { x: 900, y: 900, z: 3000 }],
    },
    walkline: [{ x: 450, y: 0, z: 0 }, { x: 450, y: 900, z: 3000 }],
  };

  it('clips the unified tread set and truncates stringers + walkline at the plane', () => {
    const clipped = clipStairGeometryAtSection(geometry, 1500);
    // Keeps every tread ≤ 1500 (0/600/1000/1200), drops 1800/2400.
    expect(clipped.treads.map((t) => t[0].z)).toEqual([0, 600, 1000, 1200]);
    // Each stringer + walkline truncates to [base, crossing@1500].
    expect(clipped.stringers.inner.map((p) => p.z)).toEqual([0, 1500]);
    expect(clipped.stringers.outer.map((p) => p.z)).toEqual([0, 1500]);
    expect(clipped.walkline.map((p) => p.z)).toEqual([0, 1500]);
  });

  it('returns the SAME geometry object (identity) for an inactive plane', () => {
    expect(clipStairGeometryAtSection(geometry, Infinity)).toBe(geometry);
  });
});
