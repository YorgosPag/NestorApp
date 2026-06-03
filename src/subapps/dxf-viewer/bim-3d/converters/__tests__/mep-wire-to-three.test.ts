/**
 * ADR-408 Φ7 — 3D home-run conduit converter tests (units-safe + colour).
 */

import * as THREE from 'three';
import { wirePathToMesh } from '../mep-wire-to-three';
import type { CircuitWirePath } from '../../../bim/mep-systems/mep-wire-routing';

/** A two-point straight path at a given plan distance + run elevation. */
function path(x1: number, y1: number, x2: number, y2: number, zMm: number, color = '#2563eb'): CircuitWirePath {
  return { systemId: 's1', colorHex: color, points: [{ x: x1, y: y1, zMm }, { x: x2, y: y2, zMm }] };
}

function worldSize(mesh: THREE.Mesh): THREE.Vector3 {
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox!;
  return box.getSize(new THREE.Vector3());
}

describe('wirePathToMesh', () => {
  it('returns null for a path with fewer than two points', () => {
    expect(wirePathToMesh({ systemId: 's', colorHex: '#000000', points: [{ x: 0, y: 0, zMm: 0 }] }, 1, 0, 0)).toBeNull();
  });

  it('sweeps a tube mesh from a two-point path', () => {
    const mesh = wirePathToMesh(path(0, 0, 10, 0, 0), 1, 0, 0);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh!.geometry).toBeInstanceOf(THREE.TubeGeometry);
    expect(mesh!.geometry.getAttribute('position').count).toBeGreaterThan(0);
  });

  it('is units-safe — same world size in an mm scene and an m scene', () => {
    // 10 m run: mm-scene canvas units = 10000 (×0.001), m-scene = 10 (×1).
    const mm = wirePathToMesh(path(0, 0, 10_000, 0, 0), 0.001, 0, 0)!;
    const m = wirePathToMesh(path(0, 0, 10, 0, 0), 1, 0, 0)!;
    const sizeMm = worldSize(mm);
    const sizeM = worldSize(m);
    expect(sizeMm.x).toBeCloseTo(sizeM.x, 5);
    expect(sizeMm.x).toBeCloseTo(10, 1); // ~10 m + tube radius
  });

  it('places the run at the floor + base + mounting elevation (world Y)', () => {
    // zMm = 3000 (3m), floorElevationMm = 1000 (1m), baseElevationM = 5 → y ≈ 9 m.
    const mesh = wirePathToMesh(path(0, 0, 10, 0, 3000), 1, 1000, 5)!;
    mesh.geometry.computeBoundingBox();
    const center = mesh.geometry.boundingBox!.getCenter(new THREE.Vector3());
    expect(center.y).toBeCloseTo(9, 1);
  });

  it('tints the conduit with the circuit colour', () => {
    const mesh = wirePathToMesh(path(0, 0, 10, 0, 0, '#ff0000'), 1, 0, 0)!;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    expect(mat.color.getHex()).toBe(0xff0000);
  });

  it('ADR-408 Φ7 — colorBySystem=false falls back to the default wire material (not system-tinted)', () => {
    const mesh = wirePathToMesh(path(0, 0, 10, 0, 0, '#ff0000'), 1, 0, 0, false)!;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    // The default `elem-mep-wire` material colour, NOT the circuit's #ff0000.
    expect(mat.color.getHex()).toBe(0xb45309);
  });
});
