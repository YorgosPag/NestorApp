'use client';

/**
 * ADR-476 — Slab Reinforcement Detail Sheet host (dialog lifecycle owner).
 *
 * Subscribes to the `bim:slab-detail-requested` EventBus signal (emitted by the
 * slab contextual-ribbon bridge), resolves the target slab from the level scene,
 * builds the backend-agnostic {@link DetailSheetModel} and renders the generic
 * {@link DetailSheetDialog}. Mirror του `FoundationDetailHost` (χωρίς design-summary
 * path — η πλάκα δεν έχει bearing/punching checks): mounted once (lazy) in
 * `DxfViewerDialogs`, zero high-frequency subscriptions (ADR-040 CHECK 6B/6C
 * compliant). Η offscreen 3Δ λήψη γίνεται async μόλις ανοίξει.
 *
 * @see ../foundation-detail/FoundationDetailHost.tsx — ο δίδυμος του πεδίλου
 * @see docs/centralized-systems/reference/adrs/ADR-476-unified-slab-reinforcement.md
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { useLevels } from '../../../systems/levels';
import { useEventGatedDialog } from '../../../app/dialog-hosts/useEventGatedDialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isSlabEntity } from '../../../types/entities';
import type { SlabEntity } from '../../../bim/types/slab-types';
import { buildSlabDetailSheet } from '../../../bim/structural/detail-sheet/slab-detail-sheet';
import { computeDetailSheetLayout } from '../../../bim/structural/detail-sheet/detail-sheet-layout';
import {
  captureSlabDetail3d,
  type SlabDetail3dCapture,
} from '../../../bim/structural/detail-sheet/render/slab-detail-3d-capture';
import type { DetailSheetModel } from '../../../bim/structural/detail-sheet/detail-sheet-types';
import { DetailSheetDialog } from '../detail-sheet/DetailSheetDialog';

/** Longest side (device px) of the offscreen 3D capture — balances crispness vs cost. */
const CAPTURE_LONG_EDGE_PX = 1200;
/** Export file name for the slab reinforcement detail PDF (data, not i18n). */
const PDF_FILENAME = 'slab-reinforcement-detail.pdf';

type LevelManagerLike = Pick<ReturnType<typeof useLevels>, 'getLevelScene'>;

export interface SlabDetailHostProps {
  readonly levelManager: LevelManagerLike;
}

/** Resolves the target slab entity from a level scene, or `null` if missing. */
function resolveSlab(
  levelManager: LevelManagerLike,
  levelId: string | null,
  slabId: string | null,
): SlabEntity | null {
  if (!levelId || !slabId) return null;
  const scene = levelManager.getLevelScene(levelId);
  const entity = scene?.entities.find((e) => e.id === slabId);
  return entity && isSlabEntity(entity) ? entity : null;
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
 * body ONLY while open. Closed → `null` → zero subtree in the per-selection commit.
 */
export function SlabDetailHost({
  levelManager,
}: SlabDetailHostProps): React.ReactElement | null {
  const { open, payload, close } = useEventGatedDialog(
    'bim:slab-detail-requested',
    ({ slabId, levelId }) => resolveSlab(levelManager, levelId, slabId) !== null,
  );
  if (!open || !payload) return null;
  return (
    <SlabDetailBody
      levelManager={levelManager}
      slabId={payload.slabId}
      levelId={payload.levelId}
      onClose={close}
    />
  );
}

interface SlabDetailBodyProps {
  readonly levelManager: LevelManagerLike;
  readonly slabId: string;
  readonly levelId: string;
  readonly onClose: () => void;
}

/** Heavy body — mounted ONLY while the dialog is open (3D capture + model build). */
function SlabDetailBody({
  levelManager,
  slabId,
  levelId,
  onClose,
}: SlabDetailBodyProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const [perspective3d, setPerspective3d] = useState<SlabDetail3dCapture | null>(null);

  // Capture the slab's reinforcement in 3D on mount (one-shot WebGL).
  useEffect(() => {
    const slab = resolveSlab(levelManager, levelId, slabId);
    setPerspective3d(slab ? captureSlabDetail3d(slab, captureSizePx()) : null);
  }, [levelManager, levelId, slabId]);

  const model = useMemo<DetailSheetModel | null>(() => {
    const slab = resolveSlab(levelManager, levelId, slabId);
    if (!slab) return null;
    return buildSlabDetailSheet({
      slab,
      perspective3d,
      labels: {
        plan: t('slabDetail.regions.plan'),
        section: t('slabDetail.regions.section'),
        perspective: t('slabDetail.regions.perspective'),
        schedule: t('slabDetail.regions.schedule'),
        titleBlock: t('slabDetail.regions.titleBlock'),
        scheduleTable: {
          item: t('slabDetail.scheduleTable.item'),
          description: t('slabDetail.scheduleTable.description'),
          length: t('slabDetail.scheduleTable.length'),
          weight: t('slabDetail.scheduleTable.weight'),
          bottomMesh: t('slabDetail.scheduleTable.bottomMesh'),
          topMesh: t('slabDetail.scheduleTable.topMesh'),
          total: t('slabDetail.scheduleTable.total'),
          ratio: t('slabDetail.scheduleTable.ratio'),
        },
        titleFields: {
          kind: t('slabDetail.titleFields.kind'),
          section: t('slabDetail.titleFields.section'),
          thickness: t('slabDetail.titleFields.thickness'),
          concrete: t('slabDetail.titleFields.concrete'),
          steel: t('slabDetail.titleFields.steel'),
          cover: t('slabDetail.titleFields.cover'),
          bottomMesh: t('slabDetail.titleFields.bottomMesh'),
          topMesh: t('slabDetail.titleFields.topMesh'),
          span: t('slabDetail.titleFields.span'),
          designLoad: t('slabDetail.titleFields.designLoad'),
        },
        kindValues: {
          'floor': t('slabDetail.kindValues.floor'),
          'ceiling': t('slabDetail.kindValues.ceiling'),
          'roof': t('slabDetail.kindValues.roof'),
          'ground': t('slabDetail.kindValues.ground'),
          'foundation': t('slabDetail.kindValues.foundation'),
        },
      },
    });
  }, [levelManager, levelId, slabId, t, perspective3d]);

  const handleOpenChange = useCallback((next: boolean): void => {
    if (!next) onClose();
  }, [onClose]);

  return (
    <DetailSheetDialog
      open
      onOpenChange={handleOpenChange}
      model={model}
      pdfFilename={PDF_FILENAME}
      labels={{
        title: t('slabDetail.dialogTitle'),
        description: t('slabDetail.dialogDescription'),
        previewAlt: t('slabDetail.previewAlt'),
        close: t('slabDetail.close'),
        exportPdf: t('slabDetail.exportPdf'),
        print: t('slabDetail.print'),
        zoomIn: t('slabDetail.zoomIn'),
        zoomOut: t('slabDetail.zoomOut'),
        zoomReset: t('slabDetail.zoomReset'),
        zoomToolbar: t('slabDetail.zoomToolbar'),
      }}
    />
  );
}
