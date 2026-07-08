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
import type { LevelSceneGetter } from '../../../systems/levels/level-scene-accessor';
import { useEventGatedDialog } from '../../../app/dialog-hosts/useEventGatedDialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isColumnEntity } from '../../../types/entities';
import type { ColumnEntity } from '../../../bim/types/column-types';
// ADR-456/460 (Giorgio 2026-06-16) — the detail sheet must show the ACTIVE reinforcement:
// auto-mode columns re-derive a fresh code design from the current geometry. Resolved ONCE
// here (SSoT) so every pure leaf builder + the 3D capture stay unchanged and consistent.
import { resolveActiveColumnReinforcementForEntity } from '../../../bim/structural/active-reinforcement';
import { buildColumnDetailSheet } from '../../../bim/structural/detail-sheet/column-detail-sheet';
import { computeDetailSheetLayout } from '../../../bim/structural/detail-sheet/detail-sheet-layout';
import { captureColumnDetail3d } from '../../../bim/structural/detail-sheet/render/column-detail-3d-capture';
import type { ColumnDetail3dCapture } from '../../../bim/structural/detail-sheet/render/column-detail-3d-capture';
import type { DetailSheetModel } from '../../../bim/structural/detail-sheet/detail-sheet-types';
import { ColumnDetailDialog } from './ColumnDetailDialog';

/** Longest side (device px) of the offscreen 3D capture — balances crispness vs cost. */
const CAPTURE_LONG_EDGE_PX = 1200;

export interface ColumnDetailHostProps {
  readonly levelManager: LevelSceneGetter;
}

/** Resolves the target column entity from a level scene, or `null` if missing. */
function resolveColumn(
  levelManager: LevelSceneGetter,
  levelId: string | null,
  columnId: string | null,
): ColumnEntity | null {
  if (!levelId || !columnId) return null;
  const scene = levelManager.getLevelScene(levelId);
  const entity = scene?.entities.find((e) => e.id === columnId);
  return entity && isColumnEntity(entity) ? entity : null;
}

/**
 * ADR-456/460 — the column with its ACTIVE reinforcement baked into `params`:
 * auto-mode → fresh code-suggested design from the current geometry; manual →
 * the stored design unchanged (fast-path returns the SAME column reference). One
 * resolution point keeps the 2Δ plan/elevation, the schedule and the 3D capture
 * all consistent without touching the pure leaf builders.
 */
function toEffectiveColumn(column: ColumnEntity): ColumnEntity {
  // ADR-491 — …ForEntity: το detail sheet δείχνει τον FEM-aware οπλισμό (πρόβολος → wL²/2).
  const reinforcement = resolveActiveColumnReinforcementForEntity(column);
  if (reinforcement === column.params.reinforcement) return column;
  return { ...column, params: { ...column.params, reinforcement } };
}

/** Offscreen 3D capture resolution, derived from the perspective region aspect. */
function captureSizePx(): { widthPx: number; heightPx: number } {
  const { regions } = computeDetailSheetLayout();
  const aspect = regions.perspective.w / regions.perspective.h;
  return aspect >= 1
    ? { widthPx: CAPTURE_LONG_EDGE_PX, heightPx: Math.round(CAPTURE_LONG_EDGE_PX / aspect) }
    : { widthPx: Math.round(CAPTURE_LONG_EDGE_PX * aspect), heightPx: CAPTURE_LONG_EDGE_PX };
}

/**
 * Thin gate (ADR-532 Stage 3): listens for the open event and mounts the heavy
 * body ONLY while open. Closed → `null` → zero subtree in the per-selection
 * commit (was re-rendering as a closed dialog before — see HANDOFF Stage 3).
 */
export function ColumnDetailHost({
  levelManager,
}: ColumnDetailHostProps): React.ReactElement | null {
  const { open, payload, close } = useEventGatedDialog(
    'bim:column-detail-requested',
    ({ columnId, levelId }) => resolveColumn(levelManager, levelId, columnId) !== null,
  );
  if (!open || !payload) return null;
  return (
    <ColumnDetailBody
      levelManager={levelManager}
      columnId={payload.columnId}
      levelId={payload.levelId}
      onClose={close}
    />
  );
}

interface ColumnDetailBodyProps {
  readonly levelManager: LevelSceneGetter;
  readonly columnId: string;
  readonly levelId: string;
  readonly onClose: () => void;
}

/** Heavy body — mounted ONLY while the dialog is open (3D capture + model build). */
function ColumnDetailBody({
  levelManager,
  columnId,
  levelId,
  onClose,
}: ColumnDetailBodyProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  // Offscreen 3D perspective capture (ADR-457 Slice 3) — async, null while pending.
  const [perspective3d, setPerspective3d] = useState<ColumnDetail3dCapture | null>(null);

  // Capture the column's reinforcement in 3D on mount (dialog just opened), off the
  // synchronous model build (WebGL render is one-shot; null → no cage).
  useEffect(() => {
    const column = resolveColumn(levelManager, levelId, columnId);
    setPerspective3d(column ? captureColumnDetail3d(toEffectiveColumn(column), captureSizePx()) : null);
  }, [levelManager, levelId, columnId]);

  const model = useMemo<DetailSheetModel | null>(() => {
    const column = resolveColumn(levelManager, levelId, columnId);
    if (!column) return null;
    return buildColumnDetailSheet({
      params: toEffectiveColumn(column).params,
      perspective3d,
      labels: {
        plan: t('columnDetail.regions.plan'),
        elevation: t('columnDetail.regions.elevation'),
        perspective: t('columnDetail.regions.perspective'),
        schedule: t('columnDetail.regions.schedule'),
        titleBlock: t('columnDetail.regions.titleBlock'),
        scheduleTable: {
          mark: t('columnDetail.scheduleTable.mark'),
          diameter: t('columnDetail.scheduleTable.diameter'),
          count: t('columnDetail.scheduleTable.count'),
          length: t('columnDetail.scheduleTable.length'),
          weight: t('columnDetail.scheduleTable.weight'),
          longitudinal: t('columnDetail.scheduleTable.longitudinal'),
          stirrups: t('columnDetail.scheduleTable.stirrups'),
          spiral: t('columnDetail.scheduleTable.spiral'),
          total: t('columnDetail.scheduleTable.total'),
          ratio: t('columnDetail.scheduleTable.ratio'),
          confinement: t('columnDetail.scheduleTable.confinement'),
        },
        titleFields: {
          section: t('columnDetail.titleFields.section'),
          height: t('columnDetail.titleFields.height'),
          concrete: t('columnDetail.titleFields.concrete'),
          steel: t('columnDetail.titleFields.steel'),
          cover: t('columnDetail.titleFields.cover'),
          longitudinal: t('columnDetail.titleFields.longitudinal'),
          stirrups: t('columnDetail.titleFields.stirrups'),
        },
      },
    });
  }, [levelManager, levelId, columnId, t, perspective3d]);

  const handleOpenChange = useCallback((next: boolean): void => {
    if (!next) onClose();
  }, [onClose]);

  return (
    <ColumnDetailDialog
      open
      onOpenChange={handleOpenChange}
      model={model}
    />
  );
}
