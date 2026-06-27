'use client';

/**
 * dispose-object-tree.ts — canonical Three.js subtree resource-disposal SSoT (ADR-537).
 *
 * Three.js does NOT free GPU memory on garbage collection: every `BufferGeometry`, `Material` and
 * `Texture` holds a WebGL handle that must be `.dispose()`-d explicitly, or it leaks for the page's
 * lifetime. Every transient overlay / ghost / live-preview that removes objects from a scene used to
 * hand-roll the SAME `root.traverse(o => o.geometry.dispose())` walk — this is the ONE place that
 * walk lives now (mirror of how Revit / Cinema 4D centralise viewport-node teardown).
 *
 * Ownership rule (the reason `materials` is opt-in): geometry built per-instance is ALWAYS safe to
 * free. Materials are usually SHARED singletons handed out by the converter SSoT — disposing those
 * would blank every other entity that reuses them. So materials (+ their textures) are freed ONLY
 * when the caller actually OWNS them (`{ materials: true }`, e.g. a CanvasTexture-on-plane ghost or a
 * fresh per-piece material). Geometry is freed unconditionally.
 *
 * Pure Three.js helper: no React, no store, no scene mutation (the caller removes the root first).
 *
 * @see ./post-fx-overlay-pass.ts — the overlay registry these previews also use
 */

import type * as THREE from 'three';

export interface DisposeObjectTreeOptions {
  /**
   * Also dispose each node's material(s) AND the textures they reference (`map`, `normalMap`, …).
   * Pass `true` ONLY when this subtree owns its materials; leave `false` (default) for shared
   * singleton converter materials, where disposing them would corrupt every other entity.
   */
  readonly materials?: boolean;
}

/** A node that may carry a disposable geometry (Mesh / Line / LineSegments / Points). */
type GeometryNode = THREE.Object3D & { geometry?: THREE.BufferGeometry };
/** A node that may carry disposable material(s) (Mesh / Line / Points / Sprite). */
type MaterialNode = THREE.Object3D & { material?: THREE.Material | THREE.Material[] };

/**
 * Dispose every GPU resource in `root`'s subtree: geometry always, materials (+ their textures)
 * only when `opts.materials` is set. Safe on a Group/Object3D with no geometry. The caller is
 * responsible for removing `root` from its parent first.
 */
export function disposeObjectTree(root: THREE.Object3D, opts?: DisposeObjectTreeOptions): void {
  const withMaterials = opts?.materials ?? false;
  root.traverse((node) => {
    (node as GeometryNode).geometry?.dispose();
    if (!withMaterials) return;
    const mat = (node as MaterialNode).material;
    if (!mat) return;
    if (Array.isArray(mat)) mat.forEach(disposeMaterialWithTextures);
    else disposeMaterialWithTextures(mat);
  });
}

/** Dispose a material and every texture it references (map / normalMap / alphaMap / …). */
function disposeMaterialWithTextures(material: THREE.Material): void {
  for (const value of Object.values(material as unknown as Record<string, unknown>)) {
    if (value && typeof value === 'object' && (value as THREE.Texture).isTexture === true) {
      (value as THREE.Texture).dispose();
    }
  }
  material.dispose();
}
