'use client';

/**
 * ADR-575 — Action interceptor for «Ομαδοποίηση» (GROUP) + «Κατάργηση
 * Ομαδοποίησης» (UNGROUP), the container-flavour inverse pair of «Διάλυση»
 * (EXPLODE). Mirrors {@link useExplodeRibbonAction}:
 *
 *   group   → wrap the selection into ONE composite container via the undoable
 *             {@link CreateGroupCommand}, reselect the container.
 *   ungroup → break the selected GROUP container(s) back into their members via
 *             the undoable {@link ExplodeEntityCommand} (EXPLODE already delegates
 *             the `'group'` case to the group SSoT — UNGROUP === EXPLODE of a
 *             group, so there is no separate ungroup command).
 *
 * Every other action falls through to the wrapped pipeline. GROUP/UNGROUP are
 * general Modify commands (Revit/Figma/AutoCAD), so they live in Home → Modify
 * next to «Διάλυση», not in a per-object contextual tab.
 */

import React from 'react';
import i18next from 'i18next';
import type { ToolType } from '../../toolbar/types';
import type { RibbonActionPayload } from '../context/RibbonCommandContext';
import { useCommandHistory } from '../../../core/commands';
import { CreateGroupCommand } from '../../../core/commands/entity-commands/CreateGroupCommand';
import { ExplodeEntityCommand } from '../../../core/commands/entity-commands/ExplodeEntityCommand';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import { GROUP_MIN_MEMBERS } from '../../../systems/group/group-entity';
import { isGroupEntity } from '../../../types/entities';
import { toolHintOverrideStore } from '../../../hooks/toolHintOverrideStore';
import type { Entity } from '../../../types/entities';
import type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';
import type { useUniversalSelection } from '../../../systems/selection';

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getSelectedEntityIds' | 'replaceEntitySelection'
>;

export interface UseGroupRibbonActionProps {
  readonly levelManager: LevelSceneWriter;
  readonly universalSelection: UniversalSelectionLike;
  readonly handleToolChange: (tool: ToolType) => void;
  /** Fall-through for non-group actions. */
  readonly fallback: (action: string, data?: RibbonActionPayload) => void;
}

export function useGroupRibbonAction(
  props: UseGroupRibbonActionProps,
): (action: string, data?: RibbonActionPayload) => void {
  const { levelManager, universalSelection, handleToolChange, fallback } = props;
  const { execute: executeCommand } = useCommandHistory();

  return React.useCallback(
    (action: string, data?: RibbonActionPayload) => {
      if (action !== 'group' && action !== 'ungroup') {
        fallback(action, data);
        return;
      }

      const levelId = levelManager.currentLevelId;
      const scene = levelId ? levelManager.getLevelScene(levelId) : null;
      if (!levelId || !scene) return;

      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelId,
      );
      const selectedIds = universalSelection.getSelectedEntityIds();

      if (action === 'group') {
        if (selectedIds.length < GROUP_MIN_MEMBERS) {
          toolHintOverrideStore.setOverride(i18next.t('tool-hints:group.selectEntities'));
          return;
        }
        const cmd = new CreateGroupCommand(selectedIds, sm);
        executeCommand(cmd);
        const created = cmd.getCreatedEntityId();
        universalSelection.replaceEntitySelection(created ? [created] : []);
        handleToolChange('select' as ToolType);
        return;
      }

      // ungroup — restrict to GROUP containers in the selection (EXPLODE unwraps them).
      const groupIds = selectedIds.filter((id) => {
        const e = scene.entities.find((x) => x.id === id) as unknown as Entity | undefined;
        return e ? isGroupEntity(e) : false;
      });
      if (groupIds.length === 0) {
        toolHintOverrideStore.setOverride(i18next.t('tool-hints:group.selectGroup'));
        return;
      }
      const cmd = new ExplodeEntityCommand(groupIds, sm);
      executeCommand(cmd);
      universalSelection.replaceEntitySelection(cmd.getCreatedEntityIds());
      handleToolChange('select' as ToolType);
    },
    [levelManager, universalSelection, handleToolChange, fallback, executeCommand],
  );
}
