'use client';

/**
 * 🅿️ ENTERPRISE PARKINGS LIST COMPONENT
 *
 * Λίστα θέσεων στάθμευσης με filtering και sorting
 * Ακολουθεί το exact pattern από StoragesList.tsx
 */

import React from 'react';
import { useEntityListState } from '@/hooks/useEntityListState';
import { Car } from 'lucide-react';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
import { EntityListColumn } from '@/core/containers';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { ParkingsListHeader } from './ParkingsListHeader';
// 🏢 ENTERPRISE: Using centralized domain card
import { ParkingListCard } from '@/domain';
import { parkingToolbarConfig } from '@/components/core/CompactToolbar/configs';
import type { SortField } from '@/components/core/CompactToolbar/types';
import '@/lib/design-system';
import { SpaceListBody } from '@/components/space-management/shared/SpaceListBody';
import { tieBreakByName, useSpaceListSections, type SpaceListRules } from '@/components/space-management/shared/useSpaceListSections';
import type { SortableValue } from '@/lib/array-utils';

/** Ολική σειρά για ισοπαλίες και απουσία τιμής: αριθμός θέσης → `id`. */
const byNumberThenId = tieBreakByName<ParkingSpot>((parking) => parking.number || '');

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

/** Οι κανόνες της λίστας (σταθερά σε επίπεδο module — σταθερές αναφορές για το `useMemo`). */
const PARKING_LIST_RULES: SpaceListRules<ParkingSpot, SortField> = {
  searchFields: (parking) => [
    parking.number,
    parking.location,
    parking.floor,
    parking.type,
    parking.notes,
    parking.area,
    parking.price,
    // ADR-777 §8.60.18 — τα ποσά ανά ρόλο (το `price` μένει μόνο για παλιά έγγραφα).
    parking.commercial?.askingPrice,
    parking.commercial?.rentPrice,
  ],
  sortValue: parkingSortValue,
  tieBreak: byNumberThenId,
};

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

  // Η κατάσταση που κρατά ΚΑΘΕ σελίδα λίστας — μία δήλωση, δες `useEntityListState`.
  const list = useEntityListState<SortField>({ defaultSortField: 'name' });

  // ADR-777 §8.60.20 — φίλτρο διάθεσης + αναζήτηση + ενότητες τιμής: το ΕΝΑ hook των λιστών χώρων.
  const { filtered: filteredParkingSpots, sections } = useSpaceListSections(parkingSpots, list, PARKING_LIST_RULES);

  return (
    <EntityListColumn hasBorder aria-label={t('parkings.list.ariaLabel')}>
      <ParkingsListHeader
        parkingSpots={filteredParkingSpots}  // 🏢 ENTERPRISE: Περνάμε filtered results για δυναμικό count
        searchTerm={list.searchTerm}
        onSearchChange={list.setSearchTerm}
        showToolbar={list.showToolbar}
        onToolbarToggle={list.setShowToolbar}
      />


      {/* ADR-777 §8.60.20 — γρήγορες επιλογές ΔΙΑΘΕΣΗΣ + λίστα σε ενότητες: το ΕΝΑ σώμα (`SpaceListBody`). */}
      <SpaceListBody
        toolbar={{ bindings: list.toolbarBindings, config: parkingToolbarConfig, onNewItem, logLabel: 'parking' }}
        selectedStatuses={list.selectedStatuses}
        onStatusesChange={list.setSelectedStatuses}
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
        empty={{
          shown: filteredParkingSpots.length === 0,
          icon: Car,
          text: t('parkings.list.noResults'),
          termText: list.searchTerm ? t('parkings.list.noResultsForTerm', { term: list.searchTerm }) : undefined,
        }}
      />
    </EntityListColumn>
  );
}


