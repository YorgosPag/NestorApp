/**
 * ADR-539 Φ3b — roofToMesh per-«νερό» faced (per-face appearance) tests.
 *
 * Το roof = `THREE.Group` με (≥1) mesh ανά «νερό». Σε Polygon Mode (faced) κάθε mesh ενός
 * νερού γίνεται pickable με faceKey `sub:${i}:top` (single-material → materialIndex 0) και,
 * αν το νερό έχει βαφή, το flat painted material αντικαθιστά το legacy κεραμίδι. Μη-faced
 * roof → καμία αλλαγή (legacy· κανένα `faceKeyByMaterialIndex` στα meshes).
 */

import * as THREE from 'three';
import { roofToMesh } from '../roof-to-three';
import { computeRoofGeometry, validateRoofParams, applyRoofShapePreset } from '../../../bim/geometry/roof-geometry';
import { usePolygonMode3DStore } from '../../stores/PolygonMode3DStore';
import type { Polygon3D, Point3D } from '../../../bim/types/bim-base';
import type { RoofEntity, RoofParams } from '../../../bim/types/roof-types';
import type { FaceAppearanceMap } from '../../../bim/types/face-appearance-types';

const rect: Polygon3D = {
  vertices: [
    { x: 0, y: 0, z: 0 },
    { x: 4000, y: 0, z: 0 },
    { x: 4000, y: 3000, z: 0 },
    { x: 0, y: 3000, z: 0 },
  ] as Point3D[],
};

function gableParams(): RoofParams {
  return {
    outline: rect,
    edges: applyRoofShapePreset(rect, 'gable', 30, 'deg'),
    slopeUnit: 'deg',
    basePivotZ: 3000,
    thickness: 200,
    sceneUnits: 'mm',
  };
}

function makeRoof(faceAppearance?: FaceAppearanceMap): RoofEntity {
  const params = gableParams();
  return {
    id: 'roof-1',
    type: 'roof',
    kind: 'roof',
    layerId: '0',
    params,
    geometry: computeRoofGeometry(params),
    validation: validateRoofParams(params).bimValidation,
    visible: true,
    ...(faceAppearance ? { faceAppearance } : {}),
  } as RoofEntity;
}

/** Όλα τα face meshes (απευθείας children που φέρουν faceKeyByMaterialIndex). */
function facedMeshes(group: THREE.Group): THREE.Mesh[] {
  return group.children.filter(
    (c): c is THREE.Mesh => (c as THREE.Mesh).isMesh && c.userData['faceKeyByMaterialIndex'] !== undefined,
  );
}

afterEach(() => usePolygonMode3DStore.getState().reset());

describe('roofToMesh — ADR-539 Φ3b per-«νερό» faced', () => {
  it('does NOT tag faces when the roof is not in Polygon Mode (legacy, byte-for-byte)', () => {
    const group = roofToMesh(makeRoof(), 'l', 0)!;
    expect(group).not.toBeNull();
    expect(facedMeshes(group).length).toBe(0);
  });

  it('tags every νερό with a distinct `sub:${i}:top` faceKey when it is the live Polygon-Mode target', () => {
    const roof = makeRoof();
    usePolygonMode3DStore.getState().setActive(true, roof.id);
    const meshes = facedMeshes(roofToMesh(roof, 'l', 0)!);
    expect(meshes.length).toBeGreaterThan(0);
    const keys = new Set(meshes.map((m) => (m.userData['faceKeyByMaterialIndex'] as string[])[0]));
    // a gable roof has ≥2 νερά → ≥2 distinct sub:i:top keys, all of the `sub:N:top` form.
    expect(keys.size).toBeGreaterThanOrEqual(2);
    for (const k of keys) expect(k).toMatch(/^sub:\d+:top$/);
  });

  it('paints the νερό whose `sub:i:top` carries a colour (flat material overrides the tile look)', () => {
    const group = roofToMesh(makeRoof({ 'sub:0:top': { colorHex: '#C0392B' } }), 'l', 0)!;
    const painted = facedMeshes(group).filter(
      (m) => (m.userData['faceKeyByMaterialIndex'] as string[])[0] === 'sub:0:top',
    );
    expect(painted.length).toBeGreaterThan(0);
    const mat = painted[0].material as THREE.MeshStandardMaterial;
    expect(mat.color.getHexString()).toBe('c0392b');
  });

  it('leaves the OTHER νερά unpainted (only sub:0 was coloured)', () => {
    const group = roofToMesh(makeRoof({ 'sub:0:top': { colorHex: '#C0392B' } }), 'l', 0)!;
    const others = facedMeshes(group).filter(
      (m) => (m.userData['faceKeyByMaterialIndex'] as string[])[0] !== 'sub:0:top',
    );
    expect(others.length).toBeGreaterThan(0);
    for (const m of others) {
      expect((m.material as THREE.MeshStandardMaterial).color.getHexString()).not.toBe('c0392b');
    }
  });
});
