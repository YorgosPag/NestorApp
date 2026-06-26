/**
 * ADR-536 — SelectionOutlinePass wrapper.
 * Verifies the OutlinePass is configured with the gold selection token, stays
 * disabled on an empty selection, and syncs selectedObjects / camera / size.
 */

import * as THREE from 'three';
import { SelectionOutlinePass } from '../SelectionOutlinePass';
import { BIM_SELECTION_OUTLINE_COLOR_THREE } from '../selection-outline-tokens';

function makeOutline(): SelectionOutlinePass {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  return new SelectionOutlinePass(new THREE.Vector2(800, 600), scene, camera);
}

function mesh(): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
}

describe('SelectionOutlinePass', () => {
  it('configures the gold selection color and a static (non-pulsing) outline, disabled initially', () => {
    const outline = makeOutline();
    expect(outline.pass.visibleEdgeColor.getHex()).toBe(BIM_SELECTION_OUTLINE_COLOR_THREE);
    expect(outline.pass.pulsePeriod).toBe(0);
    expect(outline.pass.enabled).toBe(false);
    expect(outline.hasSelection()).toBe(false);
  });

  it('enables the pass and sets selectedObjects when a selection is given', () => {
    const outline = makeOutline();
    const a = mesh();
    const b = mesh();

    outline.setSelected([a, b]);

    expect(outline.pass.enabled).toBe(true);
    expect(outline.hasSelection()).toBe(true);
    expect(outline.pass.selectedObjects).toEqual([a, b]);
  });

  it('disables the pass on an empty selection', () => {
    const outline = makeOutline();
    outline.setSelected([mesh()]);
    outline.setSelected([]);

    expect(outline.pass.enabled).toBe(false);
    expect(outline.hasSelection()).toBe(false);
    expect(outline.pass.selectedObjects).toHaveLength(0);
  });

  it('takes a defensive copy of the input array', () => {
    const outline = makeOutline();
    const input = [mesh()];
    outline.setSelected(input);
    input.push(mesh()); // mutate caller array afterwards

    expect(outline.pass.selectedObjects).toHaveLength(1);
  });

  it('syncs the render camera', () => {
    const outline = makeOutline();
    const cam = new THREE.PerspectiveCamera(60, 2, 1, 100);
    outline.setCamera(cam);
    expect(outline.pass.renderCamera).toBe(cam);
  });

  it('resizes without throwing', () => {
    const outline = makeOutline();
    expect(() => outline.setSize(1024, 768)).not.toThrow();
  });
});
