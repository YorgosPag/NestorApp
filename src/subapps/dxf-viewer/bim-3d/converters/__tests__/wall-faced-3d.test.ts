/**
 * ADR-539 Φ3c — wallToMesh faced (per-face appearance) tests.
 *
 * Ο τοίχος = ΚΑΤΑΚΟΡΥΦΟ prism (κλειστό footprint ring: outer forward + inner backward) →
 * render faced (multi-material, pickable per-face) όταν φέρει `faceAppearance` Ή είναι ο live
 * Polygon-Mode target, αλλιώς legacy single-material extrude (byte-for-byte). Το faced prism
 * έχει IDENTICAL local span [0, height] με το `extrudeAndRotate`, άρα η `position.y` (datum)
 * ΔΕΝ αλλάζει — mirror column Φ3a / foundation Φ1.5. MVP scope: ΜΟΝΟ ο απλός flat path
 * (single-layer straight, χωρίς ανοίγματα/profile).
 */

import * as THREE from 'three';
import { wallToMesh } from '../BimToThreeConverter';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import { usePolygonMode3DStore } from '../../stores/PolygonMode3DStore';
import type { WallEntity, WallParams } from '../../../bim/types/wall-types';
import type { FaceAppearanceMap } from '../../../bim/types/face-appearance-types';

function wallParams(overrides?: Partial<WallParams>): WallParams {
  return {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 5000, y: 0, z: 0 },
    height: 3000,
    thickness: 250,
    flip: false,
    baseBinding: 'storey-floor',
    topBinding: 'storey-ceiling',
    baseOffset: 0,
    topOffset: 0,
    ...overrides,
  } as WallParams;
}

/** Απλός single-layer straight τοίχος (χωρίς DNA/ανοίγματα/profile → simple flat path). */
function flatWall(faceAppearance?: FaceAppearanceMap): WallEntity {
  const params = wallParams();
  return {
    id: 'wall-1',
    type: 'wall',
    kind: 'straight',
    layerId: '0',
    params,
    geometry: computeWallGeometry(params, 'straight'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
    ...(faceAppearance ? { faceAppearance } : {}),
  } as unknown as WallEntity;
}

afterEach(() => usePolygonMode3DStore.getState().reset());

describe('wallToMesh — ADR-539 Φ3c faced (per-face appearance)', () => {
  it('renders a multi-material faced prism when faceAppearance carries a painted face', () => {
    const mesh = wallToMesh(flatWall({ top: { colorHex: '#C0392B' } })) as THREE.Mesh;
    expect(Array.isArray(mesh.material)).toBe(true);
    // bottom, top, side:0..n — the faceKey↔materialIndex SSoT survives onto userData.
    expect(mesh.userData['faceKeyByMaterialIndex']).toBeDefined();
    expect((mesh.userData['faceKeyByMaterialIndex'] as string[]).slice(0, 2)).toEqual(['bottom', 'top']);
  });

  it('keeps the IDENTICAL datum (position.y) as the legacy single-material path', () => {
    const legacy = wallToMesh(flatWall()) as THREE.Mesh;
    const faced = wallToMesh(flatWall({ 'side:0': { colorHex: '#123456' } })) as THREE.Mesh;
    expect(faced.position.y).toBeCloseTo(legacy.position.y, 6);
  });

  it('stays legacy single-material when faceAppearance is an empty map (byte-for-byte)', () => {
    const mesh = wallToMesh(flatWall({})) as THREE.Mesh;
    expect(Array.isArray(mesh.material)).toBe(false);
  });

  it('renders faced when it is the live Polygon-Mode target even without paint (chicken-and-egg)', () => {
    const wall = flatWall();
    usePolygonMode3DStore.getState().setActive(true, wall.id);
    expect(Array.isArray((wallToMesh(wall) as THREE.Mesh).material)).toBe(true);
  });

  it('stays legacy when a DIFFERENT solid is the Polygon-Mode target', () => {
    const wall = flatWall();
    usePolygonMode3DStore.getState().setActive(true, 'some-other-id');
    expect(Array.isArray((wallToMesh(wall) as THREE.Mesh).material)).toBe(false);
  });
});
