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
// ADR-668 §4.7 SSoT — «is this a screen-space edge/line decoration, not a real solid?». Shared with
// the mesh3d export (`stripExportDecorations`): the SAME `LineSegments2`-extends-`Mesh` trap that
// leaked garbage twins into C4D exports also made this ghost paint edge overlays as «σκουπίδι».
import { isScreenSpaceDecoration } from '../../export/core/mesh3d/mesh3d-decorations';
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
  /**
   * ADR-550 — depth-prime companion material for the ORDER-INDEPENDENT ghost (the edit
   * «original-stays-behind» clone). `null` in the default translucent-blend mode. See the
   * constructor note for why the order-independent path needs a second material.
   */
  private readonly depthPrimeMaterial: THREE.MeshBasicMaterial | null;

  constructor(
    scene: THREE.Scene,
    colorHex: THREE.ColorRepresentation,
    opacity = GHOST_ALPHA,
    borrowedGeometry = false,
    orderIndependent = false,
  ) {
    this.scene = scene;
    this.borrowedGeometry = borrowedGeometry;
    // ADR-550 — a plain translucent-blend ghost of a MULTI-LAYER solid (a stair = many stacked
    // treads/risers/waist faces along the view ray) ACCUMULATES to opaque white with
    // `depthWrite:false` (documented `post-fx-overlay-pass` failure mode: «translucent fragments
    // accumulate to white»). The ORDER-INDEPENDENT path colours each pixel EXACTLY ONCE via a
    // two-material depth-prime + a stencil one-write guard, both drawn in a SINGLE
    // `renderer.render(root)`:
    //   1. depth-prime twins (`depthPrimeMaterial`, colorWrite OFF, depthWrite ON) → OPAQUE queue,
    //      drawn FIRST (three renders opaque before transparent): write the ghost's NEAREST depth AND
    //      reset the ghost region's stencil to 0 (`Always → Replace 0`) — self-clearing, so a prior
    //      section-cap stencil can never wrongly gate the ghost.
    //   2. the colour material → TRANSPARENT queue: `depthFunc:EqualDepth` keeps only the nearest
    //      layer, and `stencil NotEqual(1) → Replace 1` blends the FIRST fragment at each pixel then
    //      LOCKS it — so even COPLANAR flush-seated faces (a stair's waist slab + its flush tread/
    //      riser finishes, ADR-685, all at ~one depth → the «λευκή σφήνα») can never re-accumulate.
    //   `setObject` adds the twins (see `addDepthPrimeTwins`). Result: smooth translucency, correct
    //   occlusion, no white blob, no dots, robust for any geometry. Default (convex placement ghosts:
    //   column/wall/segment) keeps the cheaper single-material blend.
    if (orderIndependent) {
      this.material = new THREE.MeshBasicMaterial({
        color: colorHex, transparent: true, opacity, depthWrite: false, depthFunc: THREE.EqualDepth,
        stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
      });
      this.depthPrimeMaterial = new THREE.MeshBasicMaterial({
        colorWrite: false, depthWrite: true,
        stencilWrite: true, stencilRef: 0, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
      });
    } else {
      this.material = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity, depthWrite: false });
      this.depthPrimeMaterial = null;
    }
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
      // ADR-668 §4.7 SSoT — check BEFORE wiping userData (`bimEdgeOverlay` lives there). Edge
      // overlays (`attachEdgeOverlay` → `LineSegments2`) report `isMesh === true` (they extend
      // THREE.Mesh) but their geometry is an instanced LINE buffer; forcing the ghost's triangle
      // `MeshBasicMaterial` onto them renders «σκουπίδι» (a stray thin plane — «η κάθετη λεπτή
      // οντότητα»). The ghost is a solid fill, so HIDE decorations instead of painting them.
      const decoration = isScreenSpaceDecoration(child);
      child.userData = {};
      child.raycast = () => {};
      if (decoration) { child.visible = false; return; }
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const prev = mesh.material;
      mesh.material = this.material;
      if (disposePrev && prev && prev !== this.material) {
        (Array.isArray(prev) ? prev : [prev]).forEach((m) => m.dispose());
      }
    });
    // ADR-550 — order-independent mode: add a depth-prime twin per mesh (drawn opaque-first) so the
    // colour material (depthFunc EQUAL) blends each pixel once. Built AFTER the colour material is
    // applied above (the twins must NOT get the colour material).
    if (this.depthPrimeMaterial) this.addDepthPrimeTwins(object);
    object.visible = false;
    this.object = object;
    this.scene.add(object);
  }

  /**
   * ADR-550 — for each mesh in the ghost subtree, add a sibling «twin» that renders only DEPTH
   * (`depthPrimeMaterial`, opaque queue), sharing the twin's `BufferGeometry` (borrowed → never
   * disposed here). The twin primes the ghost's nearest depth so the colour pass blends once.
   */
  private addDepthPrimeTwins(root: THREE.Object3D): void {
    const meshes: THREE.Mesh[] = [];
    // Only VISIBLE solid meshes get a depth-prime twin — `setObject` has already hidden every
    // screen-space decoration (`visible=false`), so this skips edge overlays without re-checking.
    root.traverse((child) => { if ((child as THREE.Mesh).isMesh && child.visible) meshes.push(child as THREE.Mesh); });
    for (const m of meshes) {
      const twin = new THREE.Mesh(m.geometry, this.depthPrimeMaterial ?? undefined);
      twin.position.copy(m.position);
      twin.quaternion.copy(m.quaternion);
      twin.scale.copy(m.scale);
      twin.renderOrder = m.renderOrder;
      twin.raycast = () => {};
      twin.userData = { ghostDepthPrimeTwin: true };
      m.parent?.add(twin);
    }
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
    this.depthPrimeMaterial?.dispose();
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
