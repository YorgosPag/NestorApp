'use client';

/**
 * useEntityPatchCommand — SSoT for the "patch a scene entity, undoably" wiring.
 *
 * The identical block
 *
 *   const { execute } = useCommandHistory();
 *   const sm = createLevelSceneManagerAdapter(getLevelScene, setLevelScene, currentLevelId);
 *   execute(new UpdateEntityCommand(entityId, patch, sm, label));
 *
 * was inlined in the ribbon style bridges (line/dim/hatch) and is now needed by
 * the inline «Τμήματα Μοτίβου» LinePropertiesTab too (ADR-510 Φ2E #4). Extracted
 * once so the two write paths share ONE undoable command wiring (no jscpd clone).
 *
 * Builds on the existing `useSceneManagerAdapter` SSoT (the cached ADR-527 adapter
 * per current level) — this hook only adds the command-history execution on top.
 *
 * @see systems/entity-creation/useSceneManagerAdapter.ts — the adapter SSoT
 * @see core/commands/entity-commands/UpdateEntityCommand.ts — the undoable patch command
 */

import { useCallback } from 'react';
import { useCommandHistory } from '../../core/commands';
import {
  UpdateEntityCommand,
  type EntityPatch,
} from '../../core/commands/entity-commands/UpdateEntityCommand';
import {
  useSceneManagerAdapter,
  type SceneAdapterLevelManager,
} from '../../systems/entity-creation/useSceneManagerAdapter';

/** Undoable patch of arbitrary fields on a scene entity, bound to the current level. */
export type PatchEntityFn = (entityId: string, patch: EntityPatch, label?: string) => void;

/**
 * Returns a stable `patchEntity(entityId, patch, label?)` that dispatches an
 * undoable `UpdateEntityCommand` through the current-level scene manager. No-ops
 * on an empty patch or while no level is active (same guards as the inlined block).
 */
export function useEntityPatchCommand(
  levelManager: SceneAdapterLevelManager,
): PatchEntityFn {
  const { execute } = useCommandHistory();
  const getSceneManager = useSceneManagerAdapter(levelManager);
  return useCallback(
    (entityId: string, patch: EntityPatch, label = 'Update entity'): void => {
      if (Object.keys(patch).length === 0) return;
      const sm = getSceneManager();
      if (!sm) return;
      execute(new UpdateEntityCommand(entityId, patch, sm, label));
    },
    [execute, getSceneManager],
  );
}
