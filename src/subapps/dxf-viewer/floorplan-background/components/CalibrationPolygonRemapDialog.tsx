'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CalibrationPolygonRemapDialogProps {
  open: boolean;
  polygonCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Shown when calibration would affect existing polygons (count > 0).
 * Phase 6: never shown (no persisted polygons yet — Phase 7 wires count).
 * Phase 7: CalibrationDialog.handleApply will query overlay count and conditionally
 *   show this dialog before calling applyCalibration (polygon remap via Firestore batch).
 */
export function CalibrationPolygonRemapDialog({
  open,
  polygonCount,
  onConfirm,
  onCancel,
}: CalibrationPolygonRemapDialogProps) {
  const { t } = useTranslation(['dxf-viewer-panels']);
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('panels.floorplanBackground.calibration.remapTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('panels.floorplanBackground.calibration.remapDesc', { count: polygonCount })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {t('panels.floorplanBackground.calibration.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t('panels.floorplanBackground.calibration.remapConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
