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
import { makeGripPlanToCanvas, GRIP_OFFSCREEN } from '../grip-3d-screen-project';

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
});
