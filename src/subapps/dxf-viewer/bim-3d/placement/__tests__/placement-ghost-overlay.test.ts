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
import { GHOST_ALPHA } from '../../../rendering/ghost/ghost-policy';

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

  it('hasObject reflects whether a root is set', () => {
    const scene = new THREE.Scene();
    const overlay = new PlacementGhostOverlay(scene, 0x444444);
    expect(overlay.hasObject).toBe(false);
    overlay.setObject(buildTree().root);
    expect(overlay.hasObject).toBe(true);
    overlay.setObject(null);
    expect(overlay.hasObject).toBe(false);
  });

  it('borrowedGeometry skips geometry disposal on clear (shared BufferGeometry safety)', () => {
    const scene = new THREE.Scene();

    // Default (owned): geometry IS disposed when the root is cleared.
    const owned = new PlacementGhostOverlay(scene, 0x111111);
    const a = buildTree();
    const disposeOwned = jest.spyOn(a.body.geometry, 'dispose');
    owned.setObject(a.root);
    owned.setObject(null);
    expect(disposeOwned).toHaveBeenCalled();

    // borrowedGeometry: geometry is NEVER disposed (clones share it with the live entity).
    const borrowed = new PlacementGhostOverlay(scene, 0x222222, GHOST_ALPHA, true);
    const b = buildTree();
    const disposeBorrowed = jest.spyOn(b.body.geometry, 'dispose');
    borrowed.setObject(b.root);
    borrowed.setObject(null);
    expect(disposeBorrowed).not.toHaveBeenCalled();
    expect(scene.children).toHaveLength(0); // still detached from the scene
  });

  it('defaults opacity to the shared GHOST_ALPHA policy', () => {
    const scene = new THREE.Scene();
    const overlay = new PlacementGhostOverlay(scene, 0x555555);
    expect(overlay.material.opacity).toBe(GHOST_ALPHA);
  });

  it('ADR-550 orderIndependent → depth-primed smooth translucency (colour blends once per pixel, no accumulation, no dots)', () => {
    const scene = new THREE.Scene();
    const overlay = new PlacementGhostOverlay(scene, 0x808080, 0.45, false, /* orderIndependent */ true);
    // Colour material stays a translucent blend, but with depthFunc EQUAL matched to the depth prime
    // AND a stencil one-write guard (NotEqual(1) → Replace 1) so coplanar faces blend only once.
    expect(overlay.material.transparent).toBe(true);
    expect(overlay.material.depthWrite).toBe(false);
    expect(overlay.material.depthFunc).toBe(THREE.EqualDepth);
    expect(overlay.material.opacity).toBe(0.45);
    expect(overlay.material.stencilWrite).toBe(true);
    expect(overlay.material.stencilFunc).toBe(THREE.NotEqualStencilFunc);
    expect(overlay.material.stencilRef).toBe(1);
    expect(overlay.material.stencilZPass).toBe(THREE.ReplaceStencilOp);

    // setObject adds a depth-prime twin per mesh (opaque, colorWrite OFF, depthWrite ON) that also
    // resets the ghost region's stencil to 0 (Always → Replace 0) so the colour pass starts clean.
    const { root } = buildTree(); // one Mesh (body) + one LineSegments (not a mesh)
    overlay.setObject(root);
    const twins: THREE.Object3D[] = [];
    root.traverse((o) => { if ((o.userData as Record<string, unknown>)['ghostDepthPrimeTwin'] === true) twins.push(o); });
    expect(twins).toHaveLength(1);
    const twinMat = (twins[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(twinMat.colorWrite).toBe(false);
    expect(twinMat.depthWrite).toBe(true);
    expect(twinMat.stencilWrite).toBe(true);
    expect(twinMat.stencilFunc).toBe(THREE.AlwaysStencilFunc);
    expect(twinMat.stencilRef).toBe(0);
  });

  it('default (blend) path is unchanged — translucent, non-depth-writing, default depthFunc, no twins', () => {
    const scene = new THREE.Scene();
    const overlay = new PlacementGhostOverlay(scene, 0x808080, 0.45);
    expect(overlay.material.transparent).toBe(true);
    expect(overlay.material.depthWrite).toBe(false);
    expect(overlay.material.depthFunc).toBe(THREE.LessEqualDepth);
    const { root } = buildTree();
    overlay.setObject(root);
    const twins: THREE.Object3D[] = [];
    root.traverse((o) => { if ((o.userData as Record<string, unknown>)['ghostDepthPrimeTwin'] === true) twins.push(o); });
    expect(twins).toHaveLength(0);
  });

  it('ADR-668 — screen-space decorations (edge overlays) are HIDDEN, never painted as ghost fill (σκουπίδι guard)', () => {
    const scene = new THREE.Scene();
    const overlay = new PlacementGhostOverlay(scene, 0x808080, 0.45);
    const root = new THREE.Group();
    const solid = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    // A BIM edge overlay (ADR-375 `attachEdgeOverlay`) — tagged, and a fat-line primitive.
    const taggedEdge = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    taggedEdge.userData['bimEdgeOverlay'] = true;
    const fatLine = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    (fatLine as unknown as { isLineSegments2: boolean }).isLineSegments2 = true;
    root.add(solid, taggedEdge, fatLine);

    overlay.setObject(root);

    // Real solid: painted with the ghost fill, stays visible.
    expect(solid.material).toBe(overlay.material);
    expect(solid.visible).toBe(true);
    // Decorations: hidden (so they never render as «σκουπίδι») and NOT repainted with the fill.
    expect(taggedEdge.visible).toBe(false);
    expect(taggedEdge.material).not.toBe(overlay.material);
    expect(fatLine.visible).toBe(false);
    expect(fatLine.material).not.toBe(overlay.material);
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
