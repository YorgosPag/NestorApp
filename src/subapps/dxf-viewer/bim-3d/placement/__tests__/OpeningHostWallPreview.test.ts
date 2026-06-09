/**
 * ADR-363 Φ1G.5 Slice 2g — OpeningHostWallPreview swap manager tests.
 *
 * Verifies the hide-originals / add-non-pickable-preview / restore-on-cancel /
 * keep-hidden-on-commit lifecycle on a fake bim group with `bimId`-tagged children.
 */

import * as THREE from 'three';
import { OpeningHostWallPreview } from '../OpeningHostWallPreview';

function tagged(bimId: string): THREE.Mesh {
  const m = new THREE.Mesh();
  m.userData['bimId'] = bimId;
  return m;
}

function previewObject(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(new THREE.Mesh());
  return g;
}

describe('OpeningHostWallPreview', () => {
  it('hides the named originals and adds a non-pickable preview', () => {
    const group = new THREE.Group();
    const wall = tagged('wall-1');
    const body = tagged('op-1');
    const other = tagged('wall-2');
    group.add(wall, body, other);
    const preview = previewObject();

    new OpeningHostWallPreview(group).update([{ hideIds: new Set(['wall-1', 'op-1']), object: preview }]);

    expect(wall.visible).toBe(false);
    expect(body.visible).toBe(false);
    expect(other.visible).toBe(true); // not in hideIds
    expect(group.children).toContain(preview);
    // Non-pickable: raycasting the preview yields no intersections.
    const hits: THREE.Intersection[] = [];
    preview.children[0]!.raycast(new THREE.Raycaster(), hits);
    expect(hits).toHaveLength(0);
  });

  it('commit drops the preview but LEAVES the originals hidden (re-sync replaces them)', () => {
    const group = new THREE.Group();
    const wall = tagged('wall-1');
    group.add(wall);
    const mgr = new OpeningHostWallPreview(group);
    const preview = previewObject();
    mgr.update([{ hideIds: new Set(['wall-1']), object: preview }]);

    mgr.commit();

    expect(group.children).not.toContain(preview);
    expect(wall.visible).toBe(false); // stays hidden — no old-hole flash before the re-sync
  });

  it('cancel drops the preview and restores the originals', () => {
    const group = new THREE.Group();
    const wall = tagged('wall-1');
    group.add(wall);
    const mgr = new OpeningHostWallPreview(group);
    const preview = previewObject();
    mgr.update([{ hideIds: new Set(['wall-1']), object: preview }]);

    mgr.cancel();

    expect(group.children).not.toContain(preview);
    expect(wall.visible).toBe(true);
  });

  it('a second update restores the first frame before hiding the new set', () => {
    const group = new THREE.Group();
    const wallA = tagged('wall-1');
    const wallB = tagged('wall-2');
    group.add(wallA, wallB);
    const mgr = new OpeningHostWallPreview(group);

    mgr.update([{ hideIds: new Set(['wall-1']), object: previewObject() }]);
    mgr.update([{ hideIds: new Set(['wall-2']), object: previewObject() }]);

    expect(wallA.visible).toBe(true); // restored
    expect(wallB.visible).toBe(false); // newly hidden
  });
});
