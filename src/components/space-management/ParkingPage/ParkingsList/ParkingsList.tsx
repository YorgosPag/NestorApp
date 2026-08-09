'use client';

/**
 * 🅿️ ENTERPRISE PARKINGS LIST COMPONENT
 *
 * Λίστα θέσεων στάθμευσης με filtering και sorting
 * Ακολουθεί το exact pattern από StoragesList.tsx
 */

import React, { useMemo } from 'react';
import { useEntityListState } from '@/hooks/useEntityListState';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Car } from 'lucide-react';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
import { useIconSizes } from '@/hooks/useIconSizes';
import { EntityListColumn } from '@/core/containers';
import { matchesSearchTerm } from '@/lib/search/search';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ParkingsList');

import { ParkingsListHeader } from './ParkingsListHeader';
// 🏢 ENTERPRISE: Using centralized domain card
import { ParkingListCard } from '@/domain';
import { ResponsiveCompactToolbar } from '@/components/core/CompactToolbar';
import { parkingToolbarConfig } from '@/components/core/CompactToolbar/configs';
import type { SortField } from '@/components/core/CompactToolbar/types';
import '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { ParkingStatusQuickFilters } from '@/components/shared/SpaceStatusQuickFilters';
import { compareSortValues } from '@/lib/array-utils';
import { priceSortKey } from '@/lib/properties/price-resolver';

interface ParkingsListProps {
  parkingSpots: ParkingSpot[];
  selectedParking: ParkingSpot | null;
  onSelectParking?: (parking: ParkingSpot) => void;
  onNewItem?: () => void;
}

export function ParkingsList({
  parkingSpots,
  selectedParking,
  onSelectParking,
  onNewItem,
}: ParkingsListProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();

  // Η κατάσταση που κρατά ΚΑΘΕ σελίδα λίστας — μία δήλωση, δες `useEntityListState`.
  const list = useEntityListState<SortField>({ defaultSortField: 'name' });

  // 🏢 ENTERPRISE: Filter parking spots using centralized search + status quick filter
  const filteredParkingSpots = useMemo(() => {
    return parkingSpots.filter(parking => {
      if (list.selectedStatuses.length > 0 && !list.selectedStatuses.includes(parking.status ?? '')) {
        return false;
      }
      return matchesSearchTerm(
        [
          parking.number,
          parking.location,
          parking.floor,
          parking.type,
          parking.status,
          parking.notes,
          parking.area,
          parking.price
        ],
        list.searchTerm
      );
    });
  }, [parkingSpots, list.searchTerm, list.selectedStatuses]);

  const sortedParkingSpots = [...filteredParkingSpots].sort((a, b) => {
    let aValue: string | number | null;
    let bValue: string | number | null;

    switch (list.sortBy) {
      case 'name':
        aValue = (a.number || '').toLowerCase();
        bValue = (b.number || '').toLowerCase();
        break;
      case 'area':
        aValue = a.area || 0;
        bValue = b.area || 0;
        break;
      case 'value':
        aValue = priceSortKey(a);
        bValue = priceSortKey(b);
        break;
      case 'status':
        aValue = (a.status || '').toLowerCase();
        bValue = (b.status || '').toLowerCase();
        break;
      case 'location':
        aValue = (a.location || '').toLowerCase();
        bValue = (b.location || '').toLowerCase();
        break;
      case 'number':
        aValue = String(a.floor || '').toLowerCase();
        bValue = String(b.floor || '').toLowerCase();
        break;
      case 'date':
        aValue = a.updatedAt?.getTime() ?? a.createdAt?.getTime() ?? 0;
        bValue = b.updatedAt?.getTime() ?? b.createdAt?.getTime() ?? 0;
        break;
      case 'type':
        aValue = (a.type || '').toLowerCase();
        bValue = (b.type || '').toLowerCase();
        break;
      default:
        return 0;
    }

    // Ένας συγκριτής για κάθε ταξινομήσιμη λίστα: «δεν έχει τιμή» πάει τελευταίο
    // ΚΑΙ στις δύο φορές (ADR-777 Α6 · σύμβαση φύλλου εργασίας για τα κενά), και
    // το κείμενο συγκρίνεται με ΡΗΤΟ ελληνικό locale. Δες `lib/array-utils`.
    return compareSortValues(aValue, bValue, list.sortOrder);
  });

  return (
    <EntityListColumn hasBorder aria-label={t('parkings.list.ariaLabel')}>
      <ParkingsListHeader
        parkingSpots={sortedParkingSpots}  // 🏢 ENTERPRISE: Περνάμε filtered results για δυναμικό count
        searchTerm={list.searchTerm}
        onSearchChange={list.setSearchTerm}
        showToolbar={list.showToolbar}
        onToolbarToggle={list.setShowToolbar}
      />

      {/* Πάντα ορατή σε desktop, πίσω από τον διακόπτη σε κινητό — ΜΙΑ φορά τα props */}
      <ResponsiveCompactToolbar
        {...list.toolbarBindings}
        config={parkingToolbarConfig}
        onNewItem={() => onNewItem?.()}
        onEditItem={(id) => logger.info('Edit parking', { id })}
        onDeleteItems={(ids) => logger.info('Delete parking', { ids })}
        onExport={() => logger.info('Export parking')}
        onRefresh={() => logger.info('Refresh parking')}
      />

      {/* 🏢 ENTERPRISE: Quick Filters for Parking Status */}
      <ParkingStatusQuickFilters
        selectedTypes={list.selectedStatuses}
        onTypeChange={list.setSelectedStatuses}
        compact
      />

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {sortedParkingSpots.map((parking) => (
            <ParkingListCard
              key={parking.id}
              parking={parking}
              isSelected={selectedParking?.id === parking.id}
              isFavorite={list.favorites.includes(parking.id)}
              onSelect={() => onSelectParking?.(parking)}
              onToggleFavorite={() => list.toggleFavorite(parking.id)}
            />
          ))}

          {sortedParkingSpots.length === 0 && (
            <div className={cn("text-center py-8", colors.text.muted)}>
              <Car className={`${iconSizes.xl3} mx-auto mb-2 opacity-50`} />
              <p>{t('parkings.list.noResults')}</p>
              {list.searchTerm && (
                <p className="text-sm">{t('parkings.list.noResultsForTerm', { term: list.searchTerm })}</p>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </EntityListColumn>
  );
}


