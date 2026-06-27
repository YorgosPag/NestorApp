/**
 * Tests for project-snap3d-marker — the shared SSoT projecting the active 3D snap marker to
 * canvas-local px + deciding visibility (ADR-542 / ADR-545). Used by both the snap glyph overlay
 * and the 3D crosshair, so this is the one place the on-screen / camera-settled rule is pinned.
 */

import * as THREE from 'three';
import { projectSnap3DMarker, type SnapProjectionManager } from '../project-snap3d-marker';
import type { Snap3DMarker } from '../../../stores/Snap3DOverlayStore';

function fakeCanvas(left: number, top: number, width: number, height: number): HTMLCanvasElement {
  return {
    getBoundingClientRect: () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }),
  } as unknown as HTMLCanvasElement;
}

function frontCamera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  cam.position.set(0, 0, 10);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}

function managerWith(cam: THREE.Camera | null, canvas: HTMLCanvasElement | null): SnapProjectionManager {
  return { getCamera: () => cam, getRendererCanvas: () => canvas } as unknown as SnapProjectionManager;
}

function markerAt(x: number, y: number, elevMm = 0): Snap3DMarker {
  return { view: { point: { x, y } }, elevMm } as unknown as Snap3DMarker;
}

describe('projectSnap3DMarker', () => {
  it('projects the on-axis snap point to the canvas centre and marks it visible', () => {
    const res = projectSnap3DMarker(managerWith(frontCamera(), fakeCanvas(100, 50, 800, 600)), markerAt(0, 0), false, null);
    expect(res).not.toBeNull();
    expect(res!.point.x).toBeCloseTo(400, 3);
    expect(res!.point.y).toBeCloseTo(300, 3);
    expect(res!.visible).toBe(true);
  });

  it('returns null when the snap point is behind the camera (off-screen)', () => {
    const res = projectSnap3DMarker(managerWith(frontCamera(), fakeCanvas(0, 0, 800, 600)), markerAt(0, -20000), false, null);
    expect(res).toBeNull();
  });

  it('marks the marker not-visible while the camera is moving (orbit/zoom/pan)', () => {
    const res = projectSnap3DMarker(managerWith(frontCamera(), fakeCanvas(0, 0, 800, 600)), markerAt(0, 0), true, null);
    expect(res).not.toBeNull();
    expect(res!.visible).toBe(false);
  });

  it('returns null when there is no camera or no canvas', () => {
    expect(projectSnap3DMarker(managerWith(null, fakeCanvas(0, 0, 800, 600)), markerAt(0, 0), false, null)).toBeNull();
    expect(projectSnap3DMarker(managerWith(frontCamera(), null), markerAt(0, 0), false, null)).toBeNull();
  });
});
