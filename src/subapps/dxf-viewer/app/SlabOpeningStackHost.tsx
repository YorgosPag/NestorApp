'use client';

/**
 * ADR-363 Phase 3.7b+ — Host για multi-storey slab-opening stack dialog.
 *
 * Subscribes στο EventBus `bim:slab-opening-stack-requested`. Manages dialog
 * open state. On confirm: assigns a shared `multiStoreyStackGroupId` to the
 * source opening + builds clones for each selected level.
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md Phase 3.7b+
 */

import React, { useCallback, useEffect, useState } from 'react';
import type { useLevels } from '../systems/levels';
import type { SlabOpeningEntity } from '../bim/types/slab-opening-types';
import { EventBus } from '../systems/events/EventBus';
import { generateBimStackGroupId } from '@/services/enterprise-id-convenience';
import {
  findHostSlabForLevel,
  buildStackedOpeningEntity,
} from '../bim/slab-openings/slab-opening-stack';
import { SlabOpeningStackDialog } from '../ui/components/slab-opening/SlabOpeningStackDialog';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'levels' | 'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface SlabOpeningStackHostProps {
  readonly levelManager: LevelManagerLike;
}

interface DialogState {
  open: boolean;
  opening: SlabOpeningEntity | null;
}

const CLOSED: DialogState = { open: false, opening: null };

export function SlabOpeningStackHost({ levelManager }: SlabOpeningStackHostProps): React.ReactElement | null {
  const [dialogState, setDialogState] = useState<DialogState>(CLOSED);

  useEffect(() => {
    return EventBus.on('bim:slab-opening-stack-requested', ({ opening }) => {
      setDialogState({ open: true, opening });
    });
  }, []);

  const handleConfirm = useCallback((selectedLevelIds: string[]): void => {
    const { opening } = dialogState;
    if (!opening || selectedLevelIds.length === 0) {
      setDialogState(CLOSED);
      return;
    }

    const groupId = generateBimStackGroupId();

    // Tag source opening with groupId.
    const srcLevelId = levelManager.currentLevelId;
    if (srcLevelId) {
      const srcScene = levelManager.getLevelScene(srcLevelId);
      if (srcScene) {
        const nextEntities = srcScene.entities.map((e) =>
          e.id === opening.id
            ? ({ ...e, params: { ...(e as SlabOpeningEntity).params, multiStoreyStackGroupId: groupId } } as typeof e)
            : e,
        );
        levelManager.setLevelScene(srcLevelId, { ...srcScene, entities: nextEntities });
      }
    }

    // Build copy on each selected level.
    for (const levelId of selectedLevelIds) {
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) continue;
      const hostSlab = findHostSlabForLevel(opening.params.outline, scene);
      if (!hostSlab) continue;
      const copy = buildStackedOpeningEntity(opening, hostSlab, levelId, groupId);
      levelManager.setLevelScene(levelId, { ...scene, entities: [...scene.entities, copy] });
      EventBus.emit('drawing:entity-created', { entity: copy, tool: 'slab-opening' });
    }

    setDialogState(CLOSED);
  }, [dialogState, levelManager]);

  const handleCancel = useCallback((): void => {
    setDialogState(CLOSED);
  }, []);

  return (
    <SlabOpeningStackDialog
      open={dialogState.open}
      opening={dialogState.opening}
      levels={levelManager.levels}
      currentLevelId={levelManager.currentLevelId}
      getLevelScene={levelManager.getLevelScene}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
}
