'use client';

/**
 * 🅿️ ENTERPRISE PARKING DETAILS HEADER COMPONENT
 *
 * Header για τις λεπτομέρειες θέσης στάθμευσης.
 * Supports inline editing toggle (Edit ↔ Save/Cancel).
 * Follows the exact pattern from BuildingDetailsHeader.tsx.
 */

import React from 'react';
import { Car, Eye, Edit, Save, X, FileText } from 'lucide-react';
import { EntityDetailsHeader, type EntityHeaderAction } from '@/core/entity-headers';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
import { GRADIENT_HOVER_EFFECTS } from '@/components/ui/effects';
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

  // Build actions array based on editing state
  const actions: EntityHeaderAction[] = isEditing
    ? [
        {
          label: isSaving ? t('header.saving') : t('header.save'),
          onClick: isSaving ? () => {} : onSave,
          icon: Save,
          className: `bg-gradient-to-r from-green-500 to-emerald-600 ${GRADIENT_HOVER_EFFECTS.BLUE_PURPLE_DEEPER}`,
        },
        {
          label: t('header.cancel'),
          onClick: onCancel,
          icon: X,
          variant: 'outline',
        },
      ]
    : [
        {
          label: t('header.viewParking'),
          onClick: () => logger.info('Show parking details'),
          icon: Eye,
          className: GRADIENT_HOVER_EFFECTS.PRIMARY_BUTTON,
        },
        {
          label: t('header.edit'),
          onClick: onStartEdit,
          icon: Edit,
          variant: 'outline',
        },
        {
          label: t('header.print'),
          onClick: () => logger.info('Print parking details'),
          icon: FileText,
          variant: 'outline',
        },
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
