'use client';

import React, { useMemo } from 'react';
import { useEntityListState } from '@/hooks/useEntityListState';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Warehouse } from 'lucide-react';
import type { Storage } from '@/types/storage/contracts';
import { useIconSizes } from '@/hooks/useIconSizes';
import { EntityListColumn } from '@/core/containers';
import { matchesSearchTerm } from '@/lib/search/search';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('StoragesList');

import { StoragesListHeader } from './StoragesListHeader';
// 🏢 ENTERPRISE: Using centralized domain card
import { StorageListCard } from '@/domain';
import { ResponsiveCompactToolbar } from '@/components/core/CompactToolbar';
import { storagesToolbarConfig } from '@/components/core/CompactToolbar/configs';
import type { SortField } from '@/components/core/CompactToolbar/types';
import '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { StorageStatusQuickFilters } from '@/components/shared/SpaceStatusQuickFilters';
import { compareSortValues } from '@/lib/array-utils';
import { priceSortKey } from '@/lib/properties/price-resolver';

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
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();

  // Η κατάσταση που κρατά ΚΑΘΕ σελίδα λίστας — μία δήλωση, δες `useEntityListState`.
  const list = useEntityListState<SortField>({ defaultSortField: 'name' });

  // 🏢 ENTERPRISE: Filter storages using centralized search + status quick filter
  const filteredStorages = useMemo(() => {
    return storages.filter(storage => {
      if (list.selectedStatuses.length > 0 && !list.selectedStatuses.includes(storage.status)) {
        return false;
      }
      return matchesSearchTerm(
        [
          storage.name,
          storage.description,
          storage.building,
          storage.floor,
          storage.type,
          storage.status,
          storage.owner,
          storage.area,
          storage.price
        ],
        list.searchTerm
      );
    });
  }, [storages, list.searchTerm, list.selectedStatuses]);

  const sortedStorages = [...filteredStorages].sort((a, b) => {
    let aValue: string | number | null;
    let bValue: string | number | null;

    switch (list.sortBy) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'area':
        aValue = a.area;
        bValue = b.area;
        break;
      case 'value':
        aValue = priceSortKey(a);
        bValue = priceSortKey(b);
        break;
      case 'status':
        aValue = a.status.toLowerCase();
        bValue = b.status.toLowerCase();
        break;
      case 'location':
        aValue = a.building.toLowerCase();
        bValue = b.building.toLowerCase();
        break;
      case 'number':
        aValue = a.floor.toLowerCase();
        bValue = b.floor.toLowerCase();
        break;
      case 'date':
        aValue = a.lastUpdated instanceof Date ? a.lastUpdated.getTime() : a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
        bValue = b.lastUpdated instanceof Date ? b.lastUpdated.getTime() : b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
        break;
      case 'type':
        aValue = a.type.toLowerCase();
        bValue = b.type.toLowerCase();
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
    <EntityListColumn hasBorder aria-label={t('storages.list.ariaLabel')}>
      <StoragesListHeader
        storages={sortedStorages}  // 🏢 ENTERPRISE: Περνάμε filtered results για δυναμικό count
        searchTerm={list.searchTerm}
        onSearchChange={list.setSearchTerm}
        showToolbar={list.showToolbar}
        onToolbarToggle={list.setShowToolbar}
      />

      {/* Πάντα ορατή σε desktop, πίσω από τον διακόπτη σε κινητό — ΜΙΑ φορά τα props */}
      <ResponsiveCompactToolbar
        {...list.toolbarBindings}
        config={storagesToolbarConfig}
        onNewItem={() => onNewItem?.()}
        onEditItem={(id) => logger.info('Edit storage', { id })}
        onDeleteItems={(ids) => logger.info('Delete storages', { ids })}
        onExport={() => logger.info('Export storages')}
        onRefresh={() => logger.info('Refresh storages')}
      />

      {/* 🏢 ENTERPRISE: Quick Filters for Storage Status */}
      <StorageStatusQuickFilters
        selectedTypes={list.selectedStatuses}
        onTypeChange={list.setSelectedStatuses}
        compact
      />

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {sortedStorages.map((storage) => (
            <StorageListCard
              key={storage.id}
              storage={storage}
              isSelected={selectedStorage?.id === storage.id}
              isFavorite={list.favorites.includes(storage.id)}
              onSelect={() => onSelectStorage?.(storage)}
              onToggleFavorite={() => list.toggleFavorite(storage.id)}
            />
          ))}

          {sortedStorages.length === 0 && (
            <div className={cn("text-center py-8", colors.text.muted)}>
              <Warehouse className={`${iconSizes.xl3} mx-auto mb-2 opacity-50`} />
              <p>{t('storages.list.noResults')}</p>
              {list.searchTerm && (
                <p className="text-sm">{t('storages.list.noResultsForTerm', { term: list.searchTerm })}</p>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </EntityListColumn>
  );
}



