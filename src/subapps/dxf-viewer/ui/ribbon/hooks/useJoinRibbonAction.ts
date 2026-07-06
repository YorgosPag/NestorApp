'use client';

/**
 * ADR-186 — Action interceptor for the generic «Ένωση» (JOIN) command, the
 * inverse of «Διάλυση» (EXPLODE). Mirrors {@link useExplodeRibbonAction}: catches
 * the `join` action, merges the current selection into a single entity via the
 * undoable {@link JoinEntityCommand} (built by {@link useEntityJoin} on top of
 * {@link EntityMergeService}), reselects the result and drops the tool back to
 * `select`. Every other action falls through to the wrapped pipeline.
 *
 * JOIN is a general Modify command (AutoCAD JOIN): it operates on ANY joinable
 * selection (lines/arcs/polylines), so it lives in Home → Modify, next to
 * «Διάλυση», NOT in a per-object contextual tab. Zero new merge core — full
 * reuse of the existing `useEntityJoin` SSoT.
 */

import React from 'react';
import type { ToolType } from '../../toolbar/types';
import type { RibbonActionPayload } from '../context/RibbonCommandContext';
import { useCommandHistory } from '../../../core/commands';
import { useEntityJoin } from '../../../hooks/useEntityJoin';
import type { LevelsHookReturn } from '../../../systems/levels/useLevels';
import type { useUniversalSelection } from '../../../systems/selection';

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getSelectedEntityIds' | 'replaceEntitySelection'
>;

export interface UseJoinRibbonActionProps {
  readonly levelManager: LevelsHookReturn;
  readonly universalSelection: UniversalSelectionLike;
  readonly handleToolChange: (tool: ToolType) => void;
  /** Fall-through for non-join actions. */
  readonly fallback: (action: string, data?: RibbonActionPayload) => void;
}

export function useJoinRibbonAction(
  props: UseJoinRibbonActionProps,
): (action: string, data?: RibbonActionPayload) => void {
  const { levelManager, universalSelection, handleToolChange, fallback } = props;
  const { execute: executeCommand } = useCommandHistory();

  // Selection-agnostic JOIN SSoT — takes ids as args, executes via CommandHistory.
  const entityJoin = useEntityJoin({
    levelManager,
    executeCommand,
    setSelectedEntityIds: universalSelection.replaceEntitySelection,
  });

  return React.useCallback(
    (action: string, data?: RibbonActionPayload) => {
      if (action !== 'join') {
        fallback(action, data);
        return;
      }

      // All feedback — including the localized «no shared endpoints» toast and
      // the too-few / non-joinable-type / closed-entity cases — is owned by the
      // useEntityJoin SSoT (every JOIN entry point funnels through it). Here we
      // just invoke and drop back to `select` on success.
      const selectedIds = universalSelection.getSelectedEntityIds();
      const joined = entityJoin.joinEntities(selectedIds);
      if (joined) handleToolChange('select' as ToolType);
    },
    [entityJoin, universalSelection, handleToolChange, fallback],
  );
}
