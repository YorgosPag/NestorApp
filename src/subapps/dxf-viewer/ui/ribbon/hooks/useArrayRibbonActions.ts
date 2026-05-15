'use client';

/**
 * ADR-353 Phase A — Action interceptor for the contextual Array ribbon
 * tab. Routes the three contextual-tab buttons to their command/state
 * effects before falling through to the standard `wrappedHandleAction`
 * pipeline:
 *
 *   array-explode      → ExplodeArrayCommand on the primary array, then
 *                        switch tool back to 'select'.
 *   array-edit-source  → enter Edit Source mode (Q21) for the primary
 *                        array.
 *   array-close-tab    → clear the primary selection so the contextual
 *                        tab disappears.
 *
 * Mirrors the small "wrappedHandleAction" pattern used in
 * useDxfViewerCallbacks for cross-cutting UI side-effects.
 */

import React from 'react';
import type { ToolType } from '../../toolbar/types';
import type { RibbonActionPayload } from '../context/RibbonCommandContext';
import { useCommandHistory } from '../../../core/commands';
import { ExplodeArrayCommand } from '../../../core/commands/entity-commands/ExplodeArrayCommand';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import { enterEditSource } from '../../../systems/array/array-edit-source-mode';
import { isArrayEntity } from '../../../types/entities';
import type { useLevels } from '../../../systems/levels';
import type { useUniversalSelection } from '../../../systems/selection';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getPrimaryId' | 'clearByType'
>;

export interface UseArrayRibbonActionsProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
  readonly setSelectedEntityIds: (ids: string[]) => void;
  readonly handleToolChange: (tool: ToolType) => void;
  /** Fall-through for non-array actions. */
  readonly fallback: (action: string, data?: RibbonActionPayload) => void;
}

export function useArrayRibbonActions(
  props: UseArrayRibbonActionsProps,
): (action: string, data?: RibbonActionPayload) => void {
  const {
    levelManager,
    universalSelection,
    setSelectedEntityIds,
    handleToolChange,
    fallback,
  } = props;
  const { execute: executeCommand } = useCommandHistory();

  return React.useCallback(
    (action: string, data?: RibbonActionPayload) => {
      if (
        action !== 'array-explode' &&
        action !== 'array-edit-source' &&
        action !== 'array-close-tab'
      ) {
        fallback(action, data);
        return;
      }

      const primaryId = universalSelection.getPrimaryId();
      const levelId = levelManager.currentLevelId;
      if (!primaryId || !levelId) {
        fallback(action, data);
        return;
      }

      if (action === 'array-close-tab') {
        universalSelection.clearByType('dxf-entity');
        setSelectedEntityIds([]);
        handleToolChange('select' as ToolType);
        return;
      }

      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      const entity = scene.entities.find((e) => e.id === primaryId);
      if (!entity || !isArrayEntity(entity)) return;

      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelId,
      );

      if (action === 'array-explode') {
        const cmd = new ExplodeArrayCommand(entity.id, sm);
        executeCommand(cmd);
        const created = cmd.getAffectedEntityIds().slice(1);
        universalSelection.clearByType('dxf-entity');
        setSelectedEntityIds(created);
        handleToolChange('select' as ToolType);
        return;
      }

      if (action === 'array-edit-source') {
        enterEditSource(entity.id, sm);
        return;
      }
    },
    [
      fallback,
      levelManager,
      universalSelection,
      executeCommand,
      setSelectedEntityIds,
      handleToolChange,
    ],
  );
}
