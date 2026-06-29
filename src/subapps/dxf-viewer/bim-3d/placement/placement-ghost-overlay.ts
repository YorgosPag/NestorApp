'use client';

/**
 * PlacementGhostOverlay — Revit/Maxon-grade SSoT for every translucent 3D placement ghost (ADR-537).
 *
 * PROBLEM: each placement ghost (column / wall / MEP fixture / segment / manifold / radiator / boiler /
 * water-heater / electrical-panel / furniture / beam-from-wall) carried a byte-identical copy of:
 *   • a translucent material + scene `add`/`remove`,
 *   • `userData = {}` + `raycast = () => {}` (non-pickable),
 *   • geometry disposal on swap/dispose.
 * AND every one used a lit `MeshStandardMaterial`, so at idle the SSAO composer + warm sun/ground
 * lighting blended through the translucent fragments → the ghost turned "mustard" (same root cause as
 * the DXF underlay + the edit gizmo, ADR-537).
 *
 * SOLUTION (one place owns it):
 *   1. UNLIT `MeshBasicMaterial` — the post-FX overlay pass renders each root standalone
 *      (`renderer.render(root, camera)`, no lights), so a lit material would render black; a flat
 *      translucent material is the correct CAD-preview look AND removes the mustard (no PBR to blend
 *      through the SSAO composite). `depthTest:true` (occluded by closer geometry), `depthWrite:false`.
 *   2. The ghost root is **registered** as a post-FX overlay (`registerPostFxOverlay`) and kept
 *      `visible=false` so the MAIN render skips it; the dedicated pass flips it on transiently AFTER
 *      SSAO → AO-immune, depth-correct (mirror of the underlay + gizmo owners).
 *
 * Each concrete ghost keeps its OWN build logic (which converter + which bridge store) and simply
 * delegates material / scene / registration / show-hide / disposal here — zero duplicated plumbing.
 *
 * Pure Three.js leaf: no React, no store subscription.
 *
 * @see ../scene/post-fx-overlay-pass.ts — the overlay registry + pass (underlay + gizmo + ghosts)
 */

import * as THREE from 'three';
import { registerPostFxOverlay } from '../scene/post-fx-overlay-pass';
import { disposeObjectTree } from '../scene/dispose-object-tree';
// Cross-backend ghost opacity policy (shared with the 2D `GHOST_DEFAULTS.alpha`) — SSoT.
import { GHOST_ALPHA } from '../../rendering/ghost/ghost-policy';

/** Options for {@link PlacementGhostOverlay.setObject}. */
export interface SetGhostObjectOptions {
  /**
   * Dispose each mesh's PREVIOUS material before overriding it with the ghost material. ONLY for
   * converters that build a fresh per-piece material (e.g. `beamToMesh` cutback pieces) — leaving the
   * default `false` is mandatory for the converters that return SHARED singleton materials (columns /
   * MEP / …), where disposing the replaced material would corrupt every committed entity reusing it.
   */
  readonly disposePrevMaterials?: boolean;
}

export class PlacementGhostOverlay {
  private readonly scene: THREE.Scene;
  /** UNLIT translucent ghost material (shared across the whole ghost subtree). */
  readonly material: THREE.MeshBasicMaterial;
  /** The current ghost root (Mesh or Group), or null when nothing is built. */
  private object: THREE.Object3D | null = null;
  /** Flag-based visibility (ADR-537): the root stays `visible=false`; the post-FX pass flips it on. */
  private shown = false;
  private disposed = false;
  private readonly unregister: () => void;
  /**
   * When `true`, the root's geometry is BORROWED (e.g. cloned committed meshes that share their
   * `BufferGeometry` with the live scene): teardown only `scene.remove`s the root and never
   * `disposeObjectTree`s it, since disposing the shared geometry would blank the real entity.
   * Default `false` — a freshly-built placement ghost OWNS its geometry and must free it.
   */
  private readonly borrowedGeometry: boolean;

  constructor(
    scene: THREE.Scene,
    colorHex: THREE.ColorRepresentation,
    opacity = GHOST_ALPHA,
    borrowedGeometry = false,
  ) {
    this.scene = scene;
    this.borrowedGeometry = borrowedGeometry;
    this.material = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    // Register: expose the live root ONLY while shown (root kept visible=false for the main render).
    this.unregister = registerPostFxOverlay(scene, () => (this.shown && this.object ? [this.object] : []));
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  /** True while a ghost root is set (built + parented), regardless of the show/hide flag. */
  get hasObject(): boolean {
    return this.object !== null;
  }

  /**
   * Swap in a freshly built ghost root (or `null` to clear). Applies the ghost material to EVERY mesh
   * in the subtree, makes the whole tree non-pickable, keeps the root `visible=false` (the post-FX
   * pass draws it), and disposes the PREVIOUS root's geometries. No-op-safe when disposed.
   */
  setObject(object: THREE.Object3D | null, opts?: SetGhostObjectOptions): void {
    this.removeObject();
    if (this.disposed || !object) return;
    const disposePrev = opts?.disposePrevMaterials ?? false;
    object.traverse((child) => {
      child.userData = {};
      child.raycast = () => {};
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        const prev = mesh.material;
        mesh.material = this.material;
        if (disposePrev && prev && prev !== this.material) {
          (Array.isArray(prev) ? prev : [prev]).forEach((m) => m.dispose());
        }
      }
    });
    object.visible = false;
    this.object = object;
    this.scene.add(object);
  }

  /** Recolour the ghost (e.g. MEP classification / palette) — preview tracks the committed colour. */
  setColor(hex: THREE.ColorRepresentation): void {
    this.material.color.set(hex);
  }

  /** Show/hide via the overlay flag — the root stays `visible=false`; the post-FX pass draws it. */
  setVisible(visible: boolean): void {
    this.shown = visible;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unregister();
    this.removeObject();
    this.material.dispose();
  }

  private removeObject(): void {
    if (!this.object) return;
    this.scene.remove(this.object);
    // Geometry is per-instance → freed via the SSoT. Materials are shared singletons from the
    // converter (or the ghost's own `this.material`, disposed once in `dispose`) → NOT freed here.
    // BORROWED geometry (cloned committed meshes) shares its `BufferGeometry` with the live
    // entity → only detach the root, never dispose (disposal would blank the real entity).
    if (!this.borrowedGeometry) disposeObjectTree(this.object);
    this.object = null;
  }
}
