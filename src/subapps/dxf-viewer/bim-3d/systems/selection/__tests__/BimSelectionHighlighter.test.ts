/**
 * ADR-536 — BimSelectionHighlighter silhouette mechanism.
 * The highlighter now feeds the matching meshes into a `SelectionOutlinePass`
 * (gold silhouette outline) and NEVER mutates mesh materials. Verifies the
 * outline selection tracks an arbitrary set of bimIds, that the body materials
 * are left untouched, and that onClear empties the outline.
 *
 * (Multi-select set behaviour is inherited from ADR-402 Phase C.)
 */

import * as THREE from 'three';
import { BimSelectionHighlighter } from '../BimSelectionHighlighter';
import { SelectionOutlinePass } from '../SelectionOutlinePass';

function mesh(bimId: string): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  m.userData['bimId'] = bimId;
  return m;
}

function makeOutline(): SelectionOutlinePass {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  return new SelectionOutlinePass(new THREE.Vector2(800, 600), scene, camera);
}

describe('BimSelectionHighlighter — silhouette outline', () => {
  it('outlines exactly the meshes whose bimId is in the set', () => {
    const group = new THREE.Group();
    const a = mesh('a');
    const b = mesh('b');
    const c = mesh('c');
    group.add(a, b, c);
    const outline = makeOutline();
    const h = new BimSelectionHighlighter(group, outline);

    h.onSelect(new Set(['a', 'b']));

    expect(new Set(outline.selectedObjects)).toEqual(new Set([a, b]));
    expect(outline.selectedObjects).not.toContain(c);
    expect(outline.hasSelection()).toBe(true);
  });

  it('NEVER mutates the body materials (only the silhouette is drawn)', () => {
    const group = new THREE.Group();
    const a = mesh('a');
    group.add(a);
    const origMaterial = a.material;
    const origEmissive = (a.material as THREE.MeshStandardMaterial).emissive.getHex();
    const outline = makeOutline();
    const h = new BimSelectionHighlighter(group, outline);

    h.onSelect(new Set(['a']));

    expect(a.material).toBe(origMaterial); // same reference — no clone
    expect((a.material as THREE.MeshStandardMaterial).emissive.getHex()).toBe(origEmissive);
  });

  it('updates the outline when the selection changes', () => {
    const group = new THREE.Group();
    const a = mesh('a');
    const b = mesh('b');
    group.add(a, b);
    const outline = makeOutline();
    const h = new BimSelectionHighlighter(group, outline);

    h.onSelect(new Set(['a', 'b']));
    h.onSelect(new Set(['b'])); // drop 'a'

    expect(new Set(outline.selectedObjects)).toEqual(new Set([b]));
  });

  it('onClear empties the outline selection', () => {
    const group = new THREE.Group();
    group.add(mesh('a'));
    const outline = makeOutline();
    const h = new BimSelectionHighlighter(group, outline);

    h.onSelect(new Set(['a']));
    h.onClear();

    expect(outline.selectedObjects).toHaveLength(0);
    expect(outline.hasSelection()).toBe(false);
  });
});
