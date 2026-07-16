'use client';
/* eslint-disable custom/no-hardcoded-strings */

/**
 * @fileoverview Sales Parking Sidebar — ADR-199
 * @description List + Details sidebar for parking sales
 * @pattern Parking-specific components on top of the shared `SalesSpaceSidebar` shell
 */

import React from 'react';
import { Car, FileText, Camera, Video } from 'lucide-react';
import { SalesParkingCard } from '@/components/sales/cards/SalesParkingCard';
import { ParkingQuickFilters } from '@/components/sales/filters/ParkingQuickFilters';
import { ParkingDetailPanel } from '@/components/sales/details/ParkingDetailPanel';
import {
  SalesSpaceSidebar,
  SALES_SPACE_SIDEBAR_NAMESPACES,
  type SalesSpaceRedirectTab,
} from '@/components/sales/shared/SalesSpaceSidebar';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ParkingSpot } from '@/types/parking';
import '@/lib/design-system';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface SalesParkingSidebarProps {
  items: ParkingSpot[];
  selectedItem: ParkingSpot | null;
  onSelectItem: (id: string) => void;
  selectedItemId: string | null;
  selectedStatus: string;
  onStatusChange: (s: string) => void;
  selectedType: string;
  onTypeChange: (t: string) => void;
}

// =============================================================================
// 🏢 PARKING-SPECIFIC ACCESSORS
// =============================================================================

function getParkingTitle(spot: ParkingSpot): string {
  return spot.number || spot.id;
}

function parkingSpacesHref(spot: ParkingSpot): string {
  return `/spaces/parking?parkingId=${spot.id}`;
}

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function SalesParkingSidebar({
  items,
  selectedItem,
  onSelectItem,
  selectedItemId,
  selectedStatus,
  onStatusChange,
  selectedType,
  onTypeChange,
}: SalesParkingSidebarProps) {
  const { t } = useTranslation(SALES_SPACE_SIDEBAR_NAMESPACES);

  const redirectTabs = React.useMemo<readonly SalesSpaceRedirectTab[]>(
    () => [
      {
        id: 'documents',
        icon: FileText,
        label: t('salesParking.tabs.documents'),
        hint: t('salesParking.tabs.documentsHint'),
      },
      {
        id: 'photos',
        icon: Camera,
        label: t('salesParking.tabs.photos'),
        hint: t('salesParking.tabs.photosHint'),
      },
      {
        id: 'videos',
        icon: Video,
        label: t('salesParking.tabs.videos'),
        hint: t('salesParking.tabs.videosHint'),
      },
    ],
    [t]
  );

  const getSubtitle = React.useCallback(
    (spot: ParkingSpot) =>
      spot.floor ? `${t('parking:general.fields.floor')}: ${spot.floor}` : undefined,
    [t]
  );

  const renderCard = React.useCallback(
    (spot: ParkingSpot, isSelected: boolean) => (
      <SalesParkingCard spot={spot} isSelected={isSelected} onSelect={onSelectItem} />
    ),
    [onSelectItem]
  );

  return (
    <SalesSpaceSidebar<ParkingSpot>
      items={items}
      selectedItem={selectedItem}
      selectedItemId={selectedItemId}
      onSelectItem={onSelectItem}
      icon={Car}
      entityType="parking"
      redirectTabs={redirectTabs}
      labels={{
        listLabel: t('salesParking.listLabel'),
        listTitle: t('salesParking.listTitle'),
        noResults: t('salesParking.noResults'),
        detailsTitle: t('salesParking.details.title'),
        openInSpaces: t('salesParking.tabs.openInSpaces'),
        infoTab: t('salesParking.tabs.info'),
        historyTab: t('salesParking.tabs.history'),
      }}
      spacesHref={parkingSpacesHref}
      getTitle={getParkingTitle}
      getSubtitle={getSubtitle}
      renderDetailPanel={(spot) => <ParkingDetailPanel data={spot} />}
      renderCard={renderCard}
      quickFilters={
        <ParkingQuickFilters
          selectedStatus={selectedStatus}
          onStatusChange={onStatusChange}
          selectedType={selectedType}
          onTypeChange={onTypeChange}
        />
      }
    />
  );
}
