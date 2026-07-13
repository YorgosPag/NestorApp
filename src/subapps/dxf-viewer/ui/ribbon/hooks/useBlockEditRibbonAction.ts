'use client';

/**
 * ADR-641 (single-click selection surface) — action interceptor για το «Επεξεργασία
 * Μπλοκ» (Block Editor / BEDIT) κουμπί του contextual block tab.
 *
 * Mirror του `useExplodeRibbonAction`: πιάνει το `block-edit` action, resolve το
 * μοναδικό επιλεγμένο block και μπαίνει στον exclusive Block Editor καλώντας το ΙΔΙΟ
 * SSoT ζεύγος με το double-click (`enterBlockEdit` + `computeBlockEditViewTransform`,
 * useCanvasSectionUI.ts) — μηδέν νέα λογική/extraction, ribbon-button ≡ double-click.
 * Κάθε άλλο action πέφτει στο wrapped fallback.
 *
 * GROUP mutual-exclusivity (ADR-641 §7): ποτέ BEDIT όσο είμαστε μέσα σε group.
 *
 * @see hooks/canvas/useCanvasSectionUI.ts — the double-click enter path (same SSoT)
 * @see ./useExplodeRibbonAction.ts — the interceptor pattern this mirrors
 */

import React from 'react';
import type { RibbonActionPayload } from '../context/RibbonCommandContext';
import { enterBlockEdit } from '../../../systems/block/ActiveBlockEditStore';
import { computeBlockEditViewTransform } from '../../../systems/block/block-edit-view-transform';
import { collectBlockEntities } from '../../../systems/block/block-selection-bounds';
import { getActiveGroupId } from '../../../systems/group/ActiveGroupStore';
import type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';
import type { useUniversalSelection } from '../../../systems/selection';

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getSelectedEntityIds'
>;

export interface UseBlockEditRibbonActionProps {
  readonly levelManager: LevelSceneWriter;
  readonly universalSelection: UniversalSelectionLike;
  /** Fall-through for non-block-edit actions. */
  readonly fallback: (action: string, data?: RibbonActionPayload) => void;
}

export function useBlockEditRibbonAction(
  props: UseBlockEditRibbonActionProps,
): (action: string, data?: RibbonActionPayload) => void {
  const { levelManager, universalSelection, fallback } = props;

  return React.useCallback(
    (action: string, data?: RibbonActionPayload) => {
      if (action !== 'block-edit') {
        fallback(action, data);
        return;
      }

      const levelId = levelManager.currentLevelId;
      const scene = levelId ? levelManager.getLevelScene(levelId) : null;
      if (!scene) return;

      // A block is selected via its container id (members carry block.id), so the
      // single selected id resolves straight to the block (ADR-641 §3).
      const ids = universalSelection.getSelectedEntityIds();
      if (ids.length !== 1) return;
      const block = collectBlockEntities(scene.entities).get(ids[0]);
      // Mutual-exclusivity with GROUP drill-in (ADR-641 §7): never enter BEDIT inside a group.
      if (!block || getActiveGroupId() !== null) return;

      enterBlockEdit(block.id, block.name, computeBlockEditViewTransform(block));
    },
    [levelManager, universalSelection, fallback],
  );
}
