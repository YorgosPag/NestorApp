'use client';

/**
 * USE ARRAY PATH TOOL — ADR-353 Phase C (Session C3)
 *
 * Activation hook for the path Array command (ARRAYPATH pattern).
 *
 * Flow (pre-select sources → activate → click path entity → create):
 *   1. User pre-selects N source entities → activates 'array-path'.
 *   2. On activation: validate selection. Empty / nested-array → hint + revert.
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
 */

import { useCallback, useEffect, useRef } from 'react';
import i18next from 'i18next';
import type { ICommand } from '../../core/commands/interfaces';
import { CreateArrayCommand } from '../../core/commands/entity-commands/CreateArrayCommand';
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import type { PathParams } from '../../systems/array/types';
import type { Entity, EntityType } from '../../types/entities';
import { isArrayEntity } from '../../types/entities';
import { getHoveredEntity } from '../../systems/hover/HoverStore';
import { PATH_ENTITY_TYPES } from '../../systems/array/path-pick-controller';
import type { useLevels } from '../../systems/levels';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseArrayPathToolProps {
  activeTool: string;
  selectedEntityIds: string[];
  levelManager: LevelManagerLike;
  executeCommand: (cmd: ICommand) => void;
  setSelectedEntityIds: (ids: string[]) => void;
  onToolChange?: (tool: string) => void;
}

export interface UseArrayPathToolReturn {
  readonly isActive: boolean;
  readonly handleArrayPathClick: () => void;
  readonly handleArrayPathEscape: () => void;
}

const DEFAULT_COUNT = 4;
const DEFAULT_METHOD: PathParams['method'] = 'divide';

export function useArrayPathTool(props: UseArrayPathToolProps): UseArrayPathToolReturn {
  const { activeTool, selectedEntityIds, levelManager, executeCommand, setSelectedEntityIds, onToolChange } = props;

  const wasActiveRef = useRef(false);
  const pendingSourceIdsRef = useRef<string[]>([]);
  const awaitingPathRef = useRef(false);
  const isActive = activeTool === 'array-path';

  const showHint = useCallback((key: string) => {
    toolHintOverrideStore.setOverride(i18next.t(`tool-hints:${key}`));
  }, []);

  const exitToSelect = useCallback(() => {
    pendingSourceIdsRef.current = [];
    awaitingPathRef.current = false;
    toolHintOverrideStore.setOverride(null);
    onToolChange?.('select');
  }, [onToolChange]);

  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      armPickFromSelection();
    } else if (!isActive && wasActiveRef.current) {
      pendingSourceIdsRef.current = [];
      awaitingPathRef.current = false;
      toolHintOverrideStore.setOverride(null);
    }
    wasActiveRef.current = isActive;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  function armPickFromSelection(): void {
    const levelId = levelManager.currentLevelId;
    if (!levelId) { onToolChange?.('select'); return; }
    const scene = levelManager.getLevelScene(levelId);
    if (!scene) { onToolChange?.('select'); return; }

    if (selectedEntityIds.length === 0) {
      showHint('arrayTool.needsSelection');
      onToolChange?.('select');
      return;
    }

    const sources: Entity[] = [];
    const sourceTypes: EntityType[] = [];
    for (const id of selectedEntityIds) {
      const e = scene.entities.find((x) => x.id === id) as Entity | undefined;
      if (!e) continue;
      if (isArrayEntity(e)) {
        showHint('arrayTool.nestedForbidden');
        onToolChange?.('select');
        return;
      }
      sources.push(e);
      sourceTypes.push(e.type);
    }

    if (sources.length === 0) {
      showHint('arrayTool.needsSelection');
      onToolChange?.('select');
      return;
    }

    pendingSourceIdsRef.current = selectedEntityIds.slice();
    awaitingPathRef.current = true;
    showHint('arrayTool.pickPath');
  }

  const handleArrayPathClick = useCallback((): void => {
    if (!isActive || !awaitingPathRef.current) return;

    const hoveredId = getHoveredEntity();
    if (!hoveredId) return;

    const levelId = levelManager.currentLevelId;
    if (!levelId) { exitToSelect(); return; }
    const scene = levelManager.getLevelScene(levelId);
    if (!scene) { exitToSelect(); return; }

    const pathEntity = scene.entities.find((e) => e.id === hoveredId) as Entity | undefined;
    if (!pathEntity || !PATH_ENTITY_TYPES.has(pathEntity.type)) {
      showHint('arrayTool.invalidPathType');
      return;
    }

    const sourceIds = pendingSourceIdsRef.current;
    const sourceTypes: EntityType[] = [];
    for (const id of sourceIds) {
      const e = scene.entities.find((x) => x.id === id) as Entity | undefined;
      if (e) sourceTypes.push(e.type);
    }
    if (sourceTypes.length === 0) {
      showHint('arrayTool.needsSelection');
      exitToSelect();
      return;
    }

    const params: PathParams = {
      kind: 'path',
      count: DEFAULT_COUNT,
      method: DEFAULT_METHOD,
      alignItems: false,
      reversed: false,
      pathEntityId: hoveredId,
    };

    const sm = new LevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelId,
    );

    const cmd = new CreateArrayCommand(sourceIds, 'path', params, sm, hoveredId);
    executeCommand(cmd);

    const newArrayId = cmd.getAffectedEntityIds()[0];
    if (newArrayId) setSelectedEntityIds([newArrayId]);

    exitToSelect();
  }, [isActive, levelManager, executeCommand, setSelectedEntityIds, exitToSelect, showHint]);

  const handleArrayPathEscape = useCallback((): void => {
    if (!isActive) return;
    exitToSelect();
  }, [isActive, exitToSelect]);

  return { isActive, handleArrayPathClick, handleArrayPathEscape };
}
