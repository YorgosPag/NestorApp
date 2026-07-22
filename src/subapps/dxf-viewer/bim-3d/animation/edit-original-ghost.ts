'use client';

/**
 * EditOriginalGhost — the dimmed "original stays behind as a ghost" leaf for the 3D edit
 * live-preview (ADR-402 / ADR-550), the 3D mirror of the 2D move policy.
 *
 * PROBLEM (Giorgio, 3D top-view move): during a rigid move/rotate the gizmo mutates the
 * edited entity's OWN meshes (`Bim3DEditLivePreview.applyMove/applyRotate`) — that IS the
 * real moving copy (ghost === commit), but it means NOTHING stays at the source, so the
 * entity "vanishes" and only the 2D-drawn grips remain floating. The 2D canvas already
 * keeps the original in place dimmed to `GHOST_ALPHA` while its real copy is drawn moved
 * (`movePreviewActive`); this leaf brings the SAME policy to the 3D viewport.
 *
 * SOLUTION: at capture we CLONE the edited meshes and park the clones, frozen at the source
 * pose, as a translucent ghost — so the user sees the original "left behind" (Revit / Maxon
 * Cinema 4D parity) while the real meshes follow the cursor. View-agnostic by construction:
 * a translucent material reads correctly under any camera (top / perspective / …), no
 * projection math.
 *
 * SSoT reuse (NO new ghost machinery):
 *   • `PlacementGhostOverlay` (ADR-537) owns the UNLIT translucent material + the post-FX
 *     overlay pass (AO-immune → no "mustard", depth-correct) + non-pickable plumbing. We drive
 *     it with `borrowedGeometry: true` so teardown never disposes the geometry the clones SHARE
 *     with the live entity.
 *   • `GHOST_ALPHA` — the one cross-backend opacity policy (== 2D `GHOST_DEFAULTS.alpha`).
 *
 * The ghost colour tracks the entity's ACTUAL on-screen colour: we read it straight off the
 * source mesh's material (the exact committed colour), so the dimmed ghost reads as "this
 * entity, faded" — same intent as the 2D `resolveEntityColorHex` ghost, sourced from the live
 * material for guaranteed parity. Falls back to the 2D ghost cyan when a mesh carries no
 * plain colour (vertex-coloured / textured).
 *
 * Pure three.js leaf: no React, no store, no converter import (trivially testable).
 *
 * @see ../placement/placement-ghost-overlay.ts — the reused translucent-overlay SSoT
 * @see ./bim3d-edit-live-preview.ts — the owner that captures / commits / cancels
 */

import * as THREE from 'three';
import { PlacementGhostOverlay } from '../placement/placement-ghost-overlay';
import { GHOST_ALPHA } from '../../rendering/ghost/ghost-policy';

/** 2D ghost cyan (`GHOST_DEFAULTS.color`) — fallback when a mesh has no plain material colour. */
const GHOST_FALLBACK_HEX = 0x00bfff;

export class EditOriginalGhost {
  /** The reused translucent-overlay SSoT, lazily bound to the scene on first show. */
  private overlay: PlacementGhostOverlay | null = null;

  /** True while a frozen ghost is parked at the source pose. */
  get isActive(): boolean {
    return this.overlay !== null && this.overlay.hasObject;
  }

  /**
   * Park a frozen, dimmed clone of `sourceMeshes` at their CURRENT pose. Call BEFORE the
   * source meshes are transformed (so the clones capture the pre-drag pose). No-op for an
   * empty set or when the meshes are not yet parented under a scene.
   *
   * ADR-550 — `reapplyClip` re-asserts the ACTIVE section clip planes onto the ghost subtree
   * after it is built. The ghost gets a FRESH unlit material (`PlacementGhostOverlay`), so it
   * starts with `clippingPlanes = null` and — under an active Επίπεδο Τομής — would draw at
   * FULL height on top of the cut frame (an opaque white silhouette above the cut). Clipping it
   * matches the real, already-clipped meshes (Revit/ArchiCAD: the drag ghost respects the
   * section too). Omitted → no clip (view/section-agnostic default, keeps the class testable).
   */
  show(sourceMeshes: readonly THREE.Object3D[], reapplyClip?: (root: THREE.Object3D) => void): void {
    if (sourceMeshes.length === 0) return;
    const scene = rootSceneOf(sourceMeshes[0]);
    if (!scene) return;
    const colorHex = pickGhostColor(sourceMeshes);
    if (!this.overlay) {
      // ADR-550 — `orderIndependent: true`: the edited entity can be a MULTI-LAYER solid (a stair),
      // whose stacked faces would accumulate a plain translucent-blend ghost to opaque white. The
      // depth-prime (colour blended once per pixel) path keeps a SMOOTH translucent ghost, no dots.
      this.overlay = new PlacementGhostOverlay(scene, colorHex, GHOST_ALPHA, /* borrowedGeometry */ true, /* orderIndependent */ true);
    } else {
      this.overlay.setColor(colorHex);
    }
    const group = new THREE.Group();
    // `Object3D.clone()` shares geometry + material by reference and copies the local transform
    // — exactly what we want: a cheap frozen snapshot at the source pose (borrowed geometry).
    for (const src of sourceMeshes) group.add(src.clone());
    this.overlay.setObject(group);
    // ADR-550 — the ghost material is the overlay's own (applied by `setObject`), so re-assert
    // AFTER the swap so the clip planes land on THAT material (idempotent, self-heals off-section).
    reapplyClip?.(group);
    this.overlay.setVisible(true);
  }

  /** Remove the frozen ghost (real command re-sync / cancel). Geometry is borrowed → not freed. */
  clear(): void {
    if (!this.overlay) return;
    this.overlay.setVisible(false);
    this.overlay.setObject(null);
  }

  /** Free the overlay's own ghost material + post-FX registration (viewport teardown). */
  dispose(): void {
    this.overlay?.dispose();
    this.overlay = null;
  }
}

/** Walk to the topmost ancestor and return it when it is a `THREE.Scene`. */
function rootSceneOf(object: THREE.Object3D | undefined): THREE.Scene | null {
  let node: THREE.Object3D | null = object ?? null;
  let last: THREE.Object3D | null = node;
  while (node) {
    last = node;
    node = node.parent;
  }
  return last && (last as THREE.Scene).isScene ? (last as THREE.Scene) : null;
}

/** The entity's on-screen colour: first plain material colour found in the subtree, else cyan. */
function pickGhostColor(meshes: readonly THREE.Object3D[]): THREE.ColorRepresentation {
  for (const mesh of meshes) {
    let hex: number | null = null;
    mesh.traverse((node) => {
      if (hex !== null) return;
      const material = (node as THREE.Mesh).material;
      const single = Array.isArray(material) ? material[0] : material;
      const color = (single as THREE.MeshStandardMaterial | undefined)?.color;
      if (color) hex = color.getHex();
    });
    if (hex !== null) return hex;
  }
  return GHOST_FALLBACK_HEX;
}
