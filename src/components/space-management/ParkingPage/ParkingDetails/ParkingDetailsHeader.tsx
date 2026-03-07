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

const logger = createModuleLogger('ParkingDetailsHeader');

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
}

export function ParkingDetailsHeader({
  parking,
  isEditing,
  isSaving,
  onStartEdit,
  onSave,
  onCancel,
}: ParkingDetailsHeaderProps) {
  const { t } = useTranslation('parking');

  // 🏢 ENTERPRISE: Actions via centralized presets
  // Edit mode: Save (🟢), Cancel (⚪)
  // Normal mode: View (🔵 primary), Edit (🔵), Print (⚪)
  const actions: EntityHeaderAction[] = isEditing
    ? [
        createEntityAction('save', isSaving ? t('header.saving') : t('header.save'), isSaving ? () => {} : onSave),
        createEntityAction('cancel', t('header.cancel'), onCancel),
      ]
    : [
        createEntityAction('view', t('header.viewParking'), () => logger.info('Show parking details')),
        createEntityAction('edit', t('header.edit'), onStartEdit),
        createEntityAction('print', t('header.print'), () => logger.info('Print parking details')),
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
