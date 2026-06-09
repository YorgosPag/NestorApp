/**
 * ADR-363 Φ1G.5 Slice 2i-fix — dim3d-snap-engine-adapter endpoint snap.
 *
 * Regression for "το gizmo δεν εμφανίζεται ακριβώς στην κορυφή" (Giorgio): the endpoint
 * snap must return the vertex in WORLD space (was: local bbox corner, untransformed), so a
 * Ctrl+click base point lands on the mesh's true corner even when the mesh is translated.
 */

import * as THREE from 'three';
import { pickDim3DSnap, DEFAULT_DIM3D_SNAP_TOGGLES } from '../dim3d-snap-engine-adapter';

function fakeCanvas(width = 800, height = 600): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({
    left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0, toJSON: () => ({}),
  }) as DOMRect;
  return el;
}

describe('pickDim3DSnap — endpoint world-space snap (Slice 2i-fix)', () => {
  it('returns the corner in WORLD space for a translated mesh (not the local corner)', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    mesh.position.set(10, 0, 0); // translate far from origin
    mesh.updateMatrixWorld(true);
    const scene = new THREE.Scene();
    scene.add(mesh);

    // Camera straight down the -Z axis, centred on the translated mesh.
    const camera = new THREE.PerspectiveCamera(50, 800 / 600, 0.1, 100);
    camera.position.set(10, 0, 8);
    camera.lookAt(10, 0, 0);
    camera.updateMatrixWorld(true);

    const res = pickDim3DSnap({
      camera,
      clientX: 400, // screen centre → ray through (10,0,*)
      clientY: 300,
      domElement: fakeCanvas(),
      targets: [mesh],
      toggles: DEFAULT_DIM3D_SNAP_TOGGLES,
    });

    expect(res.mode).toBe('endpoint');
    // A real corner of the box lives at world x = 9 or 11 — emphatically NOT near 0/1
    // (which the old local-space bbox-corner bug returned).
    expect(res.position.x).toBeGreaterThan(8);
    expect(Math.abs(res.position.x - 10)).toBeCloseTo(1, 5); // |x-10| == half-extent
  });

  it('returns null when nothing is under the cursor', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    mesh.updateMatrixWorld(true);
    const camera = new THREE.PerspectiveCamera(50, 800 / 600, 0.1, 100);
    camera.position.set(0, 0, 8);
    camera.updateMatrixWorld(true);
    const res = pickDim3DSnap({
      camera, clientX: 10, clientY: 10, domElement: fakeCanvas(), targets: [mesh],
      toggles: DEFAULT_DIM3D_SNAP_TOGGLES,
    });
    expect(res.mode).toBe('none');
  });
});
