/**
 * BimSelectionHighlighter — material highlight for selected BIM meshes.
 *
 * Clones materials before modifying — NEVER mutates originals.
 * Tracks cloned materials in a UUID→original map for safe restore.
 * Must be cleared before BimSceneLayer.sync() rebuilds the group
 * (old mesh refs die in clearGroup — stale UUIDs cause leaks).
 *
 * ADR-366 A.1.
 */

import * as THREE from 'three';
import { sameSet } from '../../../utils/set-equality';

const HIGHLIGHT_EMISSIVE = new THREE.Color(0xffd700);
const HIGHLIGHT_EMISSIVE_INTENSITY = 0.3;

export class BimSelectionHighlighter {
  private readonly _originals = new Map<
    string,
    THREE.Material | THREE.Material[]
  >();
  /** ADR-402 Phase C — the set of currently highlighted bimIds (multi-select). */
  private _currentBimIds = new Set<string>();

  constructor(private readonly group: THREE.Group) {}

  /**
   * Highlight exactly the given set of bimIds, diffing against the current set so
   * a Shift+click toggle only touches the meshes that changed (no full re-traverse
   * + re-clone of the whole selection on every click). ADR-402 Phase C.
   */
  onSelect(bimIds: ReadonlySet<string>): void {
    if (sameSet(bimIds, this._currentBimIds)) return;

    this.group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const bimId = obj.userData['bimId'] as string | undefined;
      if (bimId === undefined) return;

      const shouldHighlight = bimIds.has(bimId);
      const isHighlighted = this._originals.has(obj.uuid);

      if (shouldHighlight && !isHighlighted) {
        this._originals.set(obj.uuid, obj.material);
        obj.material = this._cloneWithHighlight(obj.material);
      } else if (!shouldHighlight && isHighlighted) {
        const orig = this._originals.get(obj.uuid);
        if (orig !== undefined) {
          this._disposeClone(obj.material);
          obj.material = orig;
          this._originals.delete(obj.uuid);
        }
      }
    });

    this._currentBimIds = new Set(bimIds);
  }

  onClear(): void {
    this.group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const orig = this._originals.get(obj.uuid);
      if (orig === undefined) return;

      this._disposeClone(obj.material);
      obj.material = orig;
    });
    this._originals.clear();
    this._currentBimIds.clear();
  }

  dispose(): void {
    this.onClear();
  }

  private _cloneWithHighlight(
    mat: THREE.Material | THREE.Material[],
  ): THREE.Material | THREE.Material[] {
    if (Array.isArray(mat)) {
      return mat.map((m) => this._applyHighlight(m.clone()));
    }
    return this._applyHighlight(mat.clone());
  }

  private _applyHighlight(mat: THREE.Material): THREE.Material {
    if (mat instanceof THREE.MeshStandardMaterial) {
      mat.emissive.copy(HIGHLIGHT_EMISSIVE);
      mat.emissiveIntensity = HIGHLIGHT_EMISSIVE_INTENSITY;
    }
    return mat;
  }

  private _disposeClone(mat: THREE.Material | THREE.Material[]): void {
    if (Array.isArray(mat)) {
      for (const m of mat) m.dispose();
    } else {
      mat.dispose();
    }
  }
}
