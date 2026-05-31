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
});
