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
import type { ColumnEntity } from '../../../bim/types/column-types';
import { buildColumnDetailSheet } from '../../../bim/structural/detail-sheet/column-detail-sheet';
import { computeDetailSheetLayout } from '../../../bim/structural/detail-sheet/detail-sheet-layout';
import { captureColumnDetail3d } from '../../../bim/structural/detail-sheet/render/column-detail-3d-capture';
import type { ColumnDetail3dCapture } from '../../../bim/structural/detail-sheet/render/column-detail-3d-capture';
import type { DetailSheetModel } from '../../../bim/structural/detail-sheet/detail-sheet-types';
import { ColumnDetailDialog } from './ColumnDetailDialog';

/** Longest side (device px) of the offscreen 3D capture — balances crispness vs cost. */
const CAPTURE_LONG_EDGE_PX = 1200;

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

/** Resolves the target column entity from a level scene, or `null` if missing. */
function resolveColumn(
  levelManager: LevelManagerLike,
  levelId: string | null,
  columnId: string | null,
): ColumnEntity | null {
  if (!levelId || !columnId) return null;
  const scene = levelManager.getLevelScene(levelId);
  const entity = scene?.entities.find((e) => e.id === columnId);
  return entity && isColumnEntity(entity) ? entity : null;
}

/** Offscreen 3D capture resolution, derived from the perspective region aspect. */
function captureSizePx(): { widthPx: number; heightPx: number } {
  const { regions } = computeDetailSheetLayout();
  const aspect = regions.perspective.w / regions.perspective.h;
  return aspect >= 1
    ? { widthPx: CAPTURE_LONG_EDGE_PX, heightPx: Math.round(CAPTURE_LONG_EDGE_PX / aspect) }
    : { widthPx: Math.round(CAPTURE_LONG_EDGE_PX * aspect), heightPx: CAPTURE_LONG_EDGE_PX };
}

export function ColumnDetailHost({
  levelManager,
}: ColumnDetailHostProps): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const [dialogState, setDialogState] = useState<DialogState>(CLOSED);
  // Offscreen 3D perspective capture (ADR-457 Slice 3) — async, null while pending.
  const [perspective3d, setPerspective3d] = useState<ColumnDetail3dCapture | null>(null);

  useEffect(() => {
    return EventBus.on('bim:column-detail-requested', ({ columnId, levelId }) => {
      if (!resolveColumn(levelManager, levelId, columnId)) return;
      setDialogState({ open: true, columnId, levelId });
    });
  }, [levelManager]);

  // Capture the column's reinforcement in 3D once the dialog opens, off the
  // synchronous model build (WebGL render is one-shot; null → no cage).
  useEffect(() => {
    if (!dialogState.open) {
      setPerspective3d(null);
      return;
    }
    const column = resolveColumn(levelManager, dialogState.levelId, dialogState.columnId);
    if (!column) {
      setPerspective3d(null);
      return;
    }
    setPerspective3d(captureColumnDetail3d(column, captureSizePx()));
  }, [dialogState, levelManager]);

  const model = useMemo<DetailSheetModel | null>(() => {
    if (!dialogState.open) return null;
    const column = resolveColumn(levelManager, dialogState.levelId, dialogState.columnId);
    if (!column) return null;
    return buildColumnDetailSheet({
      params: column.params,
      perspective3d,
      labels: {
        plan: t('columnDetail.regions.plan'),
        elevation: t('columnDetail.regions.elevation'),
        perspective: t('columnDetail.regions.perspective'),
        schedule: t('columnDetail.regions.schedule'),
        titleBlock: t('columnDetail.regions.titleBlock'),
      },
    });
  }, [dialogState, levelManager, t, perspective3d]);

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
