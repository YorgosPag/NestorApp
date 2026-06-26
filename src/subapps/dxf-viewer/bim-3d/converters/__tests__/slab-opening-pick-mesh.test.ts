/**
 * ADR-535 Φ3b — `slabOpeningPickMesh`: the invisible pickable mesh that makes a slab
 * opening (a void) single-selectable in 3D, so its reshape grips can surface.
 *
 * Verifies it: (1) is tagged with the opening's `bimId` + `bimType='slab-opening'`
 * (the raycaster keys off these), (2) is invisible-but-pickable (zero opacity, NOT
 * `visible:false` — the raycaster only skips invisible objects), (3) sits at the host
 * slab's top datum (so a click in the hole hits it), (4) returns null on a degenerate
 * outline.
 */

import * as THREE from 'three';
import { slabOpeningPickMesh } from '../slab-opening-pick-mesh';
import { hangDownMeshY } from '../bim-three-shape-helpers';
import type { SlabEntity, SlabParams } from '../../../bim/types/slab-types';
import type { SlabOpeningEntity, SlabOpeningParams } from '../../../bim/types/slab-opening-types';

function host(): SlabEntity {
  const params: SlabParams = {
    kind: 'floor',
    outline: { vertices: [
      { x: 0, y: 0, z: 0 }, { x: 6000, y: 0, z: 0 }, { x: 6000, y: 5000, z: 0 }, { x: 0, y: 5000, z: 0 },
    ] },
    levelElevation: 3000,
    thickness: 200,
    geometryType: 'box',
    sceneUnits: 'mm',
  } as SlabParams;
  return { id: 'sl', type: 'slab', kind: 'floor', ifcType: 'IfcSlab', layerId: '0', params, geometry: {} } as unknown as SlabEntity;
}

function opening(verts = [
  { x: 1000, y: 1000, z: 0 }, { x: 2500, y: 1000, z: 0 }, { x: 2500, y: 2200, z: 0 }, { x: 1000, y: 2200, z: 0 },
]): SlabOpeningEntity {
  const params = { kind: 'shaft', slabId: 'sl', outline: { vertices: verts }, sceneUnits: 'mm' } as SlabOpeningParams;
  return { id: 'op', type: 'slab-opening', kind: 'shaft', layerId: '0', params } as unknown as SlabOpeningEntity;
}

describe('slabOpeningPickMesh (ADR-535 Φ3b)', () => {
  it('tags the mesh with the opening bimId + bimType=slab-opening (raycast selection keys)', () => {
    const mesh = slabOpeningPickMesh(opening(), host());
    expect(mesh).not.toBeNull();
    expect(mesh!.userData['bimId']).toBe('op');
    expect(mesh!.userData['bimType']).toBe('slab-opening');
  });

  it('is invisible but pickable (opacity 0, visible !== false)', () => {
    const mesh = slabOpeningPickMesh(opening(), host())!;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBe(0);
    expect(mesh.visible).not.toBe(false); // THREE skips visible:false in raycasts.
    expect(mesh.castShadow).toBe(false);
  });

  it('sits at the host slab top datum (bottom = hangDownMeshY for the slab thickness)', () => {
    const baseM = 0.5;
    const mesh = slabOpeningPickMesh(opening(), host(), 'lvl', baseM, 0)!;
    const expectedY = hangDownMeshY(0, 3000, 200 * 0.001, baseM);
    expect(mesh.position.y).toBeCloseTo(expectedY, 6);
    expect(mesh.userData['levelId']).toBe('lvl');
  });

  it('returns null for a degenerate outline (< 3 vertices)', () => {
    expect(slabOpeningPickMesh(opening([{ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }]), host())).toBeNull();
  });
});
