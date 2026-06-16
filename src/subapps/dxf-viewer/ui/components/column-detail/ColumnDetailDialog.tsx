'use client';

/**
 * ADR-457 — Column Reinforcement Detail Sheet dialog (thin wrapper).
 *
 * Resolves the column-specific chrome labels (i18n `columnDetail.*`) + PDF
 * filename and delegates ALL rendering/zoom/export logic to the generic
 * {@link DetailSheetDialog} SSoT (ADR-463 §extraction — shared με το footing
 * detail). Keeps the original props/export intact so `ColumnDetailHost` is
 * unchanged.
 *
 * @see ../detail-sheet/DetailSheetDialog.tsx — the generic SSoT dialog
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import * as React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { DetailSheetModel } from '../../../bim/structural/detail-sheet/detail-sheet-types';
import { DetailSheetDialog } from '../detail-sheet/DetailSheetDialog';

/** Export file name for the reinforcement detail PDF (data, not i18n). */
const PDF_FILENAME = 'column-reinforcement-detail.pdf';

export interface ColumnDetailDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
  /** The detail-sheet drawing model (null while no column resolved). */
  readonly model: DetailSheetModel | null;
}

export function ColumnDetailDialog({
  open,
  onOpenChange,
  model,
}: ColumnDetailDialogProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <DetailSheetDialog
      open={open}
      onOpenChange={onOpenChange}
      model={model}
      pdfFilename={PDF_FILENAME}
      labels={{
        title: t('columnDetail.dialogTitle'),
        description: t('columnDetail.dialogDescription'),
        previewAlt: t('columnDetail.previewAlt'),
        close: t('columnDetail.close'),
        exportPdf: t('columnDetail.exportPdf'),
        print: t('columnDetail.print'),
        zoomIn: t('columnDetail.zoomIn'),
        zoomOut: t('columnDetail.zoomOut'),
        zoomReset: t('columnDetail.zoomReset'),
        zoomToolbar: t('columnDetail.zoomToolbar'),
      }}
    />
  );
}
