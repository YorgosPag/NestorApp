/**
 * StairSubElementHighlighter — ADR-358 Q19 (Revit / ArchiCAD «click-into components»).
 *
 * Highlights ONE tread / riser mesh WITHIN a parametric `StairEntity` — the stair is
 * NEVER exploded. Reuses `FaceSelectionHighlighter`'s proven "translucent overlay child
 * mesh" language (ADR-539): the `SelectionOutlinePass` silhouette is per-ENTITY (it
 * outlines the union of every mesh sharing a `bimId`), so it cannot single out one tread;
 * a lightweight overlay attached to the target mesh can.
 *
 * The overlay REUSES the target mesh's own geometry and is attached AS A CHILD of it, so
 * it inherits the tread transform automatically, is non-pickable, and uses `polygonOffset`
 * to avoid z-fighting with the tread face. On scene rebuild the tagged meshes are recreated
 * (old overlay dies with its parent), so the caller calls `refresh()` after `sync()` — the
 * highlighter keeps its own target ref and re-attaches (mirror `FaceSelectionHighlighter`).
 *
 * Two-tier (ADR-040): the SELECTED sub-element is the low-frequency SSoT
 * (`useStairSubElementSelectionStore.selected`); a single imperative store subscription in
 * `scene-manager-construct` reflects it here — no React re-render, no orbit-time cost.
 *
 * @see FaceSelectionHighlighter — the per-face sibling (Cinema 4D «Polygon Mode»).
 * @see bim/stairs/stair-sub-element-selection-store — the selection SSoT (2D + 3D).
 */

import * as THREE from 'three';
import {
  isStairSubPart,
  type StairSubElementRef,
  type StairSubPart,
} from '../../../bim/stairs/stair-sub-element-selection-store';

// ADR-358 Q19 — sub-element emphasis colour. Distinct concept from the gold whole-entity
// silhouette (selection, ADR-536) and the yellow hover (ADR-538): a bright blue tint reads
// as "drilled INTO this component" — the SAME accent the face-selection overlay uses, since
// they are mutually-exclusive edit modes (never on screen together).
const SUBELEMENT_COLOR = 0x2ea1ff;
const SUBELEMENT_OPACITY = 0.45;

/**
 * Count the tagged sub-element meshes of `stairId` for `part` in the live BIM group — the
 * ground truth for Tab-cycle wraparound (`cycleNext(count)`). Traverses once; low-frequency.
 */
export function countStairSubElementMeshes(
  group: THREE.Group,
  stairId: string,
  part: StairSubPart,
): number {
  let count = 0;
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && o.userData['bimId'] === stairId && o.userData['stairComponent'] === part) {
      count++;
    }
  });
  return count;
}

export class StairSubElementHighlighter {
  private readonly bimGroup: THREE.Group;
  private readonly material: THREE.MeshBasicMaterial;
  private overlay: THREE.Mesh | null = null;
  private target: StairSubElementRef | null = null;

  constructor(bimGroup: THREE.Group, color = SUBELEMENT_COLOR, opacity = SUBELEMENT_OPACITY) {
    this.bimGroup = bimGroup;
    this.material = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false,
      side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
  }

  /** Set / clear the highlighted sub-element. `null` (or a non-tread/riser part) clears. */
  setTarget(ref: StairSubElementRef | null): void {
    this.target = ref && isStairSubPart(ref.part) ? ref : null;
    this.rebuild();
  }

  /** Re-attach the overlay after a scene rebuild (the target mesh was recreated). */
  refresh(): void {
    if (this.target) this.rebuild();
  }

  private clearOverlay(): void {
    if (!this.overlay) return;
    this.overlay.parent?.remove(this.overlay);
    // The geometry is SHARED with the target mesh (reused, not sliced) — NEVER dispose it.
    this.overlay = null;
  }

  private rebuild(): void {
    this.clearOverlay();
    if (!this.target) return;
    const mesh = this.findMesh(this.target);
    if (!mesh) return;
    const overlay = new THREE.Mesh(mesh.geometry, this.material);
    overlay.raycast = () => undefined; // non-pickable
    overlay.renderOrder = 999;
    mesh.add(overlay); // child → inherits the tread mesh transform
    this.overlay = overlay;
  }

  private findMesh(ref: StairSubElementRef): THREE.Mesh | null {
    let found: THREE.Mesh | null = null;
    this.bimGroup.traverse((o) => {
      if (found) return;
      const m = o as THREE.Mesh;
      if (
        m.isMesh &&
        o.userData['bimId'] === ref.stairId &&
        o.userData['stairComponent'] === ref.part &&
        o.userData['stairComponentIndex'] === ref.index
      ) found = m;
    });
    return found;
  }

  dispose(): void {
    this.clearOverlay();
    this.material.dispose();
  }
}
