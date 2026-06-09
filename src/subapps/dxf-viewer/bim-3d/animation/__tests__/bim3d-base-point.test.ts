/**
 * ADR-408 — pickEntityBasePoint (relocatable gizmo base point / rotation centre).
 *
 * Verifies the snap-pick targets ONLY the selected entity's own meshes (so a Ctrl+click
 * can't grab a neighbour) and returns a world point on a hit, null on a miss. Exercised
 * black-box through a real THREE scene + camera (the same `pickDim3DSnap` SSoT prod uses).
 */

import * as THREE from 'three';
import { pickEntityBasePoint } from '../bim3d-base-point';

function makeTaggedMesh(bimId: string): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  mesh.userData['bimId'] = bimId;
  return mesh;
}

/** A fake canvas element — only `getBoundingClientRect` is read by the snap adapter. */
const fakeDom = {
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
} as unknown as HTMLElement;

function frontCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  return camera;
}

describe('pickEntityBasePoint — entity-scoped snap pick (ADR-408)', () => {
  it('returns a finite world point when the cursor hits the selected entity', () => {
    const group = new THREE.Group();
    group.add(makeTaggedMesh('wall-1'));
    group.updateMatrixWorld(true);

    const point = pickEntityBasePoint({
      group,
      camera: frontCamera(),
      domElement: fakeDom,
      entityIds: ['wall-1'],
      clientX: 50,
      clientY: 50, // centre of the rect → ray straight down -Z into the box
    });

    expect(point).not.toBeNull();
    expect(Number.isFinite(point!.x)).toBe(true);
    expect(Number.isFinite(point!.y)).toBe(true);
    expect(Number.isFinite(point!.z)).toBe(true);
  });

  it('returns null when no mesh belongs to the edited selection (cannot grab a neighbour)', () => {
    const group = new THREE.Group();
    group.add(makeTaggedMesh('other-9')); // present in the scene, but NOT selected
    group.updateMatrixWorld(true);

    const point = pickEntityBasePoint({
      group,
      camera: frontCamera(),
      domElement: fakeDom,
      entityIds: ['wall-1'],
      clientX: 50,
      clientY: 50,
    });

    expect(point).toBeNull();
  });

  it('returns null on a miss (cursor off the entity geometry)', () => {
    const group = new THREE.Group();
    group.add(makeTaggedMesh('wall-1'));
    group.updateMatrixWorld(true);

    const point = pickEntityBasePoint({
      group,
      camera: frontCamera(),
      domElement: fakeDom,
      entityIds: ['wall-1'],
      clientX: 0,
      clientY: 0, // top-left corner of the rect → ray misses the unit box
    });

    expect(point).toBeNull();
  });
});
