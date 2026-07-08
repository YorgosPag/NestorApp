/**
 * dxf-text-3d.rotation.test.ts — locks the SIGN of the 3D text plane's plan-spin (ADR-557
 * C-rotation). The flat text quad must lean EXACTLY like the 2D glyphs, i.e. a plane-local axis
 * must map to the DXF→world image of the SAME `R(entity.rotation)` the `text-box` SSoT uses.
 *
 * DXF→Three mapping (`DxfToThreeConverter`): (x, y) → (x, 0, −y). A CCW plan rotation θ sends the
 * text's local +x (baseline) to DXF (cosθ, sinθ) → world (cosθ, 0, −sinθ), and local +y (up) to
 * DXF (−sinθ, cosθ) → world (−sinθ, 0, −cosθ). The plane normal (+z) stays world +Y for any θ.
 *
 * Pure (no canvas / WebGL): exercises the real `orientTextPlane` quaternion, so a future flip of
 * the composition or the sign fails here at presubmit instead of only in the browser.
 */

import * as THREE from 'three';
import { orientTextPlane } from '../dxf-text-3d';

const DEG = Math.PI / 180;

/** Apply the production orientation, then return where a plane-local unit axis lands in world. */
function worldAxis(rotationDeg: number, localAxis: THREE.Vector3): THREE.Vector3 {
  const mesh = new THREE.Object3D();
  orientTextPlane(mesh, { rotation: rotationDeg });
  return localAxis.clone().applyQuaternion(mesh.quaternion);
}

function expectVecClose(actual: THREE.Vector3, x: number, y: number, z: number): void {
  expect(actual.x).toBeCloseTo(x, 6);
  expect(actual.y).toBeCloseTo(y, 6);
  expect(actual.z).toBeCloseTo(z, 6);
}

describe('orientTextPlane — 3D text plane leans like the 2D glyphs (ADR-557 C-rotation)', () => {
  const LOCAL_X = new THREE.Vector3(1, 0, 0);
  const LOCAL_Y = new THREE.Vector3(0, 1, 0);
  const LOCAL_Z = new THREE.Vector3(0, 0, 1);

  // θ = 0, ±90, 30, −45 cover identity, the axis-crossings, and a generic CCW/CW lean.
  for (const rotationDeg of [0, 30, 90, -45, 180]) {
    const t = rotationDeg * DEG;

    it(`baseline (local +x) maps to (cosθ, 0, −sinθ) at ${rotationDeg}°`, () => {
      expectVecClose(worldAxis(rotationDeg, LOCAL_X), Math.cos(t), 0, -Math.sin(t));
    });

    it(`up (local +y) maps to (−sinθ, 0, −cosθ) at ${rotationDeg}°`, () => {
      expectVecClose(worldAxis(rotationDeg, LOCAL_Y), -Math.sin(t), 0, -Math.cos(t));
    });

    it(`normal (local +z) stays world +Y at ${rotationDeg}°`, () => {
      expectVecClose(worldAxis(rotationDeg, LOCAL_Z), 0, 1, 0);
    });
  }

  it('θ = 0 is the pure flat-lay (rotateX(−90°)) — no accidental spin', () => {
    expectVecClose(worldAxis(0, LOCAL_X), 1, 0, 0);
    expectVecClose(worldAxis(0, LOCAL_Y), 0, 0, -1);
  });

  it('missing rotation is treated as 0 (defensive, mirrors the box SSoT)', () => {
    const mesh = new THREE.Object3D();
    orientTextPlane(mesh, {});
    expectVecClose(LOCAL_X.clone().applyQuaternion(mesh.quaternion), 1, 0, 0);
  });
});
