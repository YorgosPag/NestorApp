'use client';
/* eslint-disable custom/no-hardcoded-strings */

/**
 * @fileoverview Sales Storage Sidebar — ADR-199
 * @description List + Details sidebar for storage sales
 * @pattern Storage-specific components on top of the shared `SalesSpaceSidebar` shell
 */

import React from 'react';
import { Package, Map, FileText, Camera, Video } from 'lucide-react';
import { SalesStorageCard } from '@/components/sales/cards/SalesStorageCard';
import { StorageQuickFilters } from '@/components/sales/filters/StorageQuickFilters';
import { StorageDetailPanel } from '@/components/sales/details/StorageDetailPanel';
import {
  SalesSpaceSidebar,
  SALES_SPACE_SIDEBAR_NAMESPACES,
  type SalesSpaceRedirectTab,
} from '@/components/sales/shared/SalesSpaceSidebar';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Storage } from '@/types/storage/contracts';
import '@/lib/design-system';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface SalesStorageSidebarProps {
  items: Storage[];
  selectedItem: Storage | null;
  onSelectItem: (id: string) => void;
  selectedItemId: string | null;
  selectedStatus: string;
  onStatusChange: (s: string) => void;
  selectedType: string;
  onTypeChange: (t: string) => void;
}

// =============================================================================
// 🏢 STORAGE-SPECIFIC ACCESSORS
// =============================================================================

function getStorageTitle(storage: Storage): string {
  return storage.name || storage.id;
}

function getStorageSubtitle(storage: Storage): string {
  return `${storage.building ?? ''} · ${storage.floor ?? ''}`;
}

function storageSpacesHref(storage: Storage): string {
  return `/spaces/storage?storageId=${storage.id}`;
}

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function SalesStorageSidebar({
  items,
  selectedItem,
  onSelectItem,
  selectedItemId,
  selectedStatus,
  onStatusChange,
  selectedType,
  onTypeChange,
}: SalesStorageSidebarProps) {
  const { t } = useTranslation(SALES_SPACE_SIDEBAR_NAMESPACES);

  const redirectTabs = React.useMemo<readonly SalesSpaceRedirectTab[]>(
    () => [
      {
        id: 'floor-plan',
        icon: Map,
        label: t('salesStorage.tabs.floorPlan'),
        hint: t('salesStorage.tabs.floorPlanHint'),
      },
      {
        id: 'documents',
        icon: FileText,
        label: t('salesStorage.tabs.documents'),
        hint: t('salesStorage.tabs.documentsHint'),
      },
      {
        id: 'photos',
        icon: Camera,
        label: t('salesStorage.tabs.photos'),
        hint: t('salesStorage.tabs.photosHint'),
      },
      {
        id: 'videos',
        icon: Video,
        label: t('salesStorage.tabs.videos'),
        hint: t('salesStorage.tabs.videosHint'),
      },
    ],
    [t]
  );

  const renderCard = React.useCallback(
    (storage: Storage, isSelected: boolean) => (
      <SalesStorageCard storage={storage} isSelected={isSelected} onSelect={onSelectItem} />
    ),
    [onSelectItem]
  );

  return (
    <SalesSpaceSidebar<Storage>
      items={items}
      selectedItem={selectedItem}
      selectedItemId={selectedItemId}
      onSelectItem={onSelectItem}
      icon={Package}
      entityType="storage"
      redirectTabs={redirectTabs}
      labels={{
        listLabel: t('salesStorage.listLabel'),
        listTitle: t('salesStorage.listTitle'),
        noResults: t('salesStorage.noResults'),
        detailsTitle: t('salesStorage.details.title'),
        openInSpaces: t('salesStorage.tabs.openInSpaces'),
        infoTab: t('salesStorage.tabs.info'),
        historyTab: t('salesStorage.tabs.history'),
      }}
      spacesHref={storageSpacesHref}
      getTitle={getStorageTitle}
      getSubtitle={getStorageSubtitle}
      renderDetailPanel={(storage) => <StorageDetailPanel data={storage} />}
      renderCard={renderCard}
      quickFilters={
        <StorageQuickFilters
          selectedStatus={selectedStatus}
          onStatusChange={onStatusChange}
          selectedType={selectedType}
          onTypeChange={onTypeChange}
        />
      }
    />
  );
}
