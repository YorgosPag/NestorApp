/**
 * ADR-362 Phase J2 — React observer that keeps DimensionEntity defPoints in
 * sync with the underlying geometry after every command execute/undo/redo.
 *
 * Mount point: called once in `DxfViewerContent.tsx` alongside the other
 * viewer-level hooks. Returns orphaned dimension IDs for optional UI feedback.
 *
 * Lifecycle:
 *   - Subscribes to the global CommandHistory on mount.
 *   - On every history event (execute | undo | redo):
 *       1. Rebuild the inverse graph from current scene dims.
 *       2. Walk all dims with associations[], call applyAssociationUpdates.
 *       3. Batch-commit changed dims via LevelSceneManagerAdapter.updateEntities.
 *   - Unsubscribes on unmount (cleanup returned by useEffect).
 *
 * Why scan ALL dims on every command (not just "affected" ones):
 *   undo restores geometry, so a previously orphaned dim may regain its ref.
 *   O(n_dims × n_assoc) is negligible for typical drawings (<100 dims × <5 assoc).
 *
 * @see systems/dimensions/dim-association-graph.ts    — inverse index
 * @see systems/dimensions/dim-association-service.ts  — pure recompute
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import type { SceneModel } from '../../types/scene';
import type { SceneEntity } from '../../core/commands/interfaces';
import type { DimensionEntity } from '../../types/dimension';
import { getGlobalCommandHistory } from '../../core/commands/CommandHistory';
import { DimAssociationGraph } from '../../systems/dimensions/dim-association-graph';
import { applyAssociationUpdates } from '../../systems/dimensions/dim-association-service';
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';

// ─── Types ────────────────────────────────────────────────────────────────────

type GetLevelScene = (levelId: string) => SceneModel | null;
type SetLevelScene = (levelId: string, scene: SceneModel) => void;
type GetCurrentLevelId = () => string | null;

export interface DimAssociationObserverResult {
  /** IDs of dims whose referenced geometry no longer exists (for UI indicator). */
  orphanedDimIds: readonly string[];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDimAssociationObserver(
  getLevelScene: GetLevelScene,
  setLevelScene: SetLevelScene,
  getCurrentLevelId: GetCurrentLevelId,
): DimAssociationObserverResult {
  const graphRef = useRef(new DimAssociationGraph());
  const [orphanedDimIds, setOrphanedDimIds] = useState<readonly string[]>([]);

  const syncAssociations = useCallback(() => {
    const levelId = getCurrentLevelId();
    if (!levelId) return;

    const scene = getLevelScene(levelId);
    if (!scene?.entities.length) return;

    const dims = scene.entities.filter(
      (e): e is DimensionEntity & SceneEntity => e.type === 'dimension',
    ) as DimensionEntity[];

    const associatedDims = dims.filter(d => d.associations?.length);
    if (associatedDims.length === 0) return;

    graphRef.current.rebuild(associatedDims);

    const updates = new Map<string, Partial<SceneEntity>>();
    const newOrphanIds: string[] = [];

    for (const dim of associatedDims) {
      const { updated, orphanCount } = applyAssociationUpdates(
        dim,
        (id) => scene.entities.find(e => e.id === id) as SceneEntity | undefined,
      );
      if (orphanCount > 0) newOrphanIds.push(dim.id);
      if (updated === dim) continue;
      updates.set(dim.id, updated as unknown as Partial<SceneEntity>);
    }

    if (updates.size > 0) {
      const adapter = new LevelSceneManagerAdapter(getLevelScene, setLevelScene, levelId);
      adapter.updateEntities(updates as ReadonlyMap<string, Partial<SceneEntity>>);
    }

    setOrphanedDimIds(prev =>
      prev.length === newOrphanIds.length &&
      prev.every((id, i) => id === newOrphanIds[i])
        ? prev
        : newOrphanIds,
    );
  }, [getLevelScene, setLevelScene, getCurrentLevelId]);

  useEffect(() => {
    const history = getGlobalCommandHistory();
    return history.subscribe((event) => {
      if (event.type === 'execute' || event.type === 'undo' || event.type === 'redo') {
        syncAssociations();
      }
    });
  }, [syncAssociations]);

  return { orphanedDimIds };
}
