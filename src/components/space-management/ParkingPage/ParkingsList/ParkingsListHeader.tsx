'use client';

/**
 * 🅿️ ENTERPRISE PARKINGS LIST HEADER COMPONENT
 *
 * Header για τη λίστα θέσεων στάθμευσης
 * Ακολουθεί το exact pattern από StoragesListHeader.tsx
 */

import React from 'react';
import { Car } from 'lucide-react';
import { GenericListHeader } from '@/components/shared/GenericListHeader';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ParkingsListHeaderProps {
  parkingSpots: ParkingSpot[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  showToolbar?: boolean;
  onToolbarToggle?: (show: boolean) => void;
}

export function ParkingsListHeader({
  parkingSpots,
  searchTerm,
  onSearchChange,
  showToolbar = false,
  onToolbarToggle
}: ParkingsListHeaderProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);

  return (
    <div>
      <GenericListHeader
        icon={Car}
        entityName={t('parkings.header.title')}
        itemCount={parkingSpots.length}
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        searchPlaceholder={t('parkings.header.searchPlaceholder')}
        showToolbar={showToolbar}
        onToolbarToggle={onToolbarToggle}
        hideSearch  // 🏢 ENTERPRISE: Κρύβουμε το search - χρησιμοποιούμε το CompactToolbar search
      />
    </div>
  );
}
