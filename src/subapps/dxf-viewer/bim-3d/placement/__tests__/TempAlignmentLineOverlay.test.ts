/**
 * ADR-363 Φ1G.5 Slice 2i — TempAlignmentLineOverlay tests.
 *
 * Verifies the transient dashed alignment line leaf: hidden at birth, shown along the
 * two reference-face endpoints on `update`, hidden on `hide`, removed on `dispose`.
 */

import * as THREE from 'three';
import { TempAlignmentLineOverlay } from '../TempAlignmentLineOverlay';

function findLine(scene: THREE.Scene): THREE.Line | undefined {
  return scene.children.find((o): o is THREE.Line => o instanceof THREE.Line && o.name === 'temp-alignment-line');
}

describe('TempAlignmentLineOverlay', () => {
  it('adds an invisible dashed line to the scene at construction', () => {
    const scene = new THREE.Scene();
    const overlay = new TempAlignmentLineOverlay(scene);
    const line = findLine(scene);
    expect(line).toBeDefined();
    expect(line!.visible).toBe(false);
    expect(line!.material).toBeInstanceOf(THREE.LineDashedMaterial);
    overlay.dispose();
  });

  it('shows the line between the two reference endpoints on update', () => {
    const scene = new THREE.Scene();
    const overlay = new TempAlignmentLineOverlay(scene);
    overlay.update(new THREE.Vector3(0, 1, 0), new THREE.Vector3(10, 1, 0));
    const line = findLine(scene)!;
    expect(line.visible).toBe(true);
    const pos = line.geometry.getAttribute('position');
    expect(pos.getX(0)).toBeCloseTo(0, 5);
    expect(pos.getX(1)).toBeCloseTo(10, 5);
    // Dashed material requires per-vertex line distances.
    expect(line.geometry.getAttribute('lineDistance')).toBeDefined();
    overlay.dispose();
  });

  it('hides on hide() and removes from the scene on dispose()', () => {
    const scene = new THREE.Scene();
    const overlay = new TempAlignmentLineOverlay(scene);
    overlay.update(new THREE.Vector3(), new THREE.Vector3(1, 0, 0));
    overlay.hide();
    expect(findLine(scene)!.visible).toBe(false);
    overlay.dispose();
    expect(findLine(scene)).toBeUndefined();
  });

  it('update after dispose is a no-op (no throw)', () => {
    const scene = new THREE.Scene();
    const overlay = new TempAlignmentLineOverlay(scene);
    overlay.dispose();
    expect(() => overlay.update(new THREE.Vector3(), new THREE.Vector3(1, 0, 0))).not.toThrow();
  });
});
