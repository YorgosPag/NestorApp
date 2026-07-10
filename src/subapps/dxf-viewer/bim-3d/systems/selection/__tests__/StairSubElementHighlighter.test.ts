/**
 * ADR-358 Q19 — StairSubElementHighlighter (per-tread/riser overlay).
 *
 * Verifies the overlay attaches to EXACTLY the tagged tread/riser mesh, reuses (never
 * disposes) the shared geometry, clears on `null`, re-attaches on `refresh()` after a
 * rebuild, and that `countStairSubElementMeshes` reports the ground-truth mesh count.
 *
 * @see ../StairSubElementHighlighter.ts
 */

import * as THREE from 'three';
import {
  StairSubElementHighlighter,
  countStairSubElementMeshes,
} from '../StairSubElementHighlighter';

/** A tagged mesh mirroring `StairToThreeConverter.tagMesh` output. */
function tagged(bimId: string, component: string, index?: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  mesh.userData['bimId'] = bimId;
  mesh.userData['bimType'] = 'stair';
  mesh.userData['stairComponent'] = component;
  if (index !== undefined) mesh.userData['stairComponentIndex'] = index;
  return mesh;
}

/** A stair group with `treads` treads + `risers` risers (0-based indices). */
function makeGroup(stairId: string, treads: number, risers: number): THREE.Group {
  const group = new THREE.Group();
  for (let i = 0; i < treads; i++) group.add(tagged(stairId, 'tread', i));
  for (let i = 0; i < risers; i++) group.add(tagged(stairId, 'riser', i));
  return group;
}

/** The overlay child mesh attached to a target (renderOrder 999, non-pickable). */
function overlayOf(mesh: THREE.Object3D): THREE.Mesh | undefined {
  return mesh.children.find((c) => (c as THREE.Mesh).isMesh && c.renderOrder === 999) as THREE.Mesh | undefined;
}

describe('StairSubElementHighlighter (ADR-358 Q19)', () => {
  it('attaches the overlay to exactly the targeted tread mesh', () => {
    const group = makeGroup('stair_1', 3, 3);
    const hl = new StairSubElementHighlighter(group);
    hl.setTarget({ stairId: 'stair_1', part: 'tread', index: 1 });

    const treads = group.children.filter((c) => c.userData['stairComponent'] === 'tread');
    expect(overlayOf(treads[1]!)).toBeDefined();
    expect(overlayOf(treads[0]!)).toBeUndefined();
    expect(overlayOf(treads[2]!)).toBeUndefined();
  });

  it('the overlay reuses the target geometry and is non-pickable', () => {
    const group = makeGroup('stair_1', 2, 0);
    const target = group.children[1] as THREE.Mesh; // tread index 1
    const hl = new StairSubElementHighlighter(group);
    hl.setTarget({ stairId: 'stair_1', part: 'tread', index: 1 });

    const overlay = overlayOf(target)!;
    expect(overlay.geometry).toBe(target.geometry); // shared, not a slice
    expect(overlay.raycast()).toBeUndefined();
  });

  it('setTarget(null) clears the overlay WITHOUT disposing the shared geometry', () => {
    const group = makeGroup('stair_1', 2, 0);
    const target = group.children[0] as THREE.Mesh; // tread index 0
    const disposeSpy = jest.spyOn(target.geometry, 'dispose');
    const hl = new StairSubElementHighlighter(group);

    hl.setTarget({ stairId: 'stair_1', part: 'tread', index: 0 });
    expect(overlayOf(target)).toBeDefined();
    hl.setTarget(null);
    expect(overlayOf(target)).toBeUndefined();
    expect(disposeSpy).not.toHaveBeenCalled();
  });

  it('re-targeting moves the overlay to the new tread only', () => {
    const group = makeGroup('stair_1', 3, 0);
    const hl = new StairSubElementHighlighter(group);
    hl.setTarget({ stairId: 'stair_1', part: 'tread', index: 0 });
    hl.setTarget({ stairId: 'stair_1', part: 'tread', index: 2 });

    const treads = group.children;
    expect(overlayOf(treads[0]!)).toBeUndefined();
    expect(overlayOf(treads[2]!)).toBeDefined();
  });

  it('an unknown target attaches nothing (no crash)', () => {
    const group = makeGroup('stair_1', 2, 0);
    const hl = new StairSubElementHighlighter(group);
    hl.setTarget({ stairId: 'stair_1', part: 'tread', index: 99 });
    for (const c of group.children) expect(overlayOf(c)).toBeUndefined();
  });

  it('refresh() re-attaches to the rebuilt mesh (same logical index, new object)', () => {
    const group = makeGroup('stair_1', 2, 0);
    const hl = new StairSubElementHighlighter(group);
    hl.setTarget({ stairId: 'stair_1', part: 'tread', index: 1 });

    // Simulate a scene rebuild: the old meshes (and their overlay children) die.
    group.clear();
    group.add(tagged('stair_1', 'tread', 0), tagged('stair_1', 'tread', 1));
    expect(overlayOf(group.children[1]!)).toBeUndefined(); // not yet re-attached

    hl.refresh();
    expect(overlayOf(group.children[1]!)).toBeDefined();
  });

  it('countStairSubElementMeshes reports the per-part ground truth', () => {
    const group = makeGroup('stair_1', 4, 3);
    group.add(tagged('stair_2', 'tread', 0)); // a different stair must not leak into the count
    expect(countStairSubElementMeshes(group, 'stair_1', 'tread')).toBe(4);
    expect(countStairSubElementMeshes(group, 'stair_1', 'riser')).toBe(3);
    expect(countStairSubElementMeshes(group, 'stair_missing', 'tread')).toBe(0);
  });

  it('dispose() clears the overlay and disposes only its own material', () => {
    const group = makeGroup('stair_1', 1, 0);
    const target = group.children[0] as THREE.Mesh;
    const geomDispose = jest.spyOn(target.geometry, 'dispose');
    const hl = new StairSubElementHighlighter(group);
    hl.setTarget({ stairId: 'stair_1', part: 'tread', index: 0 });
    hl.dispose();
    expect(overlayOf(target)).toBeUndefined();
    expect(geomDispose).not.toHaveBeenCalled(); // shared geometry survives
  });
});
