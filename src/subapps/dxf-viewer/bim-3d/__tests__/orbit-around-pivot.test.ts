import * as THREE from 'three';
import { orbitCameraAroundPivot } from '../viewport/orbit-around-pivot';

function cam(): THREE.PerspectiveCamera {
  const c = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  c.position.set(0, 0, 5);
  c.lookAt(0, 0, 0);
  c.updateMatrixWorld(true);
  return c;
}

/** Project a world point to NDC via the camera — used to assert "stays on screen". */
function toNdc(camera: THREE.PerspectiveCamera, p: THREE.Vector3): THREE.Vector3 {
  camera.updateMatrixWorld(true);
  return p.clone().project(camera);
}

describe('orbitCameraAroundPivot — rigid turntable, no recenter jump', () => {
  it('keeps distance to the pivot constant (it is a pure rotation about pivot)', () => {
    const c = cam();
    const pivot = new THREE.Vector3(1, 0, 0);
    const target = new THREE.Vector3(0, 0, 0);
    const d0 = c.position.distanceTo(pivot);
    orbitCameraAroundPivot(c, pivot, target, 60, 0, 0.01);
    expect(c.position.distanceTo(pivot)).toBeCloseTo(d0, 5);
  });

  it('leaves the PIVOT fixed on screen (same NDC before and after) — the no-jump invariant', () => {
    const c = cam();
    const pivot = new THREE.Vector3(0.8, 0.3, 0); // deliberately OFF-centre
    const target = new THREE.Vector3(0, 0, 0);
    const before = toNdc(c, pivot);
    orbitCameraAroundPivot(c, pivot, target, 45, 25, 0.01);
    const after = toNdc(c, pivot);
    expect(after.x).toBeCloseTo(before.x, 4);
    expect(after.y).toBeCloseTo(before.y, 4);
  });

  it('keeps the target on the camera forward axis (camera still looks at target → lookAt no-op)', () => {
    const c = cam();
    const pivot = new THREE.Vector3(0.8, 0.3, 0);
    const target = new THREE.Vector3(0, 0, 0);
    orbitCameraAroundPivot(c, pivot, target, 50, 30, 0.01);
    c.updateMatrixWorld(true);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion).normalize();
    const toTarget = target.clone().sub(c.position).normalize();
    expect(forward.dot(toTarget)).toBeCloseTo(1, 4); // forward ∥ (target − position)
  });

  it('horizontal drag yaws about world-up (camera height ~unchanged), pivot at origin', () => {
    const c = cam();
    const origin = new THREE.Vector3(0, 0, 0);
    orbitCameraAroundPivot(c, origin, origin, 80, 0, 0.01);
    expect(c.position.y).toBeCloseTo(0, 5); // pure yaw → no vertical drift
    expect(c.position.length()).toBeCloseTo(5, 5);
  });

  it('does not mutate the pivot vector', () => {
    const c = cam();
    const pivot = new THREE.Vector3(0.8, 0.3, 0);
    orbitCameraAroundPivot(c, pivot, new THREE.Vector3(0, 0, 0), 30, 20, 0.01);
    expect(pivot.x).toBeCloseTo(0.8, 6);
    expect(pivot.y).toBeCloseTo(0.3, 6);
  });
});
