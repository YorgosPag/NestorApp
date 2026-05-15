/**
 * USE ARRAY POLAR TOOL — ADR-353 Phase B (Session B2)
 *
 * Activation hook for the polar Array command (ARRAYPOLAR pattern).
 *
 * Flow (pre-select sources → activate → pick center → create):
 *   1. User pre-selects N source entities → activates 'array-polar'.
 *   2. On activation we validate the selection. Empty / nested-array
 *      selection → hint + revert to 'select'.
 *   3. Otherwise we enter "awaiting center pick" state and surface the
 *      `arrayTool.pickCenter` status-bar prompt. The next snap-aware
 *      canvas click lands the polar centre.
 *   4. Click → CreateArrayCommand('polar', { count:6, fillAngle:360,
 *      startAngle:0, rotateItems:true, center, radius:0 }), replace
 *      selection with the new ArrayEntity (auto-opens the polar
 *      contextual tab via DxfViewerContent's trigger lookup), revert
 *      tool to 'select'.
 *   5. ESC → exit without creating.
 *
 * Live parameter editing (count/angles/radius/rotate/grip drag) is owned
 * by `useRibbonArrayBridge` + `array-grip-handlers.ts`. This hook only
 * owns activation + initial creation (single-shot).
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import i18next from 'i18next';
import type { ICommand } from '../../core/commands/interfaces';
import type { Point2D } from '../../rendering/types/Types';
import { CreateArrayCommand } from '../../core/commands/entity-commands/CreateArrayCommand';
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { validateArrayParams } from '../../systems/array/array-validation';
import type { PolarParams } from '../../systems/array/types';
import type { Entity, EntityType } from '../../types/entities';
import { isArrayEntity } from '../../types/entities';
import type { useLevels } from '../../systems/levels';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseArrayPolarToolProps {
  activeTool: string;
  selectedEntityIds: string[];
  levelManager: LevelManagerLike;
  executeCommand: (cmd: ICommand) => void;
  setSelectedEntityIds: (ids: string[]) => void;
  onToolChange?: (tool: string) => void;
}

export interface UseArrayPolarToolReturn {
  /** True while 'array-polar' is the active tool. */
  readonly isActive: boolean;
  /** Forward a snapped world click to the polar tool. */
  readonly handleArrayPolarClick: (worldPoint: Point2D) => void;
  /** ESC handler — abort without creating. */
  readonly handleArrayPolarEscape: () => void;
}

const DEFAULT_COUNT = 6;
const DEFAULT_FILL_ANGLE = 360;
const DEFAULT_START_ANGLE = 0;
const DEFAULT_ROTATE_ITEMS = true;

export function useArrayPolarTool(
  props: UseArrayPolarToolProps,
): UseArrayPolarToolReturn {
  const {
    activeTool,
    selectedEntityIds,
    levelManager,
    executeCommand,
    setSelectedEntityIds,
    onToolChange,
  } = props;

  const wasActiveRef = useRef(false);
  const pendingSourceIdsRef = useRef<string[]>([]);
  const awaitingCenterRef = useRef(false);
  const isActive = activeTool === 'array-polar';

  const showHint = useCallback((key: string) => {
    toolHintOverrideStore.setOverride(i18next.t(`tool-hints:${key}`));
  }, []);

  const exitToSelect = useCallback(() => {
    pendingSourceIdsRef.current = [];
    awaitingCenterRef.current = false;
    toolHintOverrideStore.setOverride(null);
    onToolChange?.('select');
  }, [onToolChange]);

  // Activation edge — validate pre-selection and enter awaiting-center state.
  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      armPickFromSelection();
    } else if (!isActive && wasActiveRef.current) {
      pendingSourceIdsRef.current = [];
      awaitingCenterRef.current = false;
      toolHintOverrideStore.setOverride(null);
    }
    wasActiveRef.current = isActive;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  function armPickFromSelection(): void {
    const levelId = levelManager.currentLevelId;
    if (!levelId) {
      onToolChange?.('select');
      return;
    }
    const scene = levelManager.getLevelScene(levelId);
    if (!scene) {
      onToolChange?.('select');
      return;
    }

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
    awaitingCenterRef.current = true;
    showHint('arrayTool.pickCenter');
  }

  const handleArrayPolarClick = useCallback(
    (worldPoint: Point2D): void => {
      if (!isActive) return;
      if (!awaitingCenterRef.current) return;
      const levelId = levelManager.currentLevelId;
      if (!levelId) {
        exitToSelect();
        return;
      }
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) {
        exitToSelect();
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

      const params: PolarParams = {
        kind: 'polar',
        count: DEFAULT_COUNT,
        fillAngle: DEFAULT_FILL_ANGLE,
        startAngle: DEFAULT_START_ANGLE,
        rotateItems: DEFAULT_ROTATE_ITEMS,
        center: { x: worldPoint.x, y: worldPoint.y },
        radius: 0,
      };

      const validation = validateArrayParams(params, sourceTypes);
      if (validation.severity === 'error') {
        showHint('arrayTool.needsSelection');
        exitToSelect();
        return;
      }

      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelId,
      );

      const cmd = new CreateArrayCommand(sourceIds, 'polar', params, sm);
      executeCommand(cmd);

      const newArrayId = cmd.getAffectedEntityIds()[0];
      if (newArrayId) setSelectedEntityIds([newArrayId]);

      exitToSelect();
    },
    [isActive, levelManager, executeCommand, setSelectedEntityIds, exitToSelect, showHint],
  );

  const handleArrayPolarEscape = useCallback((): void => {
    if (!isActive) return;
    exitToSelect();
  }, [isActive, exitToSelect]);

  return { isActive, handleArrayPolarClick, handleArrayPolarEscape };
}
