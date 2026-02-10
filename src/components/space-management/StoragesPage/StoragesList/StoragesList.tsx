'use client';

import React, { useState, useMemo } from 'react';
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
import { CompactToolbar } from '@/components/core/CompactToolbar';
import { storagesToolbarConfig } from '@/components/core/CompactToolbar/configs';
import type { SortField } from '@/components/core/CompactToolbar/types';

interface StoragesListProps {
  storages: Storage[];
  selectedStorage: Storage | null;
  onSelectStorage?: (storage: Storage) => void;
}

export function StoragesList({
  storages,
  selectedStorage,
  onSelectStorage,
}: StoragesListProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('storage');
  const iconSizes = useIconSizes();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showToolbar, setShowToolbar] = useState(false);

  const toggleFavorite = (storageId: string) => {
    setFavorites(prev =>
      prev.includes(storageId)
        ? prev.filter(id => id !== storageId)
        : [...prev, storageId]
    );
  };

  // 🏢 ENTERPRISE: Filter storages using centralized search
  const filteredStorages = useMemo(() => {
    return storages.filter(storage =>
      matchesSearchTerm(
        [
          storage.name,
          storage.description,
          storage.building,
          storage.floor,      // number OK
          storage.type,
          storage.status,
          storage.owner,
          storage.area,       // number OK
          storage.price       // number OK
        ],
        searchTerm
      )
    );
  }, [storages, searchTerm]);

  const sortedStorages = [...filteredStorages].sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    switch (sortBy) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'area':
        aValue = a.area;
        bValue = b.area;
        break;
      case 'value':
        aValue = a.price || 0;
        bValue = b.price || 0;
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

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    } else {
      return sortOrder === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    }
  });

  return (
    <EntityListColumn hasBorder aria-label={t('storages.list.ariaLabel')}>
      <StoragesListHeader
        storages={sortedStorages}  // 🏢 ENTERPRISE: Περνάμε filtered results για δυναμικό count
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        showToolbar={showToolbar}
        onToolbarToggle={setShowToolbar}
      />

      {/* CompactToolbar - Always visible on Desktop, Toggleable on Mobile */}
      <div className="hidden md:block">
        <CompactToolbar
          config={storagesToolbarConfig}
          selectedItems={selectedItems}
          onSelectionChange={setSelectedItems}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          activeFilters={activeFilters}
          onFiltersChange={setActiveFilters}
          sortBy={sortBy}
          onSortChange={(newSortBy, newSortOrder) => {
            setSortBy(newSortBy);
            setSortOrder(newSortOrder);
          }}
          onNewItem={() => logger.info('New storage')}
          onEditItem={(id) => logger.info('Edit storage', { id })}
          onDeleteItems={(ids) => logger.info('Delete storages', { ids })}
          onExport={() => logger.info('Export storages')}
          onRefresh={() => logger.info('Refresh storages')}
        />
      </div>

      {/* CompactToolbar - Toggleable on Mobile */}
      <div className="md:hidden">
        {showToolbar && (
          <CompactToolbar
            config={storagesToolbarConfig}
            selectedItems={selectedItems}
            onSelectionChange={setSelectedItems}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            activeFilters={activeFilters}
            onFiltersChange={setActiveFilters}
            sortBy={sortBy}
            onSortChange={(newSortBy, newSortOrder) => {
              setSortBy(newSortBy);
              setSortOrder(newSortOrder);
            }}
            onNewItem={() => logger.info('New storage')}
            onEditItem={(id) => logger.info('Edit storage', { id })}
            onDeleteItems={(ids) => logger.info('Delete storages', { ids })}
            onExport={() => logger.info('Export storages')}
            onRefresh={() => logger.info('Refresh storages')}
          />
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {sortedStorages.map((storage) => (
            <StorageListCard
              key={storage.id}
              storage={storage}
              isSelected={selectedStorage?.id === storage.id}
              isFavorite={favorites.includes(storage.id)}
              onSelect={() => onSelectStorage?.(storage)}
              onToggleFavorite={() => toggleFavorite(storage.id)}
            />
          ))}

          {sortedStorages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Warehouse className={`${iconSizes.xl3} mx-auto mb-2 opacity-50`} />
              <p>{t('storages.list.noResults')}</p>
              {searchTerm && (
                <p className="text-sm">{t('storages.list.noResultsForTerm', { term: searchTerm })}</p>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </EntityListColumn>
  );
}



