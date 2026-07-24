'use client';

/**
 * ADR-683 Φ3.1γ (B1) — SSoT writer for imported-mesh param mutations originating
 * from the left-sidebar Properties tab.
 *
 * Mirrors `useRailingParamsDispatcher` (ADR-407 Φ9) so the panel writes through
 * the SAME `UpdateImportedMeshParamsCommand` pipeline already used by
 * `imported-mesh-grips.ts` (ADR-031 command-history, atomic geometry +
 * validation recompute on every commit). `isDragging=false` — each panel
 * mutation is a discrete undo step (no merging window, no implicit chain).
 *
 * Like the railing dispatcher (and unlike stair's shallow-merge), the caller
 * already computes the FULL next `ImportedMeshParams` via
 * `patchImportedMeshField` (the imported-mesh read/patch SSoT) — so this
 * dispatcher takes the complete `next` object, not a patch fragment.
 */

import { useCallback } from 'react';
import { useCommandHistory } from '../../../core/commands';
import { UpdateImportedMeshParamsCommand } from '../../../core/commands/entity-commands/UpdateImportedMeshParamsCommand';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import type { ImportedMeshEntity, ImportedMeshParams } from '../../../bim/entities/imported-mesh/imported-mesh-types';
import type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';

export interface UseImportedMeshParamsDispatcherProps {
  readonly levelManager: LevelSceneWriter;
}

export type DispatchImportedMeshParamPatch = (
  mesh: ImportedMeshEntity,
  next: ImportedMeshParams,
) => void;

export function useImportedMeshParamsDispatcher(
  props: UseImportedMeshParamsDispatcherProps,
): DispatchImportedMeshParamPatch {
  const { levelManager } = props;
  const { execute: executeCommand } = useCommandHistory();

  return useCallback<DispatchImportedMeshParamPatch>(
    (mesh, next) => {
      if (!levelManager.currentLevelId) return;
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateImportedMeshParamsCommand(mesh.id, next, mesh.params, sm, false),
      );
    },
    [executeCommand, levelManager],
  );
}
