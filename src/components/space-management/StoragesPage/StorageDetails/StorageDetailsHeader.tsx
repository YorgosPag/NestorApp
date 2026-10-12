'use client';

/**
 * 📦 Κεφαλίδα λεπτομερειών αποθήκης — τίτλος και κείμενα της αποθήκης πάνω στην κοινή κεφαλίδα χώρου (ADR-193).
 */

import { Warehouse } from 'lucide-react';
import { SpaceDetailsHeader } from '@/components/shared/space-info/SpaceDetailsHeader';
import type { Storage } from '@/types/storage/contracts';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface StorageDetailsHeaderProps {
  storage: Storage;
  /** Whether inline editing is active */
  isEditing: boolean;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Start inline editing on the General tab */
  onStartEdit: () => void;
  /** Trigger save (delegates to StorageGeneralTab) */
  onSave: () => void;
  /** Cancel editing and revert changes */
  onCancel: () => void;
  /** Open the Add Storage dialog */
  onNewStorage?: () => void;
  /** Delete the current storage */
  onDelete?: () => void;
  /** Open the Storage Showcase share dialog */
  onShowcaseStorage?: () => void;
  /** Whether the storage is displayed in the trash view — hides mutating actions */
  isInTrash?: boolean;
}

export function StorageDetailsHeader({ storage, onNewStorage, onShowcaseStorage, ...session }: StorageDetailsHeaderProps) {
  const { t } = useTranslation(['storage', 'trash', 'showcase']);

  return (
    <SpaceDetailsHeader
      {...session}
      icon={Warehouse}
      title={storage.name}
      onNew={onNewStorage}
      onShowcase={onShowcaseStorage}
      labels={{
        save: t('header.save'),
        saving: t('header.saving'),
        cancel: t('header.cancel'),
        showcase: t('storageShowcase.actions.showcase', { ns: 'showcase' }),
        create: t('header.newStorage'),
        edit: t('header.edit'),
        moveToTrash: t('moveToTrash', { ns: 'trash' }),
      }}
    />
  );
}
