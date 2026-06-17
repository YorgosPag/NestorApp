'use client';

/**
 * Floor Management Dialog — η καρτέλα «Όροφοι Κτιρίου» (`FloorsTabContent`) σε modal
 * μέσα στον DXF viewer.
 *
 * Industry parity: στο Revit τα Levels τα διαχειρίζεσαι μέσα από το authoring
 * περιβάλλον (Manage → Levels), όχι σε ξεχωριστό module. Εδώ ανοίγει με ⚙️ από το
 * panel «Επίπεδα Έργου» ή με δεξί κλικ στη γραμμή σταθμών →
 * `FloorManagementDialogStore.open()`.
 *
 * FULL SSoT: ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΕΙ ως έχει το `FloorsTabContent` (μηδέν διπλότυπο) —
 * γράφει στα ΙΔΙΑ FLOORS docs, οπότε στάθμες/3D + το cascade υψομέτρων (ADR-450/461)
 * ανανεώνονται αυτόματα. Το `Building` έρχεται ζωντανά από `useBuildingById`.
 *
 * Uses centralized `@/components/ui/dialog` (Radix Dialog SSoT, ADR-001). Mounts
 * via Suspense host στο DxfViewerDialogs (mirror του AdminLayerManagerDialog).
 */

import React, { useSyncExternalStore, useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { FloorsTabContent } from '@/components/building-management/tabs/FloorsTabContent';
import { useBuildingById } from '../../hooks/data/useBuildingById';
import { FloorManagementDialogStore } from '../../stores/FloorManagementDialogStore';

interface FloorManagementDialogProps {
  /** Ενεργό buildingId του viewer (από τα levels· null όταν δεν έχει συνδεθεί κτίριο). */
  buildingId?: string | null;
}

export const FloorManagementDialog: React.FC<FloorManagementDialogProps> = ({
  buildingId = null,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');

  const { isOpen } = useSyncExternalStore(
    FloorManagementDialogStore.subscribe,
    FloorManagementDialogStore.getSnapshot,
    FloorManagementDialogStore.getSnapshot,
  );

  // Subscribe μόνο όταν το modal είναι ανοιχτό (μηδέν listener όταν κλειστό).
  const { building, loading } = useBuildingById(buildingId, isOpen);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) FloorManagementDialogStore.close();
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent size="2xl">
        <DialogHeader>
          <DialogTitle>{t('floorManagementDialog.title')}</DialogTitle>
          <DialogDescription>{t('floorManagementDialog.description')}</DialogDescription>
        </DialogHeader>
        {building ? (
          <FloorsTabContent building={building} />
        ) : (
          <section className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            {loading ? <Spinner size="small" /> : null}
            <span>{loading ? t('floorManagementDialog.loading') : t('floorManagementDialog.noBuilding')}</span>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
};
