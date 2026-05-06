'use client';

/**
 * StorageQuickCreateSheet — Sheet wrapping the canonical StorageGeneralTab in
 * create mode, identical to the creation panel in /spaces/storage.
 *
 * SSoT: uses the same StorageGeneralTab + EntityDetailsHeader + DetailsContainer
 * pattern as StoragePageContent (lines 333-358).
 */

import React, { useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Warehouse } from 'lucide-react';
import { DIALOG_SCROLL } from '@/styles/design-tokens';
import { DetailsContainer } from '@/core/containers';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import { StorageGeneralTab } from '@/components/space-management/StoragesPage/StorageDetails/tabs/StorageGeneralTab';
import { useNotifications } from '@/providers/NotificationProvider';
import type { Building } from '@/types/building/contracts';
import type { Storage } from '@/types/storage/contracts';

export interface StorageQuickCreateSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly building: Building;
  readonly onStorageCreated?: () => void;
}

export function StorageQuickCreateSheet({
  open,
  onOpenChange,
  building,
  onStorageCreated,
}: StorageQuickCreateSheetProps) {
  const { t: tStorage } = useTranslation('storage');
  const { success } = useNotifications();
  const saveRef = useRef<(() => Promise<boolean>) | null>(null);

  const emptyStorage: Storage = {
    id: '',
    name: 'Αποθήκη',
    type: 'storage',
    status: 'available',
    building: building.name || '',
    buildingId: building.id,
    floor: '',
    area: 0,
    projectId: building.projectId ?? undefined,
  };

  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleSave = useCallback(() => {
    saveRef.current?.();
  }, []);

  const handleCreated = useCallback(() => {
    success(tStorage('storages.notifications.created'));
    onStorageCreated?.();
    onOpenChange(false);
  }, [tStorage, success, onStorageCreated, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <SheetContent
        side="right"
        className={cn(
          'w-[min(960px,96vw)] sm:max-w-none p-0 flex flex-col overflow-hidden',
          DIALOG_SCROLL.scrollable,
        )}
      >
        <SheetTitle className="sr-only">{tStorage('header.newStorage')}</SheetTitle>
        <DetailsContainer
          selectedItem={{ id: 'create' }}
          header={
            <EntityDetailsHeader
              icon={Warehouse}
              title={tStorage('header.newStorage')}
              actions={[
                createEntityAction('save', tStorage('storages.form.create'), handleSave),
                createEntityAction('cancel', tStorage('storages.form.cancel'), handleClose),
              ]}
              variant="detailed"
            />
          }
          tabsRenderer={
            open ? (
              <StorageGeneralTab
                storage={emptyStorage}
                isEditing
                createMode
                onSaveRef={saveRef}
                onCreated={handleCreated}
              />
            ) : undefined
          }
        />
      </SheetContent>
    </Sheet>
  );
}
