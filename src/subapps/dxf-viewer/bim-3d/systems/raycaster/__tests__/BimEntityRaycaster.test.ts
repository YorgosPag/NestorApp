import * as THREE from 'three';
import { raycastWorldPoint, raycastWorldPointOrPlane, raycastBimGroup } from '../BimEntityRaycaster';

function mockDom(width = 100, height = 100): HTMLElement {
  return {
    getBoundingClientRect: () => ({
      left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0,
      toJSON: () => ({}),
    }),
  } as unknown as HTMLElement;
}

function cameraLookingAtOrigin(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  cam.position.set(0, 0, 5);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  return cam;
}

/** Oblique camera ABOVE the floor, looking down at the origin — the realistic
 *  3D-viewer pose where a DXF floor-plan click should pivot on the Y=0 plane. */
function cameraAboveLookingDown(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  cam.position.set(0, 5, 5);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  return cam;
}

describe('raycastWorldPoint — ADR-366 §A.6.Q5 orbit-pivot picking', () => {
  it('returns the world point of the front face hit at viewport center', () => {
    const group = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    box.position.set(0, 0, 0);
    group.add(box);
    box.updateMatrixWorld(true);

    const point = raycastWorldPoint(group, cameraLookingAtOrigin(), mockDom(), 50, 50);

    expect(point).not.toBeNull();
    expect(point!.x).toBeCloseTo(0, 5);
    expect(point!.y).toBeCloseTo(0, 5);
    // Box half-extent on +Z = 0.5 → closest face toward camera at z = 0.5.
    expect(point!.z).toBeCloseTo(0.5, 5);
  });

  it('returns null when the ray misses all geometry', () => {
    const group = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    box.position.set(100, 100, 0); // far off the central ray
    group.add(box);
    box.updateMatrixWorld(true);

    const point = raycastWorldPoint(group, cameraLookingAtOrigin(), mockDom(), 50, 50);
    expect(point).toBeNull();
  });

  it('returns null when the dom element has zero area (not laid out)', () => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    const point = raycastWorldPoint(group, cameraLookingAtOrigin(), mockDom(0, 0), 50, 50);
    expect(point).toBeNull();
  });

  it('returns a fresh cloned Vector3 (safe to retain as pivot)', () => {
    const group = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    group.add(box);
    box.updateMatrixWorld(true);

    const a = raycastWorldPoint(group, cameraLookingAtOrigin(), mockDom(), 50, 50);
    const b = raycastWorldPoint(group, cameraLookingAtOrigin(), mockDom(), 50, 50);
    expect(a).not.toBe(b); // distinct instances, not a shared module-level scratch
  });
});

describe('raycastWorldPointOrPlane — Alt-pivot with plane fallback (v3)', () => {
  it('returns the geometry hit when the ray hits a mesh', () => {
    const group = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    group.add(box);
    box.updateMatrixWorld(true);

    const fallback = new THREE.Vector3(0, 0, 0);
    const point = raycastWorldPointOrPlane(group, cameraLookingAtOrigin(), mockDom(), 50, 50, fallback);
    expect(point!.z).toBeCloseTo(0.5, 5); // front face, NOT the fallback plane
  });

  it('falls back to a camera-facing plane through the target when geometry is missed', () => {
    const group = new THREE.Group(); // empty → ray hits nothing
    const fallback = new THREE.Vector3(0, 0, 0);
    // Centre click, camera looks down -Z from z=5 → plane (normal -Z thru origin) hit at origin.
    const point = raycastWorldPointOrPlane(group, cameraLookingAtOrigin(), mockDom(), 50, 50, fallback);
    expect(point).not.toBeNull();
    expect(point!.z).toBeCloseTo(0, 5);
  });

  it('fallback plane tracks the cursor (off-centre click → off-centre pivot)', () => {
    const group = new THREE.Group();
    const fallback = new THREE.Vector3(0, 0, 0);
    const centre = raycastWorldPointOrPlane(group, cameraLookingAtOrigin(), mockDom(), 50, 50, fallback)!;
    const right = raycastWorldPointOrPlane(group, cameraLookingAtOrigin(), mockDom(), 90, 50, fallback)!;
    expect(right.x).toBeGreaterThan(centre.x);
  });

  it('returns null for a zero-area canvas', () => {
    const point = raycastWorldPointOrPlane(
      new THREE.Group(), cameraLookingAtOrigin(), mockDom(0, 0), 50, 50, new THREE.Vector3(),
    );
    expect(point).toBeNull();
  });
});

describe('raycastWorldPointOrPlane — DXF floor-plane fallback (v5, groundY)', () => {
  const fallback = new THREE.Vector3(0, 0, 0);

  it('falls back to the horizontal floor plane at groundY on a geometry miss', () => {
    const point = raycastWorldPointOrPlane(
      new THREE.Group(), cameraAboveLookingDown(), mockDom(), 50, 50, fallback, 0,
    );
    expect(point).not.toBeNull();
    // Centre click from an above-looking camera lands on the Y=0 floor at origin.
    expect(point!.y).toBeCloseTo(0, 5);
  });

  it('floor pivot tracks the cursor at constant floor depth (y stays on the plane)', () => {
    const cam = cameraAboveLookingDown();
    const near = raycastWorldPointOrPlane(new THREE.Group(), cam, mockDom(), 50, 90, fallback, 0)!;
    const far = raycastWorldPointOrPlane(new THREE.Group(), cam, mockDom(), 50, 10, fallback, 0)!;
    expect(near.y).toBeCloseTo(0, 5);
    expect(far.y).toBeCloseTo(0, 5);
    // Higher on screen (smaller clientY) looks farther across the floor (more −Z).
    expect(far.z).toBeLessThan(near.z);
  });

  it('a geometry hit still wins over the floor plane', () => {
    const group = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    group.add(box);
    box.updateMatrixWorld(true);
    const point = raycastWorldPointOrPlane(group, cameraAboveLookingDown(), mockDom(), 50, 50, fallback, 0)!;
    // The box surface (≈0.7 from origin) is returned, NOT the floor point at origin.
    expect(point.distanceTo(new THREE.Vector3(0, 0, 0))).toBeGreaterThan(0.3);
  });

  it('groundY changes the resolved pivot vs the camera-facing fallback', () => {
    const cam = cameraAboveLookingDown();
    const withGround = raycastWorldPointOrPlane(new THREE.Group(), cam, mockDom(), 50, 90, fallback, 0)!;
    const noGround = raycastWorldPointOrPlane(new THREE.Group(), cam, mockDom(), 50, 90, fallback)!;
    expect(withGround.y).toBeCloseTo(0, 5);
    expect(withGround.distanceTo(noGround)).toBeGreaterThan(0.01);
  });
});

describe('raycastBimGroup — regression after clientToNdc SSoT extraction', () => {
  it('still resolves a tagged bim mesh at viewport center', () => {
    const group = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    box.userData['bimId'] = 'wall-1';
    box.userData['bimType'] = 'wall';
    group.add(box);
    box.updateMatrixWorld(true);

    const hit = raycastBimGroup(group, cameraLookingAtOrigin(), mockDom(), 50, 50);
    expect(hit).toEqual({ bimId: 'wall-1', bimType: 'wall' });
  });

  it('returns null on zero-area dom element', () => {
    const group = new THREE.Group();
    expect(raycastBimGroup(group, cameraLookingAtOrigin(), mockDom(0, 0), 50, 50)).toBeNull();
  });
});
