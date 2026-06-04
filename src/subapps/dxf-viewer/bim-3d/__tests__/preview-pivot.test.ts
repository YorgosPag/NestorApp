import * as THREE from 'three';
import { resolvePreviewPivot, PreviewPivotMarker } from '../preview/preview-pivot';

/** Minimal DOM stub: only getBoundingClientRect is read by resolvePreviewPivot. */
function mockDom(width: number, height: number): HTMLElement {
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width, height }),
  } as unknown as HTMLElement;
}

function frontCamera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  cam.position.set(0, 0, 5);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  return cam;
}

describe('resolvePreviewPivot', () => {
  const raycaster = new THREE.Raycaster();

  it('returns the band surface point when the ray hits a target', () => {
    const cam = frontCamera();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.2));
    mesh.updateMatrixWorld();

    // Centre click → straight down -Z, hits the +Z face at z ≈ 0.1.
    const point = resolvePreviewPivot(raycaster, cam, mockDom(100, 100), [mesh], 50, 50);

    expect(point).not.toBeNull();
    expect(point!.x).toBeCloseTo(0, 5);
    expect(point!.y).toBeCloseTo(0, 5);
    expect(point!.z).toBeCloseTo(0.1, 5);
  });

  it('falls back to a plane through the origin when the ray misses all targets', () => {
    const cam = frontCamera();
    // No targets → must NOT no-op; returns the click point on the origin plane.
    const point = resolvePreviewPivot(raycaster, cam, mockDom(100, 100), [], 50, 50);

    expect(point).not.toBeNull();
    // Centre click looks down -Z → plane (normal -Z through origin) hit at origin.
    expect(point!.z).toBeCloseTo(0, 5);
  });

  it('plane fallback tracks the cursor (off-centre click → off-centre pivot)', () => {
    const cam = frontCamera();
    const centre = resolvePreviewPivot(raycaster, cam, mockDom(100, 100), [], 50, 50)!;
    const right = resolvePreviewPivot(raycaster, cam, mockDom(100, 100), [], 90, 50)!;

    expect(right.x).toBeGreaterThan(centre.x); // clicking right → pivot moves +X
  });

  it('returns null for a zero-size canvas (nothing to pick)', () => {
    const cam = frontCamera();
    expect(resolvePreviewPivot(raycaster, cam, mockDom(0, 0), [], 0, 0)).toBeNull();
  });
});

describe('PreviewPivotMarker', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows on flashAt, renders, then auto-hides with a second render', () => {
    const scene = new THREE.Scene();
    const marker = new PreviewPivotMarker(scene);
    const render = jest.fn();

    marker.flashAt(new THREE.Vector3(1, 2, 3), render);
    expect(render).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1000);
    expect(render).toHaveBeenCalledTimes(2); // auto-hide re-render
  });

  it('dispose cancels the pending auto-hide timer (no late render)', () => {
    const scene = new THREE.Scene();
    const marker = new PreviewPivotMarker(scene);
    const render = jest.fn();

    marker.flashAt(new THREE.Vector3(0, 0, 0), render);
    marker.dispose();
    jest.advanceTimersByTime(2000);

    expect(render).toHaveBeenCalledTimes(1); // only the initial show, no hide render
  });
});
