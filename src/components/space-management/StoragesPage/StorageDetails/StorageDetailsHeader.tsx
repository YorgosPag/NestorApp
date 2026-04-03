'use client';

/**
 * 📦 ENTERPRISE STORAGE DETAILS HEADER COMPONENT
 *
 * Header για τις λεπτομέρειες αποθήκης.
 * ADR-193: Supports inline editing toggle (Edit ↔ Save/Cancel).
 * Uses centralized entity action presets.
 */

import React from 'react';
import { Warehouse } from 'lucide-react';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import type { EntityHeaderAction } from '@/core/entity-headers';
import type { Storage } from '@/types/storage/contracts';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';

const _logger = createModuleLogger('StorageDetailsHeader');

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
}

export function StorageDetailsHeader({
  storage,
  isEditing,
  isSaving,
  onStartEdit,
  onSave,
  onCancel,
  onNewStorage,
  onDelete,
}: StorageDetailsHeaderProps) {
  const { t } = useTranslation('storage');

  // Edit mode: Save (green), Cancel (white)
  // Normal mode: New (green), Edit (blue), Delete (red)
  const actions: EntityHeaderAction[] = isEditing
    ? [
        createEntityAction('save', isSaving ? t('header.saving', 'Αποθήκευση...') : t('header.save', 'Αποθήκευση'), isSaving ? () => {} : onSave),
        createEntityAction('cancel', t('header.cancel', 'Ακύρωση'), onCancel),
      ]
    : [
        createEntityAction('new', t('header.newStorage', 'Νέα Αποθήκη'), () => onNewStorage?.()),
        createEntityAction('edit', t('header.edit', 'Επεξεργασία'), onStartEdit),
        createEntityAction('delete', t('header.delete', 'Μεταφορά στον κάδο'), () => onDelete?.()),
      ];

  return (
    <>
      {/* Desktop: Show full header with actions */}
      <div className="hidden md:block">
        <EntityDetailsHeader
          icon={Warehouse}
          title={storage.name}
          actions={actions}
          variant="detailed"
        />
      </div>

      {/* Mobile: Hidden (no header duplication) */}
    </>
  );
}
