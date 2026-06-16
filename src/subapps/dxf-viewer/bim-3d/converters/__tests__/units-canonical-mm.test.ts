/**
 * ADR-462 canonical-mm — 3Δ structural converters scale plan XY (canvas units = mm)
 * → world metres via `sceneUnitsToMeters`. Regression guard for the «κολώνα αόρατη
 * στο 3Δ» bug: a canonical-mm column placed far from origin was rendered 1000× too
 * big and ~1000× too far → outside the camera frustum → invisible.
 *
 * Also guards the slab-slope linchpin: `applySlabSlope` must divide the (now metre)
 * geometry plan coords back to mm before the (non-scale-invariant) `slabSlopeOffsetZmm`
 * lookup — otherwise the shear is 1000× off.
 */

import * as THREE from 'three';
import { columnToMesh, slabToMesh } from '../BimToThreeConverter';
import { buildDefaultColumnParams, buildColumnEntity } from '../../../hooks/drawing/column-completion';
import { slabSlopeOffsetZmm } from '../../../bim/geometry/slab-slope';
import type { ColumnEntity } from '../../../bim/types/column-types';
import type { SlabEntity, SlabParams } from '../../../bim/types/slab-types';

const MM_TO_M = 0.001;

// ── Column: 40×40cm, h=3m, placed 50m,30m from origin (in canonical mm) ──────────
function mmColumn(): ColumnEntity {
  const params = {
    ...buildDefaultColumnParams({ x: 50_000, y: 30_000 }, 'rectangular', undefined, 'mm'),
    width: 400,
    depth: 400,
    height: 3000,
    finish: undefined, // core-only mesh → clean bbox (no plaster skin)
  };
  const res = buildColumnEntity(params, '0');
  if (!res.ok) throw new Error('column fixture invalid');
  return res.entity;
}

describe('ADR-462 — column 3D world units (canonical mm → metres)', () => {
  it('40×40cm h3m far-origin column renders at correct metre size, near its world position', () => {
    const mesh = columnToMesh(mmColumn(), 0, '0', 0);
    expect(mesh).not.toBeNull();
    const box = new THREE.Box3().setFromObject(mesh as THREE.Object3D);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // 400mm → 0.4m footprint, 3000mm → 3m height (NOT 400m / outside frustum).
    expect(size.x).toBeCloseTo(0.4, 2);
    expect(size.z).toBeCloseTo(0.4, 2);
    expect(size.y).toBeCloseTo(3, 2);
    // position 50000mm,30000mm → world (50, _, -30) metres (AXIS_FLIP Z = -y).
    expect(center.x).toBeCloseTo(50, 1);
    expect(center.z).toBeCloseTo(-30, 1);
  });
});

// ── Slab-slope linchpin guard (canonical mm) ─────────────────────────────────────
const SQUARE_MM = {
  vertices: [
    { x: 0, y: 0, z: 0 },
    { x: 5000, y: 0, z: 0 },
    { x: 5000, y: 5000, z: 0 },
    { x: 0, y: 5000, z: 0 },
  ],
};

function mmSlab(over: Partial<SlabParams> = {}): SlabEntity {
  const params: SlabParams = {
    kind: 'roof',
    outline: SQUARE_MM,
    levelElevation: 3000,
    thickness: 200,
    geometryType: 'box',
    sceneUnits: 'mm',
    ...over,
  } as SlabParams;
  return {
    id: 's', type: 'slab', kind: params.kind, ifcType: 'IfcSlab', layerId: '0', params,
    geometry: {} as SlabEntity['geometry'],
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null }, visible: true,
  } as unknown as SlabEntity;
}

function positions(mesh: THREE.Mesh): { x: number; y: number; z: number }[] {
  const p = mesh.geometry.getAttribute('position');
  const out: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < p.count; i++) out.push({ x: p.getX(i), y: p.getY(i), z: p.getZ(i) });
  return out;
}

describe('ADR-462 — slab in canonical mm renders in metres + slope stays correct', () => {
  it('5×5m flat slab → 5m footprint extent in world (NOT 5000)', () => {
    const mesh = slabToMesh(mmSlab()) as THREE.Mesh;
    const xs = positions(mesh).map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(5, 2);
  });

  it('tilted slab shear matches slabSlopeOffsetZmm with plan coords divided back to mm (linchpin)', () => {
    const tiltedParams = { geometryType: 'tilted' as const, slope: { direction: 0, angle: 10, pivotEdge: 'center' as const } };
    const params = mmSlab(tiltedParams).params;
    const sceneToM = MM_TO_M; // sceneUnitsToMeters('mm')
    const flat = positions(slabToMesh(mmSlab()) as THREE.Mesh);
    const tilted = positions(slabToMesh(mmSlab(tiltedParams)) as THREE.Mesh);
    expect(tilted.length).toBe(flat.length);
    for (let i = 0; i < flat.length; i++) {
      expect(tilted[i].x).toBeCloseTo(flat[i].x, 6);
      expect(tilted[i].z).toBeCloseTo(flat[i].z, 6);
      // geometry XZ is in metres → divide back to mm for the (non-scale-invariant) SSoT.
      const offsetM = slabSlopeOffsetZmm(params, { x: flat[i].x / sceneToM, y: -flat[i].z / sceneToM }) * MM_TO_M;
      expect(tilted[i].y).toBeCloseTo(flat[i].y + offsetM, 6);
    }
  });
});

// ── ADR-448 §4.1 — floor-relative vertical datum (foundation/non-ground floors) ───
describe('ADR-448 — slab & column honour the storey FFL (floorElevationMm)', () => {
  it('slab on the foundation FFL (−1000mm) sits exactly 1m below the same slab on the ground floor', () => {
    const ground = slabToMesh(mmSlab(), [], '0', 0, 0) as THREE.Mesh;
    const foundation = slabToMesh(mmSlab(), [], '0', 0, -1000) as THREE.Mesh;
    expect(foundation.position.y - ground.position.y).toBeCloseTo(-1, 6);
  });

  it('column (already floor-aware) keeps the same FFL behaviour — regression guard', () => {
    const ground = columnToMesh(mmColumn(), 0, '0', 0) as THREE.Mesh;
    const foundation = columnToMesh(mmColumn(), -1000, '0', 0) as THREE.Mesh;
    const gBox = new THREE.Box3().setFromObject(ground);
    const fBox = new THREE.Box3().setFromObject(foundation);
    expect(fBox.min.y - gBox.min.y).toBeCloseTo(-1, 6);
  });
});
