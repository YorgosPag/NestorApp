/**
 * ADR-536 — SelectionOutlinePass (mask + dilate silhouette).
 * Verifies the selection bookkeeping: which objects are silhouetted, the
 * empty/non-empty state, and that the input array is defensively copied.
 * (The GPU mask+dilate render itself needs a WebGL context → browser-verified.)
 */

import * as THREE from 'three';
import { SelectionOutlinePass } from '../SelectionOutlinePass';

function makeOutline(): SelectionOutlinePass {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  return new SelectionOutlinePass(new THREE.Vector2(800, 600), scene, camera);
}

function mesh(): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
}

describe('SelectionOutlinePass', () => {
  it('starts with no selection', () => {
    const outline = makeOutline();
    expect(outline.hasSelection()).toBe(false);
    expect(outline.selectedObjects).toHaveLength(0);
  });

  it('tracks the silhouetted objects when a selection is given', () => {
    const outline = makeOutline();
    const a = mesh();
    const b = mesh();

    outline.setSelected([a, b]);

    expect(outline.hasSelection()).toBe(true);
    expect(outline.selectedObjects).toEqual([a, b]);
  });

  it('clears the silhouette on an empty selection', () => {
    const outline = makeOutline();
    outline.setSelected([mesh()]);
    outline.setSelected([]);

    expect(outline.hasSelection()).toBe(false);
    expect(outline.selectedObjects).toHaveLength(0);
  });

  it('takes a defensive copy of the input array', () => {
    const outline = makeOutline();
    const input = [mesh()];
    outline.setSelected(input);
    input.push(mesh()); // mutate caller array afterwards

    expect(outline.selectedObjects).toHaveLength(1);
  });

  it('setCamera does not throw', () => {
    const outline = makeOutline();
    expect(() => outline.setCamera(new THREE.PerspectiveCamera(60, 2, 1, 100))).not.toThrow();
  });
});
