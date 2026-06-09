/**
 * ADR-402 — gizmo-projection (ported from GenArc ADR-022). Pure math, no mocks.
 */

import * as THREE from 'three';
import {
  projectOntoAxis,
  projectOntoPlane,
  projectConstrained,
} from '../gizmo-projection';

const down = new THREE.Vector3(0, -1, 0);
const camDir = new THREE.Vector3(0, -0.5, -0.5).normalize();

describe('gizmo-projection', () => {
  it('projectOntoPlane — vertical ray hits the ground plane at the cursor XZ', () => {
    const p = projectOntoPlane(
      new THREE.Vector3(2, 10, 3), down,
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0),
    );
    expect(p).not.toBeNull();
    expect(p!.x).toBeCloseTo(2, 6);
    expect(p!.y).toBeCloseTo(0, 6);
    expect(p!.z).toBeCloseTo(3, 6);
  });

  it('projectOntoPlane — returns null for a ray parallel to the plane', () => {
    const p = projectOntoPlane(
      new THREE.Vector3(0, 5, 0), new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0),
    );
    expect(p).toBeNull();
  });

  it('projectOntoAxis — closest point on the X axis to a vertical ray', () => {
    const p = projectOntoAxis(
      new THREE.Vector3(4, 10, 0), down,
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0),
    );
    expect(p.x).toBeCloseTo(4, 6);
    expect(p.y).toBeCloseTo(0, 6);
    expect(p.z).toBeCloseTo(0, 6);
  });

  it('projectConstrained axis-x — keeps movement on the X axis (z stays 0)', () => {
    const p = projectConstrained(
      new THREE.Vector3(5, 10, 7), down,
      new THREE.Vector3(0, 0, 0), { kind: 'axis', axis: 'x' }, camDir,
    );
    expect(p.x).toBeCloseTo(5, 6);
    expect(p.z).toBeCloseTo(0, 6);
  });

  it('projectConstrained plane-xz — keeps the drag on the floor (y = anchor y)', () => {
    const p = projectConstrained(
      new THREE.Vector3(5, 10, 7), down,
      new THREE.Vector3(0, 0, 0), { kind: 'plane', plane: 'xz' }, camDir,
    );
    expect(p.x).toBeCloseTo(5, 6);
    expect(p.y).toBeCloseTo(0, 6);
    expect(p.z).toBeCloseTo(7, 6);
  });

  it('projectConstrained free — projects onto the ground plane', () => {
    const p = projectConstrained(
      new THREE.Vector3(-3, 8, 2), down,
      new THREE.Vector3(0, 0, 0), { kind: 'free' }, camDir,
    );
    expect(p.x).toBeCloseTo(-3, 6);
    expect(p.y).toBeCloseTo(0, 6);
    expect(p.z).toBeCloseTo(2, 6);
  });

  // ADR-408 Φ1 — a wall/beam length handle is `'horizontal'`: it drags on the GROUND
  // plane through the endpoint, so the world Y stays the anchor's elevation (the run is
  // a plan dimension; the height is a separate handle/Type). A vertical down-ray hits the
  // y = anchor.y plane at the cursor XZ.
  it("projectConstrained endpoint 'horizontal' — keeps Y at the anchor (plan-only length edit)", () => {
    const anchor = new THREE.Vector3(0, 5, 0);
    const p = projectConstrained(
      new THREE.Vector3(8, 12, 3), down,
      anchor, { kind: 'endpoint', endpoint: 'start', mode: 'horizontal' }, camDir,
    );
    expect(p.x).toBeCloseTo(8, 6);
    expect(p.y).toBeCloseTo(5, 6); // unchanged → no elevation drift on a wall/beam end-drag
    expect(p.z).toBeCloseTo(3, 6);
  });

  // ADR-408 Φ-D — a pipe end is `'free-3d'`: it drags on the CAMERA-FACING plane, so a
  // single drag yields BOTH plan + elevation. The result equals the camera-plane projection
  // (Y is NOT pinned to the anchor, unlike the horizontal wall/beam mode).
  it("projectConstrained endpoint 'free-3d' — projects onto the camera-facing plane (plan + elevation)", () => {
    const anchor = new THREE.Vector3(0, 5, 0);
    const ray = new THREE.Vector3(8, 12, 3);
    const p = projectConstrained(
      ray, down, anchor, { kind: 'endpoint', endpoint: 'start', mode: 'free-3d' }, camDir,
    );
    const expected = projectOntoPlane(ray, down, anchor, camDir)!;
    expect(p.x).toBeCloseTo(expected.x, 6);
    expect(p.y).toBeCloseTo(expected.y, 6);
    expect(p.z).toBeCloseTo(expected.z, 6);
    // The camera-facing plane tilts away from horizontal → Y leaves the anchor elevation.
    expect(Math.abs(p.y - anchor.y)).toBeGreaterThan(1e-3);
  });
});
