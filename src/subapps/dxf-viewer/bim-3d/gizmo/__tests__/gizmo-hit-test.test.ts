/**
 * ADR-402 — gizmo-hit-test (ported from GenArc ADR-022). Priority resolution.
 */

import * as THREE from 'three';
import { testGizmoHit, type GizmoHitTestSet } from '../gizmo-hit-test';
import type { GizmoHandleId } from '../gizmo-types';

function box(at: THREE.Vector3): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
  m.position.copy(at);
  m.updateMatrixWorld(true);
  return m;
}

function rayDownZ(): THREE.Raycaster {
  const rc = new THREE.Raycaster();
  rc.set(new THREE.Vector3(0, 0, 10), new THREE.Vector3(0, 0, -1));
  return rc;
}

describe('gizmo-hit-test priority', () => {
  it('rotate ring wins over a nearer axis hitbox', () => {
    const axis = box(new THREE.Vector3(0, 0, 0));   // nearer (distance ~9)
    const ring = box(new THREE.Vector3(0, 0, -5));   // farther (distance ~14)
    const set: GizmoHitTestSet = {
      hitboxes: [axis, ring],
      hitboxToId: new Map<THREE.Mesh, GizmoHandleId>([[axis, 'axis-x'], [ring, 'rotate-y']]),
    };
    const hit = testGizmoHit(rayDownZ(), set);
    expect(hit?.handleId).toBe('rotate-y');
  });

  it('plane beats axis at equal distance ordering', () => {
    const axis = box(new THREE.Vector3(0, 0, -5));
    const plane = box(new THREE.Vector3(0, 0, 0));
    const set: GizmoHitTestSet = {
      hitboxes: [axis, plane],
      hitboxToId: new Map<THREE.Mesh, GizmoHandleId>([[axis, 'axis-z'], [plane, 'plane-xz']]),
    };
    const hit = testGizmoHit(rayDownZ(), set);
    expect(hit?.handleId).toBe('plane-xz');
  });

  it('returns null when nothing is hit', () => {
    const far = box(new THREE.Vector3(100, 100, 100));
    const set: GizmoHitTestSet = {
      hitboxes: [far],
      hitboxToId: new Map<THREE.Mesh, GizmoHandleId>([[far, 'axis-x']]),
    };
    expect(testGizmoHit(rayDownZ(), set)).toBeNull();
  });
});
