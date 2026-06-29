/**
 * ADR-550 — EditOriginalGhost (the 3D "original stays behind as a dimmed ghost" leaf).
 *
 * Verifies the 2D move-parity contract:
 *   • a frozen clone is parked at the SOURCE pose and stays put when the real mesh moves,
 *   • it is exposed via the post-FX registry (AO-immune translucent draw) only while shown,
 *   • the ghost colour tracks the source mesh's material colour (falls back to cyan),
 *   • teardown detaches the clone WITHOUT disposing the shared (borrowed) geometry,
 *   • no-ops for an empty set or meshes not yet parented under a scene.
 */

import * as THREE from 'three';
import { EditOriginalGhost } from '../edit-original-ghost';
import { collectPostFxOverlayRoots } from '../../scene/post-fx-overlay-pass';
import { GHOST_ALPHA } from '../../../rendering/ghost/ghost-policy';

function sceneWithMesh(colorHex = 0x336699): { scene: THREE.Scene; mesh: THREE.Mesh; geometry: THREE.BufferGeometry } {
  const scene = new THREE.Scene();
  const group = new THREE.Group(); // mirrors bimLayer.group (identity)
  scene.add(group);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: colorHex }));
  mesh.position.set(2, 0, 3);
  group.add(mesh);
  return { scene, mesh, geometry };
}

describe('EditOriginalGhost', () => {
  it('parks a frozen, translucent clone at the source pose and exposes it via post-FX', () => {
    const { scene, mesh } = sceneWithMesh();
    const ghost = new EditOriginalGhost();
    ghost.show([mesh]);

    expect(ghost.isActive).toBe(true);
    const roots = collectPostFxOverlayRoots(scene);
    expect(roots).toHaveLength(1);
    const clone = roots[0].children[0] as THREE.Mesh;
    // Frozen at the SOURCE pose.
    expect(clone.position.toArray()).toEqual([2, 0, 3]);
    // Translucent unlit ghost material at the shared policy alpha.
    const mat = clone.material as THREE.MeshBasicMaterial;
    expect(mat).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBe(GHOST_ALPHA);
  });

  it('stays frozen at the source pose when the real mesh moves', () => {
    const { scene, mesh } = sceneWithMesh();
    const ghost = new EditOriginalGhost();
    ghost.show([mesh]);
    // Simulate the rigid move mutating the real mesh.
    mesh.position.set(50, 0, 60);
    const clone = collectPostFxOverlayRoots(scene)[0].children[0] as THREE.Mesh;
    expect(clone.position.toArray()).toEqual([2, 0, 3]);
  });

  it('tracks the source material colour', () => {
    const { mesh } = sceneWithMesh(0xff8800);
    const ghost = new EditOriginalGhost();
    ghost.show([mesh]);
    const clone = (mesh.parent!.parent as THREE.Scene); // scene
    const root = collectPostFxOverlayRoots(clone)[0];
    const mat = (root.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(mat.color.getHex()).toBe(0xff8800);
  });

  it('clear() detaches the clone WITHOUT disposing the borrowed geometry', () => {
    const { scene, mesh, geometry } = sceneWithMesh();
    const disposeGeometry = jest.spyOn(geometry, 'dispose');
    const ghost = new EditOriginalGhost();
    ghost.show([mesh]);
    ghost.clear();

    expect(ghost.isActive).toBe(false);
    expect(collectPostFxOverlayRoots(scene)).toEqual([]);
    // Borrowed geometry is shared with the live mesh → must never be disposed.
    expect(disposeGeometry).not.toHaveBeenCalled();
    expect(mesh.geometry).toBe(geometry);
  });

  it('no-ops for an empty set or meshes without a scene', () => {
    const ghost = new EditOriginalGhost();
    ghost.show([]);
    expect(ghost.isActive).toBe(false);

    const orphan = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    ghost.show([orphan]); // not parented under a scene
    expect(ghost.isActive).toBe(false);
  });

  it('dispose() frees the overlay and unregisters the post-FX provider', () => {
    const { scene, mesh } = sceneWithMesh();
    const ghost = new EditOriginalGhost();
    ghost.show([mesh]);
    ghost.dispose();
    expect(ghost.isActive).toBe(false);
    expect(collectPostFxOverlayRoots(scene)).toEqual([]);
  });
});
