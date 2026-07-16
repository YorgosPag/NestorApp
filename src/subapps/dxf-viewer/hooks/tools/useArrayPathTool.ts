'use client';

/**
 * USE ARRAY PATH TOOL — ADR-353 Phase C (Session C3)
 *
 * Activation hook for the path Array command (ARRAYPATH pattern).
 *
 * Flow (pre-select sources → activate → click path entity → create):
 *   1. User pre-selects N source entities → activates 'array-path'.
 *   2. On activation the selection is validated. Empty / nested-array → hint + revert.
 *   3. Enter "awaiting path pick" state — show `arrayTool.pickPath` status hint.
 *      The next canvas click is intercepted by `handleArrayPathClick`.
 *   4. Click → read `HoverStore.hoveredEntityId` (entity under cursor).
 *      If valid curve → `CreateArrayCommand('path', defaults)` → replace
 *      selection with the new ArrayEntity (auto-opens the path contextual tab),
 *      revert tool to 'select'.
 *      If invalid type → surface `arrayTool.invalidPathType` hint, keep waiting.
 *   5. ESC → exit without creating.
 *
 * Default params: count=4, method='divide', alignItems=false, reversed=false.
 *
 * Arming, hint plumbing and the command tail are shared with the rect/polar
 * array tools — see `array-tool-core.ts`.
 */

import { useCallback } from 'react';
import { useSceneManagerAdapter } from '../../systems/entity-creation/useSceneManagerAdapter';
import type { PathParams } from '../../systems/array/types';
import { getHoveredEntity } from '../../systems/hover/HoverStore';
import { PATH_ENTITY_TYPES } from '../../systems/array/path-pick-controller';
import {
  commitArrayCommand,
  findArrayEntity,
  resolveArrayScene,
  resolvePendingSourcesInScene,
  showArrayHint,
  useArraySourcePick,
  type ArrayToolProps,
} from './array-tool-core';

export type UseArrayPathToolProps = ArrayToolProps;

export interface UseArrayPathToolReturn {
  readonly isActive: boolean;
  readonly handleArrayPathClick: () => void;
  readonly handleArrayPathEscape: () => void;
}

const DEFAULT_COUNT = 4;
const DEFAULT_METHOD: PathParams['method'] = 'divide';

export function useArrayPathTool(props: UseArrayPathToolProps): UseArrayPathToolReturn {
  const { activeTool, levelManager, executeCommand, setSelectedEntityIds } = props;

  const isActive = activeTool === 'array-path';
  const getSceneManager = useSceneManagerAdapter(levelManager);
  const pick = useArraySourcePick(props, isActive, 'arrayTool.pickPath');

  const handleArrayPathClick = useCallback((): void => {
    if (!isActive || !pick.isAwaiting()) return;

    const hoveredId = getHoveredEntity();
    if (!hoveredId) return;

    const scene = resolveArrayScene(levelManager);
    if (!scene) {
      pick.exitToSelect();
      return;
    }

    // A non-curve pick leaves the tool armed, so the user can click a valid path next.
    const pathEntity = findArrayEntity(scene, hoveredId);
    if (!pathEntity || !PATH_ENTITY_TYPES.has(pathEntity.type)) {
      showArrayHint('arrayTool.invalidPathType');
      return;
    }

    const ctx = resolvePendingSourcesInScene(scene, pick);
    if (!ctx) return;

    const params: PathParams = {
      kind: 'path',
      count: DEFAULT_COUNT,
      method: DEFAULT_METHOD,
      alignItems: false,
      reversed: false,
      pathEntityId: hoveredId,
    };

    const committed = commitArrayCommand(
      getSceneManager,
      ctx.sourceIds,
      'path',
      params,
      executeCommand,
      setSelectedEntityIds,
      hoveredId,
    );
    if (!committed) return;

    pick.exitToSelect();
  }, [isActive, pick, levelManager, executeCommand, setSelectedEntityIds, getSceneManager]);

  const handleArrayPathEscape = useCallback((): void => {
    if (!isActive) return;
    pick.exitToSelect();
  }, [isActive, pick]);

  return { isActive, handleArrayPathClick, handleArrayPathEscape };
}
