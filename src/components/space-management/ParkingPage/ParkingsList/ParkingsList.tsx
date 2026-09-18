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
import type { SortableValue } from '@/lib/array-utils';
import { compareByNameThenId } from '@/lib/ordering/total-name-order';
import { sortIntoPriceClassSections } from '@/lib/properties/price-class-sections';
import { PriceClassSectionedList } from '@/components/shared/price-sections/PriceClassSectionedList';

/** Ολική σειρά για ισοπαλίες και απουσία τιμής: αριθμός θέσης → `id`. */
function byNumberThenId(a: ParkingSpot, b: ParkingSpot): number {
  return compareByNameThenId(a.number || '', a.id, b.number || '', b.id);
}

/**
 * Το κλειδί μιας θέσης για κάθε σειρά **εκτός** της τιμής — εκείνη διαμερίζει
 * (`partitionByPriceClass`) και **δεν** έχει επίπεδο κλειδί (ADR-777 §8.60.14.14).
 * Ένας συγκριτής για όλες (`compareSortValues`): κενά τελευταία και στις δύο κατευθύνσεις.
 */
function parkingSortValue(p: ParkingSpot, field: SortField): SortableValue {
  switch (field) {
    case 'name':
      return (p.number || '').toLowerCase();
    case 'area':
      return p.area || 0;
    case 'status':
      return (p.status || '').toLowerCase();
    case 'location':
      return (p.location || '').toLowerCase();
    case 'number':
      return String(p.floor || '').toLowerCase();
    case 'date':
      return p.updatedAt?.getTime() ?? p.createdAt?.getTime() ?? 0;
    case 'type':
      return (p.type || '').toLowerCase();
    default:
      return null;
  }
}

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
          parking.price,
          // ADR-777 §8.60.18 — τα ποσά ανά ρόλο (το `price` μένει μόνο για παλιά έγγραφα).
          parking.commercial?.askingPrice,
          parking.commercial?.rentPrice,
        ],
        list.searchTerm
      );
    });
  }, [parkingSpots, list.searchTerm, list.selectedStatuses]);

  /*
    🔑 ADR-777 §8.60.14.14 — «κατά αξία» = ΠΡΩΤΑ η μονάδα, ΜΕΤΑ ο αριθμός (Revit `Sort By` →
    `Then By`): τμήματα ανά κλάση, ποτέ 60 €/μήνα και 18.000 € σε έναν άξονα. Κάθε άλλη σειρά
    είναι ΕΝΑ τμήμα χωρίς επιγραφή.
  */
  const sections = useMemo(
    () => sortIntoPriceClassSections(filteredParkingSpots, {
      byPrice: list.sortBy === 'value',
      direction: list.sortOrder,
      tieBreak: byNumberThenId,
      valueOf: (parking) => parkingSortValue(parking, list.sortBy),
    }),
    [filteredParkingSpots, list.sortBy, list.sortOrder],
  );

  return (
    <EntityListColumn hasBorder aria-label={t('parkings.list.ariaLabel')}>
      <ParkingsListHeader
        parkingSpots={filteredParkingSpots}  // 🏢 ENTERPRISE: Περνάμε filtered results για δυναμικό count
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
          <PriceClassSectionedList
            sections={sections}
            idPrefix="parkings-section"
            getKey={(parking) => parking.id}
            renderItem={(parking) => (
              <ParkingListCard
                parking={parking}
                isSelected={selectedParking?.id === parking.id}
                isFavorite={list.favorites.includes(parking.id)}
                onSelect={() => onSelectParking?.(parking)}
                onToggleFavorite={() => list.toggleFavorite(parking.id)}
              />
            )}
          />

          {filteredParkingSpots.length === 0 && (
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


