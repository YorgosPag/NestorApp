/**
 * ADR-408 Φ-A — sloped MEP segment (riser) 3D mesh.
 *
 * Proves `mepSegmentToMesh` builds the swept solid between the two TRUE 3D
 * endpoints, so a run whose start/end elevations differ renders DIAGONAL — with
 * BOTH a horizontal (plan) extent AND a vertical extent — not a flat horizontal
 * bar (old behaviour) and not a degenerate vertical stub.
 *
 * The converter bakes the world transform into the geometry via `applyMatrix4`,
 * so the `position` attribute is already in Three.js world metres.
 */

import { mepSegmentToMesh } from '../mep-segment-to-mesh';
import type { MepSegmentEntity, MepSegmentParams } from '../../../bim/types/mep-segment-types';

function makeSegment(over: Partial<MepSegmentParams> = {}): MepSegmentEntity {
  const params: MepSegmentParams = {
    domain: 'pipe',
    sectionKind: 'round',
    startPoint: { x: 0, y: 0, z: 0 },
    endPoint: { x: 1000, y: 0, z: 0 }, // 1000mm = 1m plan length
    diameter: 50,
    centerlineElevationMm: 0,
    sceneUnits: 'mm',
    ...over,
  } as MepSegmentParams;
  return {
    id: 'seg-riser-test',
    type: 'mep-segment',
    kind: params.domain,
    ifcType: params.domain === 'pipe' ? 'IfcPipeSegment' : 'IfcDuctSegment',
    layerId: '0',
    params,
    geometry: {} as never,
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as MepSegmentEntity;
}

function extents(mesh: {
  geometry: { getAttribute(n: string): { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number } };
}): { dx: number; dy: number; dz: number } {
  const p = mesh.geometry.getAttribute('position');
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  return { dx: maxX - minX, dy: maxY - minY, dz: maxZ - minZ };
}

describe('mepSegmentToMesh — horizontal back-compat', () => {
  it('a flat run at centreline 2800 has ~zero vertical extent and full plan extent', () => {
    const mesh = mepSegmentToMesh(
      makeSegment({ startPoint: { x: 0, y: 0, z: 0 }, endPoint: { x: 1000, y: 0, z: 0 }, centerlineElevationMm: 2800 }),
    )!;
    expect(mesh).not.toBeNull();
    const { dx, dy } = extents(mesh);
    expect(dx).toBeGreaterThan(0.95); // ~1m plan run
    expect(dy).toBeLessThan(0.1); // only the Ø (50mm), flat
  });
});

describe('mepSegmentToMesh — riser (start z=0 → end z=2800)', () => {
  it('renders DIAGONAL: both a ~1m plan extent AND a ~2.8m vertical extent', () => {
    const mesh = mepSegmentToMesh(
      makeSegment({ startPoint: { x: 0, y: 0, z: 0 }, endPoint: { x: 1000, y: 0, z: 2800 }, centerlineElevationMm: 1400 }),
    )!;
    expect(mesh).not.toBeNull();
    const { dx, dy } = extents(mesh);
    // Vertical rise must be present (≈2.8m) — proves it climbs.
    expect(dy).toBeGreaterThan(2.7);
    // Horizontal plan extent must ALSO be present (≈1m) — proves it is NOT a
    // vertical stub. This is the exact "appears vertical not sloped" guard.
    expect(dx).toBeGreaterThan(0.9);
  });

  it('a SHORT plan pipe (200mm) with a 2.8m rise is correctly near-vertical', () => {
    // Documents the perception case: a big rise on a tiny plan run IS ~86°.
    const mesh = mepSegmentToMesh(
      makeSegment({ startPoint: { x: 0, y: 0, z: 0 }, endPoint: { x: 200, y: 0, z: 2800 }, centerlineElevationMm: 1400 }),
    )!;
    const { dx, dy } = extents(mesh);
    expect(dy).toBeGreaterThan(2.7); // full rise
    expect(dx).toBeGreaterThan(0.15); // plan extent still present (~0.2m), not collapsed
  });
});
