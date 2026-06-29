/**
 * ADR-535 Φ5 — grip-3d-screen-project: plan(mm) → canvas-local(px) for the grip overlay.
 *
 * The Canvas2D grip overlay and the screen-space hit-test share ONE projector. These
 * locks pin it: a plan point in front of the camera lands at the expected canvas-local
 * pixel (the overlay's draw space, with the canvas rect subtracted — NOT client px), and
 * a point behind the camera returns the off-canvas sentinel so the batched draw paints it
 * out of view.
 */

import * as THREE from 'three';
import { makeGripPlanToCanvas, addGripWorldOffsets, GRIP_OFFSCREEN } from '../grip-3d-screen-project';

/** Minimal canvas stub — only `getBoundingClientRect` is read by `worldToScreen`. */
function fakeCanvas(left: number, top: number, width: number, height: number): HTMLElement {
  return {
    getBoundingClientRect: () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }),
  } as unknown as HTMLElement;
}

/** Perspective camera at (0,0,10) looking down −Z (origin centres on screen). */
function frontCamera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  cam.position.set(0, 0, 10);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}

describe('makeGripPlanToCanvas', () => {
  it('projects the on-axis plan point to the canvas centre (rect subtracted, not client px)', () => {
    const cam = frontCamera();
    const canvas = fakeCanvas(100, 50, 800, 600); // non-zero offset proves the rebase
    const project = makeGripPlanToCanvas(cam, canvas, () => 0);
    const s = project({ x: 0, y: 0 }); // dxfPlanToWorld(0,0,0) = world (0,0,0) → screen centre
    // Canvas-local centre = (width/2, height/2) regardless of the rect offset.
    expect(s.x).toBeCloseTo(400, 3);
    expect(s.y).toBeCloseTo(300, 3);
  });

  it('returns the off-canvas sentinel for a point behind the camera', () => {
    const cam = frontCamera();
    const canvas = fakeCanvas(0, 0, 800, 600);
    const project = makeGripPlanToCanvas(cam, canvas, () => 0);
    // plan (0,-20000) → world (0,0,20): behind a camera at z=10 facing −Z.
    expect(project({ x: 0, y: -20000 })).toBe(GRIP_OFFSCREEN);
  });

  it('lifts each point to its own elevation before projecting (elevFor consulted)', () => {
    const cam = frontCamera();
    const canvas = fakeCanvas(0, 0, 800, 600);
    const calls: Array<{ x: number; y: number }> = [];
    const project = makeGripPlanToCanvas(cam, canvas, (p) => { calls.push(p); return 0; });
    project({ x: 5, y: 7 });
    expect(calls).toEqual([{ x: 5, y: 7 }]);
  });

  it('rigidly shifts every grip by the live world offset (move-drag handle-follow)', () => {
    const cam = frontCamera();
    const canvas = fakeCanvas(0, 0, 800, 600);
    // ADR-535 Φ10 — a +0.5 world-X offset equals a +500mm plan-X shift (dxfPlanToWorld: x_mm*0.001),
    // so the on-axis grip projects to the SAME pixel as the un-offset grip at plan x=500.
    const viaOffset = makeGripPlanToCanvas(cam, canvas, () => 0, { x: 0.5, y: 0, z: 0 })({ x: 0, y: 0 });
    const viaPlan = makeGripPlanToCanvas(cam, canvas, () => 0)({ x: 500, y: 0 });
    expect(viaOffset.x).toBeCloseTo(viaPlan.x, 3);
    expect(viaOffset.y).toBeCloseTo(viaPlan.y, 3);
    expect(viaOffset.x).toBeGreaterThan(400); // actually moved right of centre
  });

  it('treats a null / omitted world offset as no shift (static + reshape paths)', () => {
    const cam = frontCamera();
    const canvas = fakeCanvas(0, 0, 800, 600);
    const omitted = makeGripPlanToCanvas(cam, canvas, () => 0)({ x: 0, y: 0 });
    const explicitNull = makeGripPlanToCanvas(cam, canvas, () => 0, null)({ x: 0, y: 0 });
    expect(omitted.x).toBeCloseTo(explicitNull.x, 6);
    expect(omitted.y).toBeCloseTo(explicitNull.y, 6);
    expect(explicitNull.x).toBeCloseTo(400, 3); // unchanged centre
  });
});

describe('addGripWorldOffsets — stack live move + battered-wall tilt shear (ADR-535 Φ11)', () => {
  it('sums two offsets component-wise', () => {
    expect(addGripWorldOffsets({ x: 1, y: 2, z: 3 }, { x: 10, y: 20, z: 30 }))
      .toEqual({ x: 11, y: 22, z: 33 });
  });

  it('returns the other operand when one is null (no allocation of a zero offset)', () => {
    const a = { x: 1, y: 2, z: 3 };
    expect(addGripWorldOffsets(a, null)).toBe(a);
    expect(addGripWorldOffsets(null, a)).toBe(a);
  });

  it('returns null when BOTH are absent (vertical wall, static → no offset work)', () => {
    expect(addGripWorldOffsets(null, null)).toBeNull();
    expect(addGripWorldOffsets(undefined, undefined)).toBeNull();
  });
});
