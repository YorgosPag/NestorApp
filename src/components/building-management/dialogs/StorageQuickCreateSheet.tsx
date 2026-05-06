'use client';

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { StorageCreateForm } from '@/components/building-management/StorageTab/StorageCreateForm';
import { getStorageTypeLabel } from '@/components/building-management/StorageTab/utils';
import { DIALOG_SCROLL } from '@/styles/design-tokens';
import type { Building } from '@/types/building/contracts';
import type { StorageType, StorageStatus } from '@/types/storage';
import { createStorageWithPolicy } from '@/services/storage-mutation-gateway';
import { useNotifications } from '@/providers/NotificationProvider';
import { getStatusLabel } from '@/lib/status-helpers';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('StorageQuickCreateSheet');

interface StorageCreateResult { storageId: string }

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
  const { t } = useTranslation(['building', 'building-storage', 'building-tabs']);
  const { success, error: notifyError } = useNotifications();

  const [createCode, setCreateCode] = useState('');
  const [createType, setCreateType] = useState<StorageType>('storage');
  const [createStatus, setCreateStatus] = useState<StorageStatus>('available');
  const [createFloor, setCreateFloor] = useState('');
  const [createArea, setCreateArea] = useState('');
  const [createPrice, setCreatePrice] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const reset = useCallback(() => {
    setCreateCode('');
    setCreateType('storage');
    setCreateStatus('available');
    setCreateFloor('');
    setCreateArea('');
    setCreatePrice('');
    setCreateDescription('');
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onOpenChange(false);
  }, [reset, onOpenChange]);

  const translatedGetTypeLabel = useCallback(
    (type: StorageType) => getStorageTypeLabel(type, t),
    [t],
  );

  const translatedGetStatusLabel = useCallback(
    (status: StorageStatus) => getStatusLabel('storage', status, { t }),
    [t],
  );

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      const storageName = createCode.trim() || `${t('storageView.autoNamePrefix')}-${Date.now().toString(36).toUpperCase()}`;
      await createStorageWithPolicy<StorageCreateResult>({
        payload: {
          name: storageName,
          buildingId: building.id,
          projectId: building.projectId || null,
          type: createType,
          status: createStatus,
          floor: createFloor.trim() || null,
          area: createArea ? parseFloat(createArea) : null,
          price: createPrice ? parseFloat(createPrice) : null,
          description: createDescription.trim() || null,
          building: building.name,
        },
      });
      success(t('storageNotifications.created'));
      reset();
      onStorageCreated?.();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('storageNotifications.createError');
      logger.error('Create storage error', { error: msg });
      notifyError(`${t('storageNotifications.failurePrefix')} ${msg}`);
    } finally {
      setCreating(false);
    }
  }, [
    createCode, createType, createStatus, createFloor, createArea, createPrice, createDescription,
    building, t, success, notifyError, reset, onStorageCreated, onOpenChange,
  ]);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <SheetContent
        side="right"
        className={cn(
          'w-[min(960px,96vw)] sm:max-w-none p-0 flex flex-col',
          DIALOG_SCROLL.scrollable,
        )}
      >
        <SheetHeader className="p-4 border-b">
          <SheetTitle>{t('details.addStorageTitle')}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          {open && (
            <StorageCreateForm
              code={createCode} onCodeChange={setCreateCode}
              type={createType} onTypeChange={setCreateType}
              status={createStatus} onStatusChange={setCreateStatus}
              floor={createFloor} onFloorChange={setCreateFloor}
              area={createArea} onAreaChange={setCreateArea}
              price={createPrice} onPriceChange={setCreatePrice}
              description={createDescription} onDescriptionChange={setCreateDescription}
              creating={creating}
              onSubmit={handleCreate}
              onCancel={handleClose}
              translatedGetTypeLabel={translatedGetTypeLabel}
              translatedGetStatusLabel={translatedGetStatusLabel}
              t={t}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
