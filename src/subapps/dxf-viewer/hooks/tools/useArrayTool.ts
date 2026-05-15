/**
 * USE ARRAY TOOL — ADR-353 Phase A (Session A4)
 *
 * Activation hook for the rectangular Array command. Pattern: ARRAYRECT
 * in AutoCAD — pre-select source entities → trigger command → an
 * associative ArrayEntity is created with industry defaults (3×4,
 * spacing = bbox × 1.5, angle 0°) → ribbon contextual tab opens for
 * live parameter adjustment.
 *
 * Flow (Q4 — both selection orders supported):
 *   1. User pre-selects N source entities → activates 'array-rect'.
 *   2. On activation we validate the selection. If empty, surface a
 *      tool hint asking for sources and revert to 'select' immediately.
 *   3. Otherwise we issue CreateArrayCommand, switch back to 'select',
 *      and replace the selection with the new ArrayEntity id so the
 *      ribbon contextual tab auto-opens (DxfViewerContent watches
 *      `primarySelectedId` to flip `activeContextualTrigger`).
 *
 * Live parameter editing (rows/cols/spacing/angle/grip drag) is owned
 * by `useRibbonArrayBridge` + `array-grip-handlers.ts`. This hook only
 * owns activation + initial creation.
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import i18next from 'i18next';
import type { ICommand } from '../../core/commands/interfaces';
import { CreateArrayCommand } from '../../core/commands/entity-commands/CreateArrayCommand';
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { computeSourceGroupBbox, defaultRectSpacing } from '../../systems/array/array-bbox';
import { validateArrayParams } from '../../systems/array/array-validation';
import type { RectParams } from '../../systems/array/types';
import type { Entity, EntityType } from '../../types/entities';
import { isArrayEntity } from '../../types/entities';
import type { useLevels } from '../../systems/levels';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseArrayToolProps {
  activeTool: string;
  selectedEntityIds: string[];
  levelManager: LevelManagerLike;
  executeCommand: (cmd: ICommand) => void;
  setSelectedEntityIds: (ids: string[]) => void;
  onToolChange?: (tool: string) => void;
}

export interface UseArrayToolReturn {
  /** True while 'array-rect' is the active tool. */
  readonly isActive: boolean;
}

const DEFAULT_ROWS = 3;
const DEFAULT_COLS = 4;

export function useArrayTool(props: UseArrayToolProps): UseArrayToolReturn {
  const {
    activeTool,
    selectedEntityIds,
    levelManager,
    executeCommand,
    setSelectedEntityIds,
    onToolChange,
  } = props;

  const wasActiveRef = useRef(false);
  const isActive = activeTool === 'array-rect';

  const getSceneManager = useCallback(() => {
    if (!levelManager.currentLevelId) return null;
    return new LevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
  }, [levelManager]);

  const showHint = useCallback((key: string) => {
    toolHintOverrideStore.setOverride(i18next.t(`tool-hints:${key}`));
  }, []);

  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      // Activation edge — try to create the array from the current selection.
      tryCreateFromSelection();
    } else if (!isActive && wasActiveRef.current) {
      toolHintOverrideStore.setOverride(null);
    }
    wasActiveRef.current = isActive;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  function tryCreateFromSelection(): void {
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;
    const scene = levelManager.getLevelScene(levelId);
    if (!scene) return;

    // Phase A handoff to 'select' — even on early exit we never linger on
    // 'array-rect' (it is a single-shot activation, not a stateful tool).
    const exitToSelect = () => onToolChange?.('select');

    if (selectedEntityIds.length === 0) {
      showHint('arrayTool.needsSelection');
      exitToSelect();
      return;
    }

    const sources: Entity[] = [];
    const sourceTypes: EntityType[] = [];
    for (const id of selectedEntityIds) {
      const e = scene.entities.find((x) => x.id === id) as Entity | undefined;
      if (!e) continue;
      if (isArrayEntity(e)) {
        // Q19 nested-array guard surfaced as a hint and abort.
        showHint('arrayTool.nestedForbidden');
        exitToSelect();
        return;
      }
      sources.push(e);
      sourceTypes.push(e.type);
    }

    if (sources.length === 0) {
      showHint('arrayTool.needsSelection');
      exitToSelect();
      return;
    }

    const bbox = computeSourceGroupBbox(sources);
    const { rowSpacing, colSpacing } = defaultRectSpacing(bbox);
    const params: RectParams = {
      kind: 'rect',
      rows: DEFAULT_ROWS,
      cols: DEFAULT_COLS,
      rowSpacing,
      colSpacing,
      angle: 0,
    };

    const validation = validateArrayParams(params, sourceTypes);
    if (validation.severity === 'error') {
      // Surface the generic "needs selection" hint — validation errors at
      // creation time mean the user picked unsupported entities. The full
      // i18n hint catalog for each validation.messageKey lives under
      // `dxf-viewer-shell:array.validation.*` (used by future toast wiring).
      showHint('arrayTool.needsSelection');
      exitToSelect();
      return;
    }

    const sm = getSceneManager();
    if (!sm) {
      exitToSelect();
      return;
    }

    const cmd = new CreateArrayCommand(
      selectedEntityIds.slice(),
      'rect',
      params,
      sm,
    );
    executeCommand(cmd);

    // Replace selection with the new ArrayEntity so the contextual ribbon
    // tab opens (DxfViewerContent watches primarySelectedId.type === 'array').
    const newArrayId = cmd.getAffectedEntityIds()[0];
    if (newArrayId) setSelectedEntityIds([newArrayId]);

    toolHintOverrideStore.setOverride(null);
    exitToSelect();
  }

  return { isActive };
}
