/**
 * ADR-535 Φ1 — grip-plane-projection: ray ∩ horizontal plane → plan-mm delta.
 *
 * The 3D reshape grips project the mouse ray onto ONE horizontal world plane (the
 * slab top). These locks pin the math: a downward ray hits the plane at the expected
 * world point, an edge-on ray returns null, and the world delta maps to the correct
 * DXF plan-mm delta (1 world metre = 1000 mm; world.z = −y_mm·0.001).
 */

import * as THREE from 'three';
import { intersectRayHorizontalPlane, planDeltaMm } from '../grip-plane-projection';

describe('intersectRayHorizontalPlane', () => {
  it('hits the plane straight below a downward ray', () => {
    const origin = new THREE.Vector3(2, 5, -3);
    const dir = new THREE.Vector3(0, -1, 0); // straight down
    const hit = intersectRayHorizontalPlane(origin, dir, 1);
    expect(hit).not.toBeNull();
    expect(hit!.x).toBeCloseTo(2, 6);
    expect(hit!.y).toBeCloseTo(1, 6);
    expect(hit!.z).toBeCloseTo(-3, 6);
  });

  it('projects an angled ray onto the plane', () => {
    const origin = new THREE.Vector3(0, 4, 0);
    const dir = new THREE.Vector3(1, -1, 0).normalize(); // 45° down-east
    const hit = intersectRayHorizontalPlane(origin, dir, 0);
    expect(hit).not.toBeNull();
    expect(hit!.x).toBeCloseTo(4, 6); // descended 4m in y → travelled 4m in x
    expect(hit!.y).toBeCloseTo(0, 6);
  });

  it('returns null for a ray parallel to the plane (edge-on view)', () => {
    const origin = new THREE.Vector3(0, 3, 0);
    const dir = new THREE.Vector3(1, 0, 0); // horizontal → never crosses y = 0
    expect(intersectRayHorizontalPlane(origin, dir, 0)).toBeNull();
  });
});

describe('planDeltaMm', () => {
  it('maps a +X / −Z world move to +x / +y plan mm', () => {
    const from = new THREE.Vector3(1, 2, -1);
    const to = new THREE.Vector3(1.5, 2, -1.25); // +0.5m east, +0.25m north (z more negative)
    const d = planDeltaMm(from, to);
    expect(d.x).toBeCloseTo(500, 6);
    expect(d.y).toBeCloseTo(250, 6);
  });

  it('is zero for a same-point move', () => {
    const p = new THREE.Vector3(3, 1, 2);
    const d = planDeltaMm(p, p.clone());
    expect(d.x).toBe(0);
    expect(d.y).toBe(0);
  });
});
