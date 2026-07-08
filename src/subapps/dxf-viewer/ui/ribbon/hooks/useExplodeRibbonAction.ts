'use client';

/**
 * ADR-510 Φ5 — Action interceptor for the generic «Διάλυση» (EXPLODE) command.
 * Mirrors `useArrayRibbonActions`: catches the `explode` action, breaks the
 * current selection into primitives via an undoable `ExplodeEntityCommand`,
 * reselects the results and drops the tool back to `select`. Every other action
 * falls through to the wrapped pipeline.
 *
 * EXPLODE is a general Modify command (AutoCAD/Revit): it operates on ANY
 * explodable selection (polyline/rectangle), so it lives in Home → Modify, not
 * in a per-object contextual tab.
 */

import React from 'react';
import i18next from 'i18next';
import type { ToolType } from '../../toolbar/types';
import type { RibbonActionPayload } from '../context/RibbonCommandContext';
import { useCommandHistory } from '../../../core/commands';
import { ExplodeEntityCommand } from '../../../core/commands/entity-commands/ExplodeEntityCommand';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import { isExplodable } from '../../../systems/explode/explode-entity';
import { toolHintOverrideStore } from '../../../hooks/toolHintOverrideStore';
import type { Entity } from '../../../types/entities';
import type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';
import type { useUniversalSelection } from '../../../systems/selection';

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getSelectedEntityIds' | 'replaceEntitySelection'
>;

export interface UseExplodeRibbonActionProps {
  readonly levelManager: LevelSceneWriter;
  readonly universalSelection: UniversalSelectionLike;
  readonly handleToolChange: (tool: ToolType) => void;
  /** Fall-through for non-explode actions. */
  readonly fallback: (action: string, data?: RibbonActionPayload) => void;
}

export function useExplodeRibbonAction(
  props: UseExplodeRibbonActionProps,
): (action: string, data?: RibbonActionPayload) => void {
  const { levelManager, universalSelection, handleToolChange, fallback } = props;
  const { execute: executeCommand } = useCommandHistory();

  return React.useCallback(
    (action: string, data?: RibbonActionPayload) => {
      if (action !== 'explode') {
        fallback(action, data);
        return;
      }

      const levelId = levelManager.currentLevelId;
      const scene = levelId ? levelManager.getLevelScene(levelId) : null;
      if (!levelId || !scene) {
        toolHintOverrideStore.setOverride(i18next.t('tool-hints:explode.selectEntities'));
        return;
      }

      // AutoCAD EXPLODE operates on the whole selection; keep only the parts that
      // actually have something to break apart (polyline/rectangle).
      const selectedIds = universalSelection.getSelectedEntityIds();
      const explodableIds = selectedIds.filter((id) => {
        const e = scene.entities.find((x) => x.id === id) as unknown as Entity | undefined;
        return e ? isExplodable(e) : false;
      });

      if (explodableIds.length === 0) {
        toolHintOverrideStore.setOverride(i18next.t('tool-hints:explode.selectEntities'));
        return;
      }

      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelId,
      );
      const cmd = new ExplodeEntityCommand(explodableIds, sm);
      executeCommand(cmd);
      universalSelection.replaceEntitySelection(cmd.getCreatedEntityIds());
      handleToolChange('select' as ToolType);
    },
    [levelManager, universalSelection, handleToolChange, fallback, executeCommand],
  );
}
