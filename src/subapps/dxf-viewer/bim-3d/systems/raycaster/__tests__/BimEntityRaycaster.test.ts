import * as THREE from 'three';
import { raycastWorldPoint, raycastBimGroup } from '../BimEntityRaycaster';

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
