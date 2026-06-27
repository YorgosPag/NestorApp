/**
 * ADR-537 — PlacementGhostOverlay SSoT (shared translucent post-FX ghost for every placement tool).
 *
 * Verifies the one-place contract every ghost now delegates to:
 *   • unlit translucent material, exposed via the post-FX registry ONLY while shown,
 *   • the root kept visible=false (main render skips it; the pass flips it on),
 *   • ghost material applied to EVERY mesh + whole tree made non-pickable,
 *   • setColor recolours, setObject(null) clears, dispose unregisters,
 *   • disposePrevMaterials disposes the replaced per-piece materials (beam cutback) — and is OFF by
 *     default so shared singleton converter materials are never corrupted.
 */

import * as THREE from 'three';
import { PlacementGhostOverlay } from '../placement-ghost-overlay';
import { collectPostFxOverlayRoots } from '../../scene/post-fx-overlay-pass';

function buildTree(): { root: THREE.Group; body: THREE.Mesh; edges: THREE.LineSegments } {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial());
  root.add(body);
  root.add(edges);
  return { root, body, edges };
}

describe('PlacementGhostOverlay', () => {
  it('is unlit + translucent and exposed only while shown, root kept invisible', () => {
    const scene = new THREE.Scene();
    const overlay = new PlacementGhostOverlay(scene, 0x123456, 0.4);
    expect(overlay.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(overlay.material.transparent).toBe(true);
    expect(overlay.material.opacity).toBe(0.4);

    const { root, body } = buildTree();
    overlay.setObject(root);
    // Built but not shown yet.
    expect(collectPostFxOverlayRoots(scene)).toEqual([]);
    // Ghost material applied to the mesh; non-pickable; root invisible to the main render.
    expect(body.material).toBe(overlay.material);
    expect(root.visible).toBe(false);
    const hits: THREE.Intersection[] = [];
    body.raycast(new THREE.Raycaster(), hits);
    expect(hits).toHaveLength(0);

    overlay.setVisible(true);
    expect(collectPostFxOverlayRoots(scene)).toEqual([root]);
    overlay.setVisible(false);
    expect(collectPostFxOverlayRoots(scene)).toEqual([]);
  });

  it('setObject(null) clears the previous root from the scene', () => {
    const scene = new THREE.Scene();
    const overlay = new PlacementGhostOverlay(scene, 0xffffff);
    const { root } = buildTree();
    overlay.setObject(root);
    overlay.setVisible(true);
    overlay.setObject(null);
    expect(scene.children).toHaveLength(0);
    expect(collectPostFxOverlayRoots(scene)).toEqual([]);
  });

  it('setColor recolours the shared ghost material', () => {
    const scene = new THREE.Scene();
    const overlay = new PlacementGhostOverlay(scene, 0x000000);
    overlay.setColor(0xff0000);
    expect(overlay.material.color.getHex()).toBe(0xff0000);
  });

  it('disposePrevMaterials disposes replaced per-piece materials (default OFF keeps them)', () => {
    const scene = new THREE.Scene();

    // Default: replaced material is NOT disposed (shared singleton safety).
    const keep = new PlacementGhostOverlay(scene, 0x111111);
    const a = buildTree();
    const prevA = a.body.material as THREE.Material;
    const disposeA = jest.spyOn(prevA, 'dispose');
    keep.setObject(a.root);
    expect(disposeA).not.toHaveBeenCalled();

    // Opt-in: replaced per-piece material IS disposed (beam cutback).
    const drop = new PlacementGhostOverlay(scene, 0x222222);
    const b = buildTree();
    const prevB = b.body.material as THREE.Material;
    const disposeB = jest.spyOn(prevB, 'dispose');
    drop.setObject(b.root, { disposePrevMaterials: true });
    expect(disposeB).toHaveBeenCalled();
  });

  it('dispose unregisters the provider and clears the scene', () => {
    const scene = new THREE.Scene();
    const overlay = new PlacementGhostOverlay(scene, 0x333333);
    overlay.setObject(buildTree().root);
    overlay.setVisible(true);
    expect(collectPostFxOverlayRoots(scene)).toHaveLength(1);
    overlay.dispose();
    expect(collectPostFxOverlayRoots(scene)).toEqual([]);
    expect(scene.children).toHaveLength(0);
    expect(overlay.isDisposed).toBe(true);
  });
});
