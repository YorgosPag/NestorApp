/**
 * Tests for grip-3d-depth-occlusion-math (ADR-535 Φ5b) — the PURE slice of the GPU
 * depth-occlusion: world→probe projection, the shader-parity occlusion rule, RGBA decode,
 * and the probe slot→clip-X mapping.
 */

import * as THREE from 'three';
import {
  projectGripToProbe,
  isGripOccluded,
  decodeGripVisibility,
  probeSlotClipX,
} from '../grip-3d-depth-occlusion-math';

function perspectiveLookingDownNegZ(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  cam.position.set(0, 0, 10);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  return cam;
}

describe('projectGripToProbe', () => {
  it('maps a point on the camera axis to screen centre (u=v=0.5) with negative viewZ', () => {
    const cam = perspectiveLookingDownNegZ();
    const s = projectGripToProbe(new THREE.Vector3(0, 0, 0), cam);
    expect(s.u).toBeCloseTo(0.5, 5);
    expect(s.v).toBeCloseTo(0.5, 5);
    // origin is 10m in front of the camera → eye-space Z = −10.
    expect(s.viewZ).toBeCloseTo(-10, 5);
    expect(s.offscreen).toBe(false);
  });

  it('flags a point behind the camera as offscreen', () => {
    const cam = perspectiveLookingDownNegZ();
    const s = projectGripToProbe(new THREE.Vector3(0, 0, 100), cam);
    expect(s.offscreen).toBe(true);
  });

  it('flags a point outside the frustum sides as offscreen', () => {
    const cam = perspectiveLookingDownNegZ();
    const s = projectGripToProbe(new THREE.Vector3(1000, 0, 0), cam);
    expect(s.offscreen).toBe(true);
  });
});

describe('isGripOccluded', () => {
  const BIAS = 0.005; // 5 mm

  it('is NOT occluded when the grip is in front of the surface', () => {
    // grip nearer (viewZ −5) than surface (viewZ −8) → visible.
    expect(isGripOccluded(-5, -8, BIAS)).toBe(false);
  });

  it('IS occluded when the grip is well behind the surface', () => {
    // grip far (viewZ −8) behind surface (viewZ −5) → hidden.
    expect(isGripOccluded(-8, -5, BIAS)).toBe(true);
  });

  it('is NOT occluded for a coplanar self-surface within the bias band', () => {
    // grip resting on its own face: equal depth → bias keeps it visible.
    expect(isGripOccluded(-5, -5, BIAS)).toBe(false);
    // tiny float sink (1 mm) still inside the 5 mm bias → visible.
    expect(isGripOccluded(-5.001, -5, BIAS)).toBe(false);
  });

  it('crosses to occluded only once the gap exceeds the bias', () => {
    expect(isGripOccluded(-5.004, -5, BIAS)).toBe(false);
    expect(isGripOccluded(-5.006, -5, BIAS)).toBe(true);
  });
});

describe('decodeGripVisibility', () => {
  it('reads red >= 128 as visible, < 128 as occluded', () => {
    const bytes = new Uint8Array([255, 0, 0, 255, /* */ 0, 0, 0, 255]);
    expect(decodeGripVisibility(bytes, 2, [false, false])).toEqual([true, false]);
  });

  it('forces off-screen grips visible regardless of the byte', () => {
    const bytes = new Uint8Array([0, 0, 0, 255]);
    expect(decodeGripVisibility(bytes, 1, [true])).toEqual([true]);
  });

  it('treats the 128 boundary as visible', () => {
    const bytes = new Uint8Array([128, 0, 0, 255]);
    expect(decodeGripVisibility(bytes, 1, [false])).toEqual([true]);
  });
});

describe('probeSlotClipX', () => {
  it('centres each slot in its pixel column', () => {
    // count=4 → slot centres at pixels 0..3 → clip X = (i+0.5)/4*2-1.
    expect(probeSlotClipX(0, 4)).toBeCloseTo(-0.75, 6);
    expect(probeSlotClipX(3, 4)).toBeCloseTo(0.75, 6);
  });

  it('maps a single slot to clip-space centre 0', () => {
    expect(probeSlotClipX(0, 1)).toBeCloseTo(0, 6);
  });
});
