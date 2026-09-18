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
import type { SortableValue } from '@/lib/array-utils';
import { compareByNameThenId } from '@/lib/ordering/total-name-order';
import { sortIntoPriceClassSections } from '@/lib/properties/price-class-sections';
import { PriceClassSectionedList } from '@/components/shared/price-sections/PriceClassSectionedList';

/** Ολική σειρά για ισοπαλίες και απουσία τιμής: όνομα → `id`. */
function byNameThenId(a: Storage, b: Storage): number {
  return compareByNameThenId(a.name, a.id, b.name, b.id);
}

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
    case 'status':
      return x.status.toLowerCase();
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

  /*
    🔑 ADR-777 §8.60.14.14 — «κατά αξία» = ΠΡΩΤΑ η μονάδα, ΜΕΤΑ ο αριθμός (Revit `Sort By` →
    `Then By`): τμήματα ανά κλάση, ποτέ €/μήνα και € πώλησης σε έναν άξονα.
  */
  const sections = useMemo(
    () => sortIntoPriceClassSections(filteredStorages, {
      byPrice: list.sortBy === 'value',
      direction: list.sortOrder,
      tieBreak: byNameThenId,
      valueOf: (storage) => storageSortValue(storage, list.sortBy),
    }),
    [filteredStorages, list.sortBy, list.sortOrder],
  );

  return (
    <EntityListColumn hasBorder aria-label={t('storages.list.ariaLabel')}>
      <StoragesListHeader
        storages={filteredStorages}  // 🏢 ENTERPRISE: Περνάμε filtered results για δυναμικό count
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
          <PriceClassSectionedList
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
          />

          {filteredStorages.length === 0 && (
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



