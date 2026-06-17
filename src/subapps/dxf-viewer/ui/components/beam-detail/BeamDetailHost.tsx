'use client';

/**
 * ADR-471 — Beam Reinforcement Detail Sheet host (dialog lifecycle owner).
 *
 * Subscribes to the `bim:beam-detail-requested` EventBus signal (emitted by the
 * beam contextual-ribbon bridge), resolves the target beam from the level scene,
 * builds the backend-agnostic {@link DetailSheetModel} and renders the generic
 * {@link DetailSheetDialog}. Mirror του `FoundationDetailHost`: mounted once (lazy)
 * in `DxfViewerDialogs`, zero high-frequency subscriptions (ADR-040 CHECK 6B/6C
 * compliant). Η offscreen 3Δ λήψη γίνεται async μόλις ανοίξει.
 *
 * @see ../foundation-detail/FoundationDetailHost.tsx — ο πιο πρόσφατος mirror
 * @see docs/centralized-systems/reference/adrs/ADR-471-unified-member-reinforcement.md §2
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { useLevels } from '../../../systems/levels';
import { EventBus } from '../../../systems/events/EventBus';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isBeamEntity } from '../../../types/entities';
import type { BeamEntity } from '../../../bim/types/beam-types';
import { buildBeamDetailSheet } from '../../../bim/structural/detail-sheet/beam-detail-sheet';
import { computeDetailSheetLayout } from '../../../bim/structural/detail-sheet/detail-sheet-layout';
import { resolveActiveBeamReinforcementForEntity } from '../../../bim/structural/active-reinforcement';
import {
  captureBeamDetail3d,
  type BeamDetail3dCapture,
} from '../../../bim/structural/detail-sheet/render/beam-detail-3d-capture';
import type { DetailSheetModel } from '../../../bim/structural/detail-sheet/detail-sheet-types';
import { DetailSheetDialog } from '../detail-sheet/DetailSheetDialog';

/** Longest side (device px) of the offscreen 3D capture — balances crispness vs cost. */
const CAPTURE_LONG_EDGE_PX = 1200;
/** Export file name for the beam reinforcement detail PDF (data, not i18n). */
const PDF_FILENAME = 'beam-reinforcement-detail.pdf';

type LevelManagerLike = Pick<ReturnType<typeof useLevels>, 'getLevelScene'>;

export interface BeamDetailHostProps {
  readonly levelManager: LevelManagerLike;
}

interface DialogState {
  open: boolean;
  beamId: string | null;
  levelId: string | null;
}

const CLOSED: DialogState = { open: false, beamId: null, levelId: null };

/** Resolves the target beam entity from a level scene, or `null` if missing. */
function resolveBeam(
  levelManager: LevelManagerLike,
  levelId: string | null,
  beamId: string | null,
): BeamEntity | null {
  if (!levelId || !beamId) return null;
  const scene = levelManager.getLevelScene(levelId);
  const entity = scene?.entities.find((e) => e.id === beamId);
  return entity && isBeamEntity(entity) ? entity : null;
}

/** Offscreen 3D capture resolution, derived from the perspective region aspect. */
function captureSizePx(): { widthPx: number; heightPx: number } {
  const { regions } = computeDetailSheetLayout();
  const aspect = regions.perspective.w / regions.perspective.h;
  return aspect >= 1
    ? { widthPx: CAPTURE_LONG_EDGE_PX, heightPx: Math.round(CAPTURE_LONG_EDGE_PX / aspect) }
    : { widthPx: Math.round(CAPTURE_LONG_EDGE_PX * aspect), heightPx: CAPTURE_LONG_EDGE_PX };
}

export function BeamDetailHost({
  levelManager,
}: BeamDetailHostProps): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const [dialogState, setDialogState] = useState<DialogState>(CLOSED);
  const [perspective3d, setPerspective3d] = useState<BeamDetail3dCapture | null>(null);

  useEffect(() => {
    return EventBus.on('bim:beam-detail-requested', ({ beamId, levelId }) => {
      if (!resolveBeam(levelManager, levelId, beamId)) return;
      setDialogState({ open: true, beamId, levelId });
    });
  }, [levelManager]);

  // Capture the beam's reinforcement in 3D once the dialog opens (one-shot WebGL).
  useEffect(() => {
    if (!dialogState.open) {
      setPerspective3d(null);
      return;
    }
    const beam = resolveBeam(levelManager, dialogState.levelId, dialogState.beamId);
    setPerspective3d(beam ? captureBeamDetail3d(beam, captureSizePx()) : null);
  }, [dialogState, levelManager]);

  const model = useMemo<DetailSheetModel | null>(() => {
    if (!dialogState.open) return null;
    const beam = resolveBeam(levelManager, dialogState.levelId, dialogState.beamId);
    if (!beam) return null;
    return buildBeamDetailSheet({
      beam,
      reinforcement: resolveActiveBeamReinforcementForEntity(beam),
      perspective3d,
      labels: {
        plan: t('beamDetail.regions.plan'),
        elevation: t('beamDetail.regions.elevation'),
        perspective: t('beamDetail.regions.perspective'),
        schedule: t('beamDetail.regions.schedule'),
        titleBlock: t('beamDetail.regions.titleBlock'),
        scheduleTable: {
          item: t('beamDetail.scheduleTable.item'),
          description: t('beamDetail.scheduleTable.description'),
          length: t('beamDetail.scheduleTable.length'),
          weight: t('beamDetail.scheduleTable.weight'),
          bottomLongitudinal: t('beamDetail.scheduleTable.bottomLongitudinal'),
          topLongitudinal: t('beamDetail.scheduleTable.topLongitudinal'),
          stirrups: t('beamDetail.scheduleTable.stirrups'),
          total: t('beamDetail.scheduleTable.total'),
          ratio: t('beamDetail.scheduleTable.ratio'),
        },
        titleFields: {
          section: t('beamDetail.titleFields.section'),
          span: t('beamDetail.titleFields.span'),
          concrete: t('beamDetail.titleFields.concrete'),
          steel: t('beamDetail.titleFields.steel'),
          cover: t('beamDetail.titleFields.cover'),
          longitudinal: t('beamDetail.titleFields.longitudinal'),
          stirrups: t('beamDetail.titleFields.stirrups'),
        },
      },
    });
  }, [dialogState, levelManager, t, perspective3d]);

  const handleOpenChange = useCallback((next: boolean): void => {
    if (!next) setDialogState(CLOSED);
  }, []);

  return (
    <DetailSheetDialog
      open={dialogState.open}
      onOpenChange={handleOpenChange}
      model={model}
      pdfFilename={PDF_FILENAME}
      labels={{
        title: t('beamDetail.dialogTitle'),
        description: t('beamDetail.dialogDescription'),
        previewAlt: t('beamDetail.previewAlt'),
        close: t('beamDetail.close'),
        exportPdf: t('beamDetail.exportPdf'),
        print: t('beamDetail.print'),
        zoomIn: t('beamDetail.zoomIn'),
        zoomOut: t('beamDetail.zoomOut'),
        zoomReset: t('beamDetail.zoomReset'),
        zoomToolbar: t('beamDetail.zoomToolbar'),
      }}
    />
  );
}
