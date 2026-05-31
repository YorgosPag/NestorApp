/**
 * ADR-402 Phase C — computeFramingTargetBounds multi-select union.
 * Frame-selection should cover the combined bounding box of ALL selected entities,
 * and fall back to scene extents when nothing is selected.
 */

import * as THREE from 'three';
import { computeFramingTargetBounds } from '../scene-framing-bounds';

function boxMesh(bimId: string, x: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
  m.position.set(x, 0, 0);
  m.userData['bimId'] = bimId;
  return m;
}

describe('computeFramingTargetBounds — multi-select union', () => {
  it('unions the bounds of every selected entity', () => {
    const group = new THREE.Group();
    group.add(boxMesh('a', -10), boxMesh('b', 10));
    group.updateMatrixWorld(true);

    const bounds = computeFramingTargetBounds(group, null, ['a', 'b']);

    expect(bounds).not.toBeNull();
    expect(bounds?.min.x ?? 0).toBeLessThanOrEqual(-11);
    expect(bounds?.max.x ?? 0).toBeGreaterThanOrEqual(11);
  });

  it('frames a single selected entity (not the whole scene)', () => {
    const group = new THREE.Group();
    group.add(boxMesh('a', -10), boxMesh('b', 10));
    group.updateMatrixWorld(true);

    const bounds = computeFramingTargetBounds(group, null, ['a']);

    expect(bounds).not.toBeNull();
    // Only 'a' (at x=-10) → max.x stays well below b's side.
    expect(bounds?.max.x ?? 0).toBeLessThan(0);
  });

  it('falls back to scene extents when nothing is selected', () => {
    const group = new THREE.Group();
    group.add(boxMesh('a', 0));
    group.updateMatrixWorld(true);

    const bounds = computeFramingTargetBounds(group, null, []);

    expect(bounds).not.toBeNull();
  });
});
