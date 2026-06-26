/**
 * ADR-535 Φ5 — grip-3d-occlusion: only front-most grips are visible/pickable.
 *
 * Giorgio: a grip hidden behind another entity must not show. These locks pin the depth
 * test: geometry between the camera and the grip occludes it; geometry behind the grip (or
 * the grip's own surface) does not; a null occluder group never occludes.
 */

import * as THREE from 'three';
import { isGripOccluded } from '../grip-3d-occlusion';

/** Camera at (0,0,10) looking down −Z; a grip world point sits at the origin (dist 10). */
function camera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  cam.position.set(0, 0, 10);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  return cam;
}

/** A thin planar occluder at depth `z` (≈ a surface the ray crosses there). */
function surfaceAt(z: number): THREE.Group {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 0.001), new THREE.MeshBasicMaterial());
  mesh.position.set(0, 0, z);
  group.add(mesh);
  group.updateMatrixWorld(true);
  return group;
}

const GRIP = new THREE.Vector3(0, 0, 0);

describe('isGripOccluded', () => {
  it('occludes a grip with geometry in front of it', () => {
    expect(isGripOccluded(GRIP, camera(), surfaceAt(5))).toBe(true); // surface between camera and grip
  });

  it('does NOT occlude a grip with geometry behind it', () => {
    expect(isGripOccluded(GRIP, camera(), surfaceAt(-5))).toBe(false); // surface past the grip
  });

  it('does NOT count the grip own surface (surface at the grip)', () => {
    expect(isGripOccluded(GRIP, camera(), surfaceAt(0))).toBe(false); // within the self-surface epsilon
  });

  it('never occludes with a null occluder group', () => {
    expect(isGripOccluded(GRIP, camera(), null)).toBe(false);
  });
});
