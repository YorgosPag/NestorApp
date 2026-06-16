'use client';

/**
 * ADR-463 — Footing Reinforcement Detail Sheet host (dialog lifecycle owner).
 *
 * Subscribes to the `bim:foundation-detail-requested` EventBus signal (emitted by
 * the foundation contextual-ribbon bridge), resolves the target footing from the
 * level scene, builds the backend-agnostic {@link DetailSheetModel} and renders
 * the generic {@link DetailSheetDialog}. Mirror του `ColumnDetailHost`:
 * mounted once (lazy) in `DxfViewerDialogs`, zero high-frequency subscriptions
 * (ADR-040 CHECK 6B/6C compliant). Η offscreen 3Δ λήψη γίνεται async μόλις ανοίξει.
 *
 * @see ../column-detail/ColumnDetailHost.tsx — ο δίδυμος της κολώνας
 * @see docs/centralized-systems/reference/adrs/ADR-463-foundation-reinforcement-ux.md
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { useLevels } from '../../../systems/levels';
import { EventBus } from '../../../systems/events/EventBus';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isFoundationEntity } from '../../../types/entities';
import type { Entity } from '../../../types/entities';
import type { FoundationEntity } from '../../../bim/types/foundation-types';
import { buildFootingDetailSheet } from '../../../bim/structural/detail-sheet/footing-detail-sheet';
import { computeDetailSheetLayout } from '../../../bim/structural/detail-sheet/detail-sheet-layout';
import { useStructuralSettingsStore } from '../../../state/structural-settings-store';
import { resolveStructuralCode } from '../../../bim/structural/codes';
import { buildPadFootingDesignInput } from '../../../bim/structural/footing-design/footing-design-input';
import { computeFootingDesign } from '../../../bim/structural/footing-design/footing-design';
import type { FootingDesignResult } from '../../../bim/structural/footing-design/footing-design-types';
import {
  captureFootingDetail3d,
  type FootingDetail3dCapture,
} from '../../../bim/structural/detail-sheet/render/footing-detail-3d-capture';
import type { DetailSheetModel } from '../../../bim/structural/detail-sheet/detail-sheet-types';
import { DetailSheetDialog } from '../detail-sheet/DetailSheetDialog';

/** Longest side (device px) of the offscreen 3D capture — balances crispness vs cost. */
const CAPTURE_LONG_EDGE_PX = 1200;
/** Export file name for the footing reinforcement detail PDF (data, not i18n). */
const PDF_FILENAME = 'foundation-reinforcement-detail.pdf';

type LevelManagerLike = Pick<ReturnType<typeof useLevels>, 'getLevelScene'>;

export interface FoundationDetailHostProps {
  readonly levelManager: LevelManagerLike;
}

interface DialogState {
  open: boolean;
  foundationId: string | null;
  levelId: string | null;
}

const CLOSED: DialogState = { open: false, foundationId: null, levelId: null };

/** Resolves the target footing entity from a level scene, or `null` if missing. */
function resolveFooting(
  levelManager: LevelManagerLike,
  levelId: string | null,
  foundationId: string | null,
): FoundationEntity | null {
  if (!levelId || !foundationId) return null;
  const scene = levelManager.getLevelScene(levelId);
  const entity = scene?.entities.find((e) => e.id === foundationId);
  return entity && isFoundationEntity(entity) ? entity : null;
}

/** Offscreen 3D capture resolution, derived from the perspective region aspect. */
function captureSizePx(): { widthPx: number; heightPx: number } {
  const { regions } = computeDetailSheetLayout();
  const aspect = regions.perspective.w / regions.perspective.h;
  return aspect >= 1
    ? { widthPx: CAPTURE_LONG_EDGE_PX, heightPx: Math.round(CAPTURE_LONG_EDGE_PX / aspect) }
    : { widthPx: Math.round(CAPTURE_LONG_EDGE_PX * aspect), heightPx: CAPTURE_LONG_EDGE_PX };
}

export function FoundationDetailHost({
  levelManager,
}: FoundationDetailHostProps): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const [dialogState, setDialogState] = useState<DialogState>(CLOSED);
  const [perspective3d, setPerspective3d] = useState<FootingDetail3dCapture | null>(null);
  // ADR-464 Slice 5 — building-level σ_allow + κανονισμός για τον πίνακα ελέγχων σχεδιασμού.
  const codeId = useStructuralSettingsStore((s) => s.codeId);
  const soilBearingCapacityKpa = useStructuralSettingsStore((s) => s.soilBearingCapacityKpa);

  useEffect(() => {
    return EventBus.on('bim:foundation-detail-requested', ({ foundationId, levelId }) => {
      if (!resolveFooting(levelManager, levelId, foundationId)) return;
      setDialogState({ open: true, foundationId, levelId });
    });
  }, [levelManager]);

  // Capture the footing's reinforcement in 3D once the dialog opens (one-shot WebGL).
  useEffect(() => {
    if (!dialogState.open) {
      setPerspective3d(null);
      return;
    }
    const footing = resolveFooting(levelManager, dialogState.levelId, dialogState.foundationId);
    setPerspective3d(footing ? captureFootingDetail3d(footing, captureSizePx()) : null);
  }, [dialogState, levelManager]);

  const model = useMemo<DetailSheetModel | null>(() => {
    if (!dialogState.open) return null;
    const footing = resolveFooting(levelManager, dialogState.levelId, dialogState.foundationId);
    if (!footing) return null;
    // ADR-464 Slice 5 — DERIVED έλεγχοι σχεδιασμού (αδρανές χωρίς σ_allow / φορτίο).
    let design: FootingDesignResult | null = null;
    if (soilBearingCapacityKpa && dialogState.levelId) {
      const entities = (levelManager.getLevelScene(dialogState.levelId)?.entities ?? []) as unknown as readonly Entity[];
      const input = buildPadFootingDesignInput(footing, resolveStructuralCode(codeId), soilBearingCapacityKpa, entities);
      if (input) design = computeFootingDesign(input);
    }
    return buildFootingDetailSheet({
      foundation: footing,
      perspective3d,
      design,
      labels: {
        plan: t('foundationDetail.regions.plan'),
        elevation: t('foundationDetail.regions.elevation'),
        perspective: t('foundationDetail.regions.perspective'),
        schedule: t('foundationDetail.regions.schedule'),
        titleBlock: t('foundationDetail.regions.titleBlock'),
        scheduleTable: {
          item: t('foundationDetail.scheduleTable.item'),
          description: t('foundationDetail.scheduleTable.description'),
          length: t('foundationDetail.scheduleTable.length'),
          weight: t('foundationDetail.scheduleTable.weight'),
          main: t('foundationDetail.scheduleTable.main'),
          secondary: t('foundationDetail.scheduleTable.secondary'),
          stirrups: t('foundationDetail.scheduleTable.stirrups'),
          total: t('foundationDetail.scheduleTable.total'),
          ratio: t('foundationDetail.scheduleTable.ratio'),
        },
        titleFields: {
          kind: t('foundationDetail.titleFields.kind'),
          section: t('foundationDetail.titleFields.section'),
          thickness: t('foundationDetail.titleFields.thickness'),
          concrete: t('foundationDetail.titleFields.concrete'),
          steel: t('foundationDetail.titleFields.steel'),
          cover: t('foundationDetail.titleFields.cover'),
          main: t('foundationDetail.titleFields.main'),
          secondary: t('foundationDetail.titleFields.secondary'),
        },
        kindValues: {
          'pad': t('foundationDetail.kindValues.pad'),
          'strip': t('foundationDetail.kindValues.strip'),
          'tie-beam': t('foundationDetail.kindValues.tieBeam'),
        },
        designSummary: {
          check: t('foundationDetail.designSummary.check'),
          demand: t('foundationDetail.designSummary.demand'),
          capacity: t('foundationDetail.designSummary.capacity'),
          utilization: t('foundationDetail.designSummary.utilization'),
          bearing: t('foundationDetail.designSummary.bearing'),
          punching: t('foundationDetail.designSummary.punching'),
          oneWayShear: t('foundationDetail.designSummary.oneWayShear'),
          topMeshNote: t('foundationDetail.designSummary.topMeshNote'),
          ok: t('foundationDetail.designSummary.ok'),
          fail: t('foundationDetail.designSummary.fail'),
        },
      },
    });
  }, [dialogState, levelManager, t, perspective3d, codeId, soilBearingCapacityKpa]);

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
        title: t('foundationDetail.dialogTitle'),
        description: t('foundationDetail.dialogDescription'),
        previewAlt: t('foundationDetail.previewAlt'),
        close: t('foundationDetail.close'),
        exportPdf: t('foundationDetail.exportPdf'),
        print: t('foundationDetail.print'),
        zoomIn: t('foundationDetail.zoomIn'),
        zoomOut: t('foundationDetail.zoomOut'),
        zoomReset: t('foundationDetail.zoomReset'),
        zoomToolbar: t('foundationDetail.zoomToolbar'),
      }}
    />
  );
}
