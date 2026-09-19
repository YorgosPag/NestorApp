'use client';

import React from 'react';
import { useEntityListState } from '@/hooks/useEntityListState';
import { Warehouse } from 'lucide-react';
import type { Storage } from '@/types/storage/contracts';
import { EntityListColumn } from '@/core/containers';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { StoragesListHeader } from './StoragesListHeader';
// 🏢 ENTERPRISE: Using centralized domain card
import { StorageListCard } from '@/domain';
import { storagesToolbarConfig } from '@/components/core/CompactToolbar/configs';
import type { SortField } from '@/components/core/CompactToolbar/types';
import '@/lib/design-system';
import { SpaceListBody } from '@/components/space-management/shared/SpaceListBody';
import { tieBreakByName, useSpaceListSections, type SpaceListRules } from '@/components/space-management/shared/useSpaceListSections';
import type { SortableValue } from '@/lib/array-utils';

/** Ολική σειρά για ισοπαλίες και απουσία τιμής: όνομα → `id`. */
const byNameThenId = tieBreakByName<Storage>((storage) => storage.name);

/**
 * Το κλειδί μιας αποθήκης για κάθε σειρά **εκτός** της τιμής — εκείνη διαμερίζει και **δεν**
 * έχει επίπεδο κλειδί (ADR-777 §8.60.14.14). Κενά τελευταία και στις δύο κατευθύνσεις.
 */
function storageSortValue(x: Storage, field: SortField): SortableValue {
  switch (field) {
    case 'name':
      return x.name.toLowerCase();
    case 'area':
      return x.area;
    case 'location':
      return x.building.toLowerCase();
    case 'number':
      return x.floor.toLowerCase();
    case 'date':
      return x.lastUpdated instanceof Date ? x.lastUpdated.getTime() : x.lastUpdated ? new Date(x.lastUpdated).getTime() : 0;
    case 'type':
      return x.type.toLowerCase();
    default:
      return null;
  }
}

/** Οι κανόνες της λίστας (σταθερά σε επίπεδο module — σταθερές αναφορές για το `useMemo`). */
const STORAGE_LIST_RULES: SpaceListRules<Storage, SortField> = {
  searchFields: (storage) => [
    storage.name,
    storage.description,
    storage.building,
    storage.floor,
    storage.type,
    storage.owner,
    storage.area,
    storage.price,
    // ADR-777 §8.60.18 — τα ποσά ανά ρόλο (το `price` μένει μόνο για παλιά έγγραφα).
    storage.commercial?.askingPrice,
    storage.commercial?.rentPrice,
  ],
  sortValue: storageSortValue,
  tieBreak: byNameThenId,
};

interface StoragesListProps {
  storages: Storage[];
  selectedStorage: Storage | null;
  onSelectStorage?: (storage: Storage) => void;
  onNewItem?: () => void;
}

export function StoragesList({
  storages,
  selectedStorage,
  onSelectStorage,
  onNewItem,
}: StoragesListProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('storage');

  // Η κατάσταση που κρατά ΚΑΘΕ σελίδα λίστας — μία δήλωση, δες `useEntityListState`.
  const list = useEntityListState<SortField>({ defaultSortField: 'name' });

  // ADR-777 §8.60.20 — φίλτρο διάθεσης + αναζήτηση + ενότητες τιμής: το ΕΝΑ hook των λιστών χώρων.
  const { filtered: filteredStorages, sections } = useSpaceListSections(storages, list, STORAGE_LIST_RULES);

  return (
    <EntityListColumn hasBorder aria-label={t('storages.list.ariaLabel')}>
      <StoragesListHeader
        storages={filteredStorages}  // 🏢 ENTERPRISE: Περνάμε filtered results για δυναμικό count
        searchTerm={list.searchTerm}
        onSearchChange={list.setSearchTerm}
        showToolbar={list.showToolbar}
        onToolbarToggle={list.setShowToolbar}
      />


      {/* ADR-777 §8.60.20 — γρήγορες επιλογές ΔΙΑΘΕΣΗΣ + λίστα σε ενότητες: το ΕΝΑ σώμα (`SpaceListBody`). */}
      <SpaceListBody
        toolbar={{ bindings: list.toolbarBindings, config: storagesToolbarConfig, onNewItem, logLabel: 'storages' }}
        selectedStatuses={list.selectedStatuses}
        onStatusesChange={list.setSelectedStatuses}
        sections={sections}
        idPrefix="storages-section"
        getKey={(storage) => storage.id}
        renderItem={(storage) => (
          <StorageListCard
            storage={storage}
            isSelected={selectedStorage?.id === storage.id}
            isFavorite={list.favorites.includes(storage.id)}
            onSelect={() => onSelectStorage?.(storage)}
            onToggleFavorite={() => list.toggleFavorite(storage.id)}
          />
        )}
        empty={{
          shown: filteredStorages.length === 0,
          icon: Warehouse,
          text: t('storages.list.noResults'),
          termText: list.searchTerm ? t('storages.list.noResultsForTerm', { term: list.searchTerm }) : undefined,
        }}
      />
    </EntityListColumn>
  );
}



