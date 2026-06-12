/**
 * ADR-363 Φ1G.5 — surface-anchored zoom math (Revit-grade, no punch-through).
 */

import * as THREE from 'three';
import { computeSurfaceDolly, computeSurfaceZoomPose, wheelZoomFactor } from '../viewport-zoom-surface';

const MARGIN = 0.12;
const MAX = 500;
const distTo = (a: THREE.Vector3, b: THREE.Vector3) => a.distanceTo(b);

describe('computeSurfaceDolly', () => {
  it('zoom IN moves the camera toward the surface (distance × factor)', () => {
    const cam = new THREE.Vector3(0, 0, 0);
    const hit = new THREE.Vector3(0, 0, 10); // dist 10
    const pos = computeSurfaceDolly(cam, hit, 0.85, MARGIN, MAX);
    expect(distTo(pos, hit)).toBeCloseTo(8.5, 6); // 10 × 0.85
    expect(pos.z).toBeCloseTo(1.5, 6);            // moved 1.5 toward the hit
  });

  it('the step SHRINKS as you approach (proportional, asymptotic)', () => {
    const hit = new THREE.Vector3(0, 0, 0);
    const far = computeSurfaceDolly(new THREE.Vector3(0, 0, 10), hit, 0.85, MARGIN, MAX);
    const near = computeSurfaceDolly(new THREE.Vector3(0, 0, 1), hit, 0.85, MARGIN, MAX);
    const farStep = 10 - distTo(far, hit);   // ≈1.5
    const nearStep = 1 - distTo(near, hit);  // ≈0.15
    expect(nearStep).toBeLessThan(farStep);
    expect(nearStep).toBeCloseTo(0.15, 6);
  });

  it('CLAMPS at the margin — zoom IN can never cross into the surface', () => {
    const cam = new THREE.Vector3(0, 0, 0);
    const hit = new THREE.Vector3(0, 0, 0.13); // just outside the 0.12 margin
    const pos = computeSurfaceDolly(cam, hit, 0.85, MARGIN, MAX); // 0.13×0.85=0.1105 < margin
    expect(distTo(pos, hit)).toBeCloseTo(MARGIN, 6); // clamped to 0.12, not 0.1105
  });

  it('does not move when already at the margin (no overshoot through the face)', () => {
    const cam = new THREE.Vector3(0, 0, 0);
    const hit = new THREE.Vector3(0, 0, MARGIN);
    const pos = computeSurfaceDolly(cam, hit, 0.85, MARGIN, MAX);
    expect(distTo(pos, hit)).toBeCloseTo(MARGIN, 6);
    expect(pos.z).toBeCloseTo(0, 6);
  });

  it('zoom OUT moves the camera away from the surface', () => {
    const cam = new THREE.Vector3(0, 0, 0);
    const hit = new THREE.Vector3(0, 0, 10);
    const pos = computeSurfaceDolly(cam, hit, 1.2, MARGIN, MAX);
    expect(distTo(pos, hit)).toBeCloseTo(12, 6); // 10 × 1.2
    expect(pos.z).toBeCloseTo(-2, 6);            // receded
  });

  it('caps zoom-out at maxDist', () => {
    const cam = new THREE.Vector3(0, 0, 0);
    const hit = new THREE.Vector3(0, 0, 400);
    const pos = computeSurfaceDolly(cam, hit, 10, MARGIN, MAX); // would be 4000 → capped 500
    expect(distTo(pos, hit)).toBeCloseTo(MAX, 4);
  });

  it('returns the camera unchanged when it sits on the surface (degenerate)', () => {
    const cam = new THREE.Vector3(5, 5, 5);
    const pos = computeSurfaceDolly(cam, cam.clone(), 0.85, MARGIN, MAX);
    expect(pos.equals(cam)).toBe(true);
  });

  it('never mutates the input camera position', () => {
    const cam = new THREE.Vector3(0, 0, 0);
    computeSurfaceDolly(cam, new THREE.Vector3(0, 0, 10), 0.85, MARGIN, MAX);
    expect(cam.equals(new THREE.Vector3(0, 0, 0))).toBe(true);
  });
});

describe('computeSurfaceZoomPose (no recenter jump — view direction preserved)', () => {
  // Off-axis cursor: camera looks down +Z at `target`, but the hit is off to the side.
  const camPos = () => new THREE.Vector3(0, 0, 0);
  const target = () => new THREE.Vector3(0, 0, 10);     // view direction = +Z
  const hit = () => new THREE.Vector3(4, 0, 8);          // off-axis surface point

  it('keeps the camera→target view direction UNCHANGED (no lookAt re-aim → no jump)', () => {
    const dirBefore = target().sub(camPos()).normalize();
    const pose = computeSurfaceZoomPose(camPos(), target(), hit(), 0.85, MARGIN, MAX);
    const dirAfter = pose.target.clone().sub(pose.position).normalize();
    expect(dirAfter.x).toBeCloseTo(dirBefore.x, 9);
    expect(dirAfter.y).toBeCloseTo(dirBefore.y, 9);
    expect(dirAfter.z).toBeCloseTo(dirBefore.z, 9);
  });

  it('slides the target by exactly the camera translation', () => {
    const pose = computeSurfaceZoomPose(camPos(), target(), hit(), 0.85, MARGIN, MAX);
    const camDelta = pose.position.clone().sub(camPos());
    const tgtDelta = pose.target.clone().sub(target());
    expect(tgtDelta.distanceTo(camDelta)).toBeCloseTo(0, 9);
  });

  it('keeps the hit anchored: the camera moves ALONG the cam→hit ray', () => {
    const pose = computeSurfaceZoomPose(camPos(), target(), hit(), 0.85, MARGIN, MAX);
    const rayDir = hit().sub(camPos()).normalize();
    const moveDir = pose.position.clone().sub(camPos()).normalize();
    expect(moveDir.distanceTo(rayDir)).toBeCloseTo(0, 9); // colinear → hit stays under cursor
  });

  it('never mutates the input position or target', () => {
    const p = camPos(); const t = target();
    computeSurfaceZoomPose(p, t, hit(), 0.85, MARGIN, MAX);
    expect(p.equals(new THREE.Vector3(0, 0, 0))).toBe(true);
    expect(t.equals(new THREE.Vector3(0, 0, 10))).toBe(true);
  });
});

describe('wheelZoomFactor (browser deltaY convention)', () => {
  it('wheel UP (deltaY < 0) → factor < 1 (zoom IN)', () => {
    expect(wheelZoomFactor(-100, 0.95, 0.01, 1)).toBeCloseTo(0.95, 6); // 0.95^1
  });

  it('wheel DOWN (deltaY > 0) → factor > 1 (zoom OUT)', () => {
    expect(wheelZoomFactor(100, 0.95, 0.01, 1)).toBeGreaterThan(1);
  });

  it('zoomSpeed scales the step magnitude', () => {
    const slow = wheelZoomFactor(-100, 0.95, 0.01, 0.5);
    const fast = wheelZoomFactor(-100, 0.95, 0.01, 2);
    expect(fast).toBeLessThan(slow); // faster = smaller factor = bigger zoom-in per notch
  });
});
