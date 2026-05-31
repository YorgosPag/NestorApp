/**
 * ADR-402 Phase C — BimSelectionHighlighter multi-select + diff.
 * Verifies it highlights an arbitrary set of bimIds and that a Shift+click toggle
 * (set diff) only restores the meshes that left the set, leaving the rest highlighted.
 */

import * as THREE from 'three';
import { BimSelectionHighlighter } from '../BimSelectionHighlighter';

function mesh(bimId: string): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  m.userData['bimId'] = bimId;
  return m;
}

function isHighlighted(m: THREE.Mesh): boolean {
  const mat = m.material as THREE.MeshStandardMaterial;
  return mat.emissiveIntensity === 0.3 && mat.emissive.getHex() === 0xffd700;
}

describe('BimSelectionHighlighter — multi-select', () => {
  it('highlights every mesh whose bimId is in the set', () => {
    const group = new THREE.Group();
    const a = mesh('a');
    const b = mesh('b');
    const c = mesh('c');
    group.add(a, b, c);
    const h = new BimSelectionHighlighter(group);

    h.onSelect(new Set(['a', 'b']));

    expect(isHighlighted(a)).toBe(true);
    expect(isHighlighted(b)).toBe(true);
    expect(isHighlighted(c)).toBe(false);
  });

  it('diff: restores only meshes that left the set, keeps the rest highlighted', () => {
    const group = new THREE.Group();
    const a = mesh('a');
    const b = mesh('b');
    group.add(a, b);
    const origA = a.material;
    const h = new BimSelectionHighlighter(group);

    h.onSelect(new Set(['a', 'b']));
    const highlightedB = b.material; // clone applied on first select
    h.onSelect(new Set(['b'])); // drop 'a'

    expect(a.material).toBe(origA); // restored original
    expect(b.material).toBe(highlightedB); // untouched (no re-clone)
    expect(isHighlighted(b)).toBe(true);
  });

  it('onClear restores all originals', () => {
    const group = new THREE.Group();
    const a = mesh('a');
    group.add(a);
    const origA = a.material;
    const h = new BimSelectionHighlighter(group);

    h.onSelect(new Set(['a']));
    h.onClear();

    expect(a.material).toBe(origA);
  });
});
