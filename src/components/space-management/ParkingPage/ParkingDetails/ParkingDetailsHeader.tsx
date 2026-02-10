'use client';

/**
 * 🅿️ ENTERPRISE PARKING DETAILS HEADER COMPONENT
 *
 * Header για τις λεπτομέρειες θέσης στάθμευσης
 * Ακολουθεί το exact pattern από StorageDetailsHeader.tsx
 */

import React from 'react';
import { Car, Eye, Edit, FileText } from 'lucide-react';
import { EntityDetailsHeader } from '@/core/entity-headers';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
import { GRADIENT_HOVER_EFFECTS } from '@/components/ui/effects';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ParkingDetailsHeaderProps {
  parking: ParkingSpot;
}

export function ParkingDetailsHeader({ parking }: ParkingDetailsHeaderProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('parking');

  // Helper function for type labels using i18n
  const getTypeLabel = (type: string) => {
    return t(`general.types.${type}`, t('general.unknown'));
  };

  return (
    <>
      {/* 🖥️ DESKTOP: Show full header with actions */}
      <div className="hidden md:block">
        <EntityDetailsHeader
          icon={Car}
          title={parking.number || t('header.viewParking')}
          actions={[
            {
              label: t('header.viewParking'),
              onClick: () => console.log('Show parking details'),
              icon: Eye,
              className: GRADIENT_HOVER_EFFECTS.PRIMARY_BUTTON
            },
            {
              label: t('header.edit'),
              onClick: () => console.log('Edit parking'),
              icon: Edit,
              variant: 'outline'
            },
            {
              label: t('header.print'),
              onClick: () => console.log('Print parking details'),
              icon: FileText,
              variant: 'outline'
            }
          ]}
          variant="detailed"
        />
      </div>

      {/* 📱 MOBILE: Hidden (no header duplication) */}
    </>
  );
}
