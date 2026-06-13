/**
 * ADR-452 v2.11 — cheap visibility-only cull for the cut-slider DRAG.
 *
 * `cullEdgeCutVisibility` must toggle each fat-line edge overlay's visibility against
 * the cut WITHOUT re-clipping or re-uploading geometry, so a drag frame costs only a
 * traverse + a boolean. It also restores (once) any overlay still carrying a previous
 * exact trim, so the draft never shows a stale cut.
 */

import * as THREE from 'three';
import type { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { cullEdgeCutVisibility } from '../edge-cut-applicator';

interface FakeOverlayOpts {
  readonly minY: number;
  readonly maxY: number;
  readonly appliedCutY?: number | null;
}

/**
 * Object3D pre-seeded with the cached pristine positions + world-Y range, so the cull
 * never touches real GPU geometry. `setPositions` / `computeLineDistances` are spies so
 * we can assert the one-shot restore happens (and never per-frame).
 */
function makeFakeOverlay({ minY, maxY, appliedCutY = null }: FakeOverlayOpts): {
  obj: THREE.Object3D;
  setPositions: jest.Mock;
} {
  const obj = new THREE.Object3D();
  const orig = new Float32Array([0, minY, 0, 0, maxY, 0]);
  obj.userData['bimEdgeOverlay'] = true;
  obj.userData['bimEdgeOrig'] = orig;
  obj.userData['bimEdgeYRange'] = { minY, maxY };
  obj.userData['bimEdgeAppliedCutY'] = appliedCutY;
  const setPositions = jest.fn();
  (obj as unknown as LineSegments2).geometry = { setPositions } as unknown as LineSegments2['geometry'];
  (obj as unknown as { computeLineDistances: () => void }).computeLineDistances = jest.fn();
  return { obj, setPositions };
}

describe('cullEdgeCutVisibility — visibility only', () => {
  it('hides an overlay fully above the cut, shows below + crossing', () => {
    const group = new THREE.Group();
    const above = makeFakeOverlay({ minY: 10, maxY: 14 });
    const below = makeFakeOverlay({ minY: 0, maxY: 4 });
    const crossing = makeFakeOverlay({ minY: 0, maxY: 6 });
    group.add(above.obj, below.obj, crossing.obj);

    cullEdgeCutVisibility(group, 5);

    expect(above.obj.visible).toBe(false);
    expect(below.obj.visible).toBe(true);
    expect(crossing.obj.visible).toBe(true);
  });

  it('keeps crossing geometry pristine — no re-upload while dragging', () => {
    const group = new THREE.Group();
    const crossing = makeFakeOverlay({ minY: 0, maxY: 6, appliedCutY: null });
    group.add(crossing.obj);

    cullEdgeCutVisibility(group, 3);

    expect(crossing.setPositions).not.toHaveBeenCalled();
  });

  it('ignores non-edge-overlay objects', () => {
    const group = new THREE.Group();
    const plain = new THREE.Object3D();
    plain.visible = true;
    group.add(plain);

    cullEdgeCutVisibility(group, 5);

    expect(plain.visible).toBe(true); // untouched
  });
});

describe('cullEdgeCutVisibility — one-shot restore of a prior exact trim', () => {
  it('restores an overlay carrying a previous trim, exactly once', () => {
    const group = new THREE.Group();
    const trimmed = makeFakeOverlay({ minY: 0, maxY: 6, appliedCutY: 4 });
    group.add(trimmed.obj);

    cullEdgeCutVisibility(group, 5);
    expect(trimmed.setPositions).toHaveBeenCalledTimes(1); // restored to pristine
    expect(trimmed.obj.userData['bimEdgeAppliedCutY']).toBeNull();

    cullEdgeCutVisibility(group, 5);
    expect(trimmed.setPositions).toHaveBeenCalledTimes(1); // stays pristine, no second upload
  });
});
