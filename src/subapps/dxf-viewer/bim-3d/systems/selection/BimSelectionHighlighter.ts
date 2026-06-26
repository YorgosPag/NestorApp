/**
 * BimSelectionHighlighter — silhouette outline highlight for selected BIM meshes.
 *
 * Cinema 4D / Revit-style: collects every mesh whose `userData.bimId` is in the
 * selection and feeds them to a `SelectionOutlinePass` (gold silhouette outline).
 * The mesh materials are NEVER touched — only the outer silhouette is drawn.
 *
 * (Previously this painted the whole body with emissive gold. ADR-536 replaced
 * that mechanism with the OutlinePass silhouette; the `onSelect/onClear` API is
 * preserved so callers in `scene-manager-actions.ts` stay unchanged.)
 *
 * Must be cleared before BimSceneLayer.sync() rebuilds the group (old mesh refs
 * die in clearGroup — stale refs in the outline pass would leak / mis-render).
 *
 * ADR-366 A.1 / ADR-402 Phase C (multi-select) / ADR-536 (silhouette mechanism).
 */

import * as THREE from 'three';
import { dequal } from 'dequal';
import type { SelectionOutlinePass } from './SelectionOutlinePass';

export class BimSelectionHighlighter {
  /** ADR-402 Phase C — the set of currently highlighted bimIds (multi-select). */
  private _currentBimIds = new Set<string>();

  constructor(
    private readonly group: THREE.Group,
    private readonly outlinePass: SelectionOutlinePass,
  ) {}

  /**
   * Outline exactly the given set of bimIds. Diffs against the current set so a
   * repeated identical selection (e.g. a re-sync) is a no-op. On change it
   * re-collects the matching meshes and hands them to the OutlinePass — cheap
   * (collecting object refs, no material clone). ADR-402 Phase C / ADR-536.
   */
  onSelect(bimIds: ReadonlySet<string>): void {
    if (dequal(bimIds, this._currentBimIds)) return;
    this.outlinePass.setSelected(this._collectMeshes(bimIds));
    this._currentBimIds = new Set(bimIds);
  }

  onClear(): void {
    this.outlinePass.setSelected([]);
    this._currentBimIds.clear();
  }

  dispose(): void {
    this.onClear();
  }

  /** Every mesh under the group whose `userData.bimId` is in the set. */
  private _collectMeshes(bimIds: ReadonlySet<string>): THREE.Object3D[] {
    const meshes: THREE.Object3D[] = [];
    this.group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const bimId = obj.userData['bimId'] as string | undefined;
      if (bimId !== undefined && bimIds.has(bimId)) meshes.push(obj);
    });
    return meshes;
  }
}
