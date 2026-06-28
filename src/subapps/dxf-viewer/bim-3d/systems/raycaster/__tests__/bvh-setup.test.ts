import * as THREE from 'three';
import { installBvh, ensureBoundsTrees, markBvhDirty } from '../bvh-setup';

describe('bvh-setup — ADR-040 Φ-3D-pointer spatial-acceleration SSoT', () => {
  it('installBvh patches the BufferGeometry/Mesh prototypes (idempotent)', () => {
    installBvh();
    expect(typeof THREE.BufferGeometry.prototype.computeBoundsTree).toBe('function');
    expect(typeof THREE.BufferGeometry.prototype.disposeBoundsTree).toBe('function');
    const raycastAfter = THREE.Mesh.prototype.raycast;
    installBvh(); // second call must be a no-op (same patched function)
    expect(THREE.Mesh.prototype.raycast).toBe(raycastAfter);
  });

  it('ensureBoundsTrees builds a boundsTree for an indexed mesh', () => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)); // BoxGeometry is indexed
    group.add(mesh);

    expect(mesh.geometry.boundsTree).toBeUndefined();
    ensureBoundsTrees(group);
    expect(mesh.geometry.boundsTree).toBeDefined();
  });

  it('is idempotent — a second pass keeps the SAME boundsTree instance (no rebuild)', () => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    group.add(mesh);

    ensureBoundsTrees(group);
    const first = mesh.geometry.boundsTree;
    ensureBoundsTrees(group);
    expect(mesh.geometry.boundsTree).toBe(first);
  });

  it('skips non-indexed geometry (BVH builder requires an index buffer)', () => {
    const group = new THREE.Group();
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3)); // 1 triangle, no index
    const mesh = new THREE.Mesh(geom);
    group.add(mesh);

    ensureBoundsTrees(group);
    expect(mesh.geometry.boundsTree).toBeUndefined(); // skipped, not thrown
  });

  it('builds trees only for the indexed meshes under a mixed group', () => {
    const group = new THREE.Group();
    const indexed = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const nonMesh = new THREE.Group();
    group.add(indexed, nonMesh);

    expect(() => ensureBoundsTrees(group)).not.toThrow();
    expect(indexed.geometry.boundsTree).toBeDefined();
  });

  it('once clean, a mesh added AFTER the pass is skipped until markBvhDirty re-arms the walk', () => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    ensureBoundsTrees(group); // builds the first mesh's tree → root now clean

    // Simulate a scene rebuild that adds a fresh mesh without re-arming.
    const fresh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    group.add(fresh);
    ensureBoundsTrees(group); // clean root → traverse skipped → fresh mesh NOT built
    expect(fresh.geometry.boundsTree).toBeUndefined();

    markBvhDirty(group); // BimSceneLayer.sync* does this after adding meshes
    ensureBoundsTrees(group);
    expect(fresh.geometry.boundsTree).toBeDefined();
  });
});
