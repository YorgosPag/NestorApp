'use client';

import { useTranslation } from '@/i18n/hooks/useTranslation';
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
import { useFloorplanBackgroundStore } from '../stores/floorplanBackgroundStore';

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Replace-confirm dialog. Reads `pendingReplaceRequest` from the store and
 * mounts an AlertDialog whenever a replace was requested. ADR-340 §3.6.
 *
 * Phase 5 scope: in-memory only — confirm cascades through `confirmReplace()`
 * which removes the old background + provider and loads the new source.
 * Phase 7 will extend `confirmReplace` to also cascade-delete polygons via
 * `cascadeDeleteAllPolygonsForFloor(floorId)` (Q8).
 */
export function ReplaceConfirmDialog() {
  const { t } = useTranslation(['dxf-viewer-panels']);
  const pending = useFloorplanBackgroundStore((s) => s.pendingReplaceRequest);
  const confirmReplace = useFloorplanBackgroundStore((s) => s.confirmReplace);
  const cancelReplace = useFloorplanBackgroundStore((s) => s.cancelReplace);

  const open = pending !== null;
  const incomingName = pending?.source.kind === 'file'
    ? pending.source.file.name
    : t('panels.floorplanBackground.replace.unknownFile');

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) cancelReplace(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('panels.floorplanBackground.replace.title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('panels.floorplanBackground.replace.description', { fileName: incomingName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={cancelReplace}>
            {t('panels.floorplanBackground.replace.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => { void confirmReplace(); }}>
            {t('panels.floorplanBackground.replace.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
