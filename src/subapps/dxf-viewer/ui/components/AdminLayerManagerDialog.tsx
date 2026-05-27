'use client';

/**
 * ADR-391 — Modal wrapper around AdminLayerManager.
 *
 * Industry: Revit View tab > Visibility/Graphics dialog opens modal over canvas.
 * Click on ribbon "Layer Manager" button OR Ctrl+L keyboard shortcut →
 * AdminLayerManagerDialogStore.open() → this component renders modal.
 *
 * Uses centralized `@/components/ui/dialog` (Radix Dialog SSoT, ADR-001).
 * Mounts via Suspense in DxfViewerContent (mirror of 7 BIM persistence hosts).
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
import { LazyAdminLayerManager } from './LazyLoadWrapper';
import { AdminLayerManagerDialogStore } from '../../stores/AdminLayerManagerDialogStore';

interface AdminLayerManagerDialogProps {
  projectId?: string | null;
  projectName?: string;
}

export const AdminLayerManagerDialog: React.FC<AdminLayerManagerDialogProps> = ({
  projectId = null,
  projectName = '',
}) => {
  const { t } = useTranslation('dxf-viewer-shell');

  const { isOpen } = useSyncExternalStore(
    AdminLayerManagerDialogStore.subscribe,
    AdminLayerManagerDialogStore.getSnapshot,
    AdminLayerManagerDialogStore.getSnapshot,
  );

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) AdminLayerManagerDialogStore.close();
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent size="2xl">
        <DialogHeader>
          <DialogTitle>{t('layerManagerDialog.title')}</DialogTitle>
          <DialogDescription>{t('layerManagerDialog.description')}</DialogDescription>
        </DialogHeader>
        <LazyAdminLayerManager projectId={projectId} projectName={projectName} />
      </DialogContent>
    </Dialog>
  );
};
