/**
 * ADR-537 — disposeObjectTree SSoT (canonical Three.js subtree resource disposal).
 *
 * Verifies the one contract every transient overlay/ghost/preview delegates to:
 *   • geometry is ALWAYS freed across the whole subtree,
 *   • materials (+ their textures) are freed ONLY with { materials: true } (ownership opt-in),
 *   • the default leaves shared singleton materials untouched (the safe common case),
 *   • a geometry-less node (Group) is a no-op (never throws).
 */

import * as THREE from 'three';
import { disposeObjectTree } from '../dispose-object-tree';

function meshWithTexture(): { mesh: THREE.Mesh; geoDispose: jest.SpyInstance; matDispose: jest.SpyInstance; texDispose: jest.SpyInstance } {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const texture = new THREE.Texture();
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const mesh = new THREE.Mesh(geometry, material);
  return {
    mesh,
    geoDispose: jest.spyOn(geometry, 'dispose'),
    matDispose: jest.spyOn(material, 'dispose'),
    texDispose: jest.spyOn(texture, 'dispose'),
  };
}

describe('disposeObjectTree', () => {
  it('frees geometry across the subtree but NOT shared materials by default', () => {
    const root = new THREE.Group();
    const a = meshWithTexture();
    const b = meshWithTexture();
    root.add(a.mesh);
    root.add(b.mesh);

    disposeObjectTree(root);

    expect(a.geoDispose).toHaveBeenCalledTimes(1);
    expect(b.geoDispose).toHaveBeenCalledTimes(1);
    expect(a.matDispose).not.toHaveBeenCalled();
    expect(a.texDispose).not.toHaveBeenCalled();
  });

  it('frees materials AND their textures when the caller owns them', () => {
    const root = new THREE.Group();
    const a = meshWithTexture();
    root.add(a.mesh);

    disposeObjectTree(root, { materials: true });

    expect(a.geoDispose).toHaveBeenCalledTimes(1);
    expect(a.matDispose).toHaveBeenCalledTimes(1);
    expect(a.texDispose).toHaveBeenCalledTimes(1);
  });

  it('handles an array material', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const m1 = new THREE.MeshBasicMaterial();
    const m2 = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(geometry, [m1, m2]);
    const d1 = jest.spyOn(m1, 'dispose');
    const d2 = jest.spyOn(m2, 'dispose');

    disposeObjectTree(mesh, { materials: true });

    expect(d1).toHaveBeenCalledTimes(1);
    expect(d2).toHaveBeenCalledTimes(1);
  });

  it('is a no-op on a geometry-less node (never throws)', () => {
    expect(() => disposeObjectTree(new THREE.Group())).not.toThrow();
  });
});
