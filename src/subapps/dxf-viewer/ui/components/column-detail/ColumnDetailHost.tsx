'use client';

/**
 * ADR-457 — Column Reinforcement Detail Sheet host (dialog lifecycle owner).
 *
 * Subscribes to the `bim:column-detail-requested` EventBus signal (emitted by
 * the column contextual-ribbon bridge), resolves the target column from the
 * level scene, builds the backend-agnostic {@link DetailSheetModel} and renders
 * {@link ColumnDetailDialog}.
 *
 * Mirrors `PsetEditorHost`: mounted once (lazy) in `DxfViewerDialogs`, resolves
 * the entity from the event payload (columnId + levelId), zero high-frequency
 * subscriptions (ADR-040 CHECK 6B/6C compliant).
 *
 * Slice 0: the model carries the five-region shell only; the resolved column is
 * validated here and threaded into the per-region builders from Slice 1.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { useLevels } from '../../../systems/levels';
import { EventBus } from '../../../systems/events/EventBus';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isColumnEntity } from '../../../types/entities';
import { buildColumnDetailSheet } from '../../../bim/structural/detail-sheet/column-detail-sheet';
import type { DetailSheetModel } from '../../../bim/structural/detail-sheet/detail-sheet-types';
import { ColumnDetailDialog } from './ColumnDetailDialog';

type LevelManagerLike = Pick<ReturnType<typeof useLevels>, 'getLevelScene'>;

export interface ColumnDetailHostProps {
  readonly levelManager: LevelManagerLike;
}

interface DialogState {
  open: boolean;
  columnId: string | null;
  levelId: string | null;
}

const CLOSED: DialogState = { open: false, columnId: null, levelId: null };

export function ColumnDetailHost({
  levelManager,
}: ColumnDetailHostProps): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const [dialogState, setDialogState] = useState<DialogState>(CLOSED);

  useEffect(() => {
    return EventBus.on('bim:column-detail-requested', ({ columnId, levelId }) => {
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      const entity = scene.entities.find((e) => e.id === columnId);
      if (!entity || !isColumnEntity(entity)) return;
      setDialogState({ open: true, columnId, levelId });
    });
  }, [levelManager]);

  const model = useMemo<DetailSheetModel | null>(() => {
    if (!dialogState.open || !dialogState.columnId || !dialogState.levelId) return null;
    const scene = levelManager.getLevelScene(dialogState.levelId);
    const entity = scene?.entities.find((e) => e.id === dialogState.columnId);
    if (!entity || !isColumnEntity(entity)) return null;
    return buildColumnDetailSheet({
      params: entity.params,
      labels: {
        plan: t('columnDetail.regions.plan'),
        elevation: t('columnDetail.regions.elevation'),
        perspective: t('columnDetail.regions.perspective'),
        schedule: t('columnDetail.regions.schedule'),
        titleBlock: t('columnDetail.regions.titleBlock'),
      },
    });
  }, [dialogState, levelManager, t]);

  const handleOpenChange = useCallback((next: boolean): void => {
    if (!next) setDialogState(CLOSED);
  }, []);

  return (
    <ColumnDetailDialog
      open={dialogState.open}
      onOpenChange={handleOpenChange}
      model={model}
    />
  );
}
