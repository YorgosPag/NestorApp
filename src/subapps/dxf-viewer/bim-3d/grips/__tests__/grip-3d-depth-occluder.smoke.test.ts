/**
 * Smoke test for GripDepthOccluder (ADR-535 Φ5b). The GPU render / read-back paths need a
 * real WebGL context (browser-verified by Giorgio), so here we only exercise the parts that
 * run without GL — construction, the empty / non-perspective fast paths, and disposal — which
 * also type-checks the whole module through ts-jest.
 */

import * as THREE from 'three';
import { GripDepthOccluder } from '../grip-3d-depth-occluder';

describe('GripDepthOccluder (no-GL paths)', () => {
  it('constructs and disposes without a WebGL context', () => {
    const occ = new GripDepthOccluder();
    expect(occ).toBeInstanceOf(GripDepthOccluder);
    occ.dispose();
  });

  it('returns [] for an empty grip set (no GPU work)', () => {
    const occ = new GripDepthOccluder();
    const renderer = {} as THREE.WebGLRenderer;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    expect(occ.computeVisibility(renderer, scene, camera, [])).toEqual([]);
    occ.dispose();
  });

  it('returns all-visible for a non-perspective camera (ortho skips occlusion)', () => {
    const occ = new GripDepthOccluder();
    const renderer = {} as THREE.WebGLRenderer;
    const scene = new THREE.Scene();
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    const worlds = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)];
    expect(occ.computeVisibility(renderer, scene, ortho, worlds)).toEqual([true, true]);
    occ.dispose();
  });
});
