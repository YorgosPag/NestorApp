'use client';

/**
 * 🅿️ ENTERPRISE PARKING DETAILS HEADER COMPONENT
 *
 * Header για τις λεπτομέρειες θέσης στάθμευσης.
 * Supports inline editing toggle (Edit ↔ Save/Cancel).
 * Uses centralized entity action presets.
 */

import React from 'react';
import { Car } from 'lucide-react';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import type { EntityHeaderAction } from '@/core/entity-headers';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';

const _logger = createModuleLogger('ParkingDetailsHeader');

interface ParkingDetailsHeaderProps {
  parking: ParkingSpot;
  /** Whether inline editing is active */
  isEditing: boolean;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Start inline editing on the General tab */
  onStartEdit: () => void;
  /** Trigger save (delegates to ParkingGeneralTab) */
  onSave: () => void;
  /** Cancel editing and revert changes */
  onCancel: () => void;
  /** Open the Add Parking dialog */
  onNewParking?: () => void;
  /** Delete the current parking spot */
  onDelete?: () => void;
  /** Open the Parking Showcase share dialog */
  onShowcaseParking?: () => void;
}

export function ParkingDetailsHeader({
  parking,
  isEditing,
  isSaving,
  onStartEdit,
  onSave,
  onCancel,
  onNewParking,
  onDelete,
  onShowcaseParking,
}: ParkingDetailsHeaderProps) {
  const { t } = useTranslation(['parking', 'trash', 'showcase']);

  // 🏢 ENTERPRISE: Actions via centralized presets
  // Edit mode: Save (🟢), Cancel (⚪)
  // Normal mode: New (🟢), Edit (🔵), Delete (🔴)
  const actions: EntityHeaderAction[] = isEditing
    ? [
        createEntityAction('save', isSaving ? t('header.saving') : t('header.save'), isSaving ? () => {} : onSave),
        createEntityAction('cancel', t('header.cancel'), onCancel),
      ]
    : [
        ...(onShowcaseParking ? [createEntityAction('showcase', t('parkingShowcase.actions.showcase', { ns: 'showcase' }), onShowcaseParking)] : []),
        createEntityAction('new', t('header.newParking'), () => onNewParking?.()),
        createEntityAction('edit', t('header.edit'), onStartEdit),
        createEntityAction('delete', t('moveToTrash', { ns: 'trash' }), () => onDelete?.()),
      ];

  return (
    <>
      {/* 🖥️ DESKTOP: Show full header with actions */}
      <div className="hidden md:block">
        <EntityDetailsHeader
          icon={Car}
          title={parking.number || t('header.viewParking')}
          actions={actions}
          variant="detailed"
        />
      </div>

      {/* 📱 MOBILE: Hidden (no header duplication) */}
    </>
  );
}
