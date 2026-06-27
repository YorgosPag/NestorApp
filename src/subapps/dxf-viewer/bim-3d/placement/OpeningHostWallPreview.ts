'use client';

/**
 * OpeningHostWallPreview — live preview swap for the host wall(s) of a dragged opening
 * (ADR-363 Φ1G.5 Slice 2g, Revit "moving hole"). While a hosted opening is dragged the
 * wall void must follow the cursor; this manager hides the original wall + opening-body
 * meshes and shows freshly rebuilt previews (the hole + solid body at the dragged
 * position) — for ONE wall on a slide, or TWO on a re-host (old host closes its hole,
 * new host opens one).
 *
 * Mirrors the gizmo's `Bim3DEditLivePreview` swap (hide originals by `bimId`, add preview
 * to the bim group, restore on cancel / drop-refs on commit) but is MULTI-WALL and makes
 * the previews NON-PICKABLE: THREE's raycaster ignores `visible`, so the hidden originals
 * stay raycastable and keep the cursor read stable even over the new (preview) hole, while
 * the previews never intercept a pick.
 *
 * Pure Three.js — no React, no store. The `useBim3DOpeningMove` hook drives it.
 */

import * as THREE from 'three';
import { disposeObjectTree } from '../scene/dispose-object-tree';

/** One wall to preview: the bimIds to hide (wall + its opening bodies) + the rebuilt mesh. */
export interface OpeningHostWallRebuild {
  readonly hideIds: ReadonlySet<string>;
  readonly object: THREE.Object3D;
}

export class OpeningHostWallPreview {
  private readonly group: THREE.Object3D;
  private readonly hidden = new Set<THREE.Object3D>();
  private readonly previews: THREE.Object3D[] = [];
  private disposed = false;

  constructor(group: THREE.Object3D) {
    this.group = group;
  }

  /** Hide the originals named by `rebuilds` and show their (non-pickable) preview meshes. */
  update(rebuilds: readonly OpeningHostWallRebuild[]): void {
    if (this.disposed) return;
    this.clearPreviews();
    this.restoreHidden();
    const hideAll = new Set<string>();
    for (const r of rebuilds) for (const id of r.hideIds) hideAll.add(id);
    this.group.traverse((obj) => {
      const id = obj.userData['bimId'] as string | undefined;
      if (id !== undefined && hideAll.has(id) && obj.visible) {
        obj.visible = false;
        this.hidden.add(obj);
      }
    });
    for (const r of rebuilds) {
      stripRaycast(r.object);
      this.group.add(r.object);
      this.previews.push(r.object);
    }
  }

  /** Release commit: drop the previews but LEAVE the originals hidden — the scene re-sync
   *  replaces every wall mesh, so restoring here would flash the old hole for one frame. */
  commit(): void {
    this.clearPreviews();
    this.hidden.clear();
  }

  /** Cancel / no-op move: drop the previews and restore the originals. */
  cancel(): void {
    this.clearPreviews();
    this.restoreHidden();
  }

  dispose(): void {
    if (this.disposed) return;
    this.cancel();
    this.disposed = true;
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private restoreHidden(): void {
    for (const obj of this.hidden) obj.visible = true;
    this.hidden.clear();
  }

  private clearPreviews(): void {
    for (const obj of this.previews) {
      this.group.remove(obj);
      // Geometry is per-frame rebuilt → free it; materials are shared converter singletons.
      disposeObjectTree(obj);
    }
    this.previews.length = 0;
  }
}

/** Make an object (and all descendants) ignore raycasts — a visual-only preview. */
function stripRaycast(root: THREE.Object3D): void {
  root.traverse((obj) => {
    obj.raycast = () => {};
  });
}
