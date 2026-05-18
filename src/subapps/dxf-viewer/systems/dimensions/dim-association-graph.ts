/**
 * ADR-362 Phase J1 — Dimension Association Graph (inverse index).
 *
 * Maintains a `geometryId → Set<dimensionId>` map so the observer can do O(1)
 * lookups instead of scanning all dims every time a geometry entity changes.
 *
 * Pure data structure — no React, no Firestore, no canvas deps.
 * Rebuilt from scratch after each command (O(n_dims × n_assoc) — negligible).
 *
 * @see systems/dimensions/dim-association-service.ts — recompute functions
 * @see hooks/dimensions/useDimAssociationObserver.ts — React observer (mount)
 */

import type { DimensionEntity } from '../../types/dimension';

export class DimAssociationGraph {
  private readonly index = new Map<string, Set<string>>();

  /**
   * Rebuild the inverse index from the current set of dimension entities.
   * Clears the previous state — call after every command execute/undo/redo.
   */
  rebuild(dims: readonly DimensionEntity[]): void {
    this.index.clear();
    for (const dim of dims) {
      if (!dim.associations?.length) continue;
      for (const assoc of dim.associations) {
        let bucket = this.index.get(assoc.geometryId);
        if (!bucket) {
          bucket = new Set<string>();
          this.index.set(assoc.geometryId, bucket);
        }
        bucket.add(dim.id);
      }
    }
  }

  /**
   * Return all dimension IDs that reference the given geometry entity.
   * Returns an empty array (never throws) when the geometry has no associations.
   */
  getDimIds(geometryId: string): readonly string[] {
    const bucket = this.index.get(geometryId);
    return bucket ? Array.from(bucket) : [];
  }

  /** True if any dimension references this geometry entity. */
  has(geometryId: string): boolean {
    return this.index.has(geometryId);
  }

  /** Number of distinct geometry entities currently in the index. */
  get size(): number {
    return this.index.size;
  }
}
