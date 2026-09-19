'use client';

/**
 * StorageQuickCreateSheet — Sheet wrapping the canonical StorageGeneralTab in
 * create mode, identical to the creation panel in /spaces/storage.
 *
 * Το κέλυφος (Sheet + κεφαλίδα + αποθήκευση/ακύρωση) είναι το κοινό `SpaceQuickCreateSheet`
 * (ADR-777 §8.60.20)· εδώ μένει μόνο ό,τι είναι της αποθήκης (και η ειδοποίηση επιτυχίας).
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Warehouse } from 'lucide-react';
import { StorageGeneralTab } from '@/components/space-management/StoragesPage/StorageDetails/tabs/StorageGeneralTab';
import { useNotifications } from '@/providers/NotificationProvider';
import type { Building } from '@/types/building/contracts';
import type { Storage } from '@/types/storage/contracts';
import { NEW_SPACE_STATUSES } from '@/lib/spaces/space-status-split';
import { SpaceQuickCreateSheet } from './SpaceQuickCreateSheet';

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

  const emptyStorage: Storage = {
    id: '',
    name: 'Αποθήκη',
    type: 'storage',
    // ADR-777 §8.60.20 — νέα εγγραφή: ζωντανή, λειτουργικά «πρόχειρο» (ίδιος κανόνας με τα ακίνητα).
    ...NEW_SPACE_STATUSES,
    building: building.name || '',
    buildingId: building.id,
    floor: '',
    area: 0,
    projectId: building.projectId ?? undefined,
  };

  const handleCreated = useCallback(() => {
    success(tStorage('storages.notifications.created'));
    onStorageCreated?.();
  }, [tStorage, success, onStorageCreated]);

  return (
    <SpaceQuickCreateSheet
      open={open}
      onOpenChange={onOpenChange}
      icon={Warehouse}
      labels={{
        title: tStorage('header.newStorage'),
        save: tStorage('storages.form.create'),
        cancel: tStorage('storages.form.cancel'),
      }}
      onCreated={handleCreated}
      renderForm={({ saveRef, onCreated }) => (
        <StorageGeneralTab storage={emptyStorage} isEditing createMode onSaveRef={saveRef} onCreated={onCreated} />
      )}
    />
  );
}
