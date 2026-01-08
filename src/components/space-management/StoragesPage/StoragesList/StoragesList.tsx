'use client';

import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Warehouse } from 'lucide-react';
import type { Storage } from '@/types/storage/contracts';
import { useIconSizes } from '@/hooks/useIconSizes';

import { StoragesListHeader } from './StoragesListHeader';
// 🏢 ENTERPRISE: Using centralized domain card
import { StorageListCard } from '@/domain';
import { CompactToolbar } from '@/components/core/CompactToolbar';
import { storagesToolbarConfig } from '@/components/core/CompactToolbar/configs';

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
  const iconSizes = useIconSizes();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'area' | 'price' | 'status' | 'building' | 'type'>('name');
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

  // Filter storages based on search term
  const filteredStorages = storages.filter(storage => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();

    // Search in storage name, description, building, and other relevant fields
    return storage.name.toLowerCase().includes(searchLower) ||
           (storage.description && storage.description.toLowerCase().includes(searchLower)) ||
           storage.building.toLowerCase().includes(searchLower) ||
           storage.floor.toLowerCase().includes(searchLower) ||
           storage.type.toLowerCase().includes(searchLower) ||
           storage.status.toLowerCase().includes(searchLower) ||
           (storage.owner && storage.owner.toLowerCase().includes(searchLower));
  });

  const sortedStorages = [...filteredStorages].sort((a, b) => {
    let aValue, bValue;

    switch (sortBy) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'area':
        aValue = a.area;
        bValue = b.area;
        break;
      case 'price':
        aValue = a.price || 0;
        bValue = b.price || 0;
        break;
      case 'status':
        aValue = a.status.toLowerCase();
        bValue = b.status.toLowerCase();
        break;
      case 'building':
        aValue = a.building.toLowerCase();
        bValue = b.building.toLowerCase();
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
    <div className="min-w-[300px] max-w-[420px] w-full bg-card border rounded-lg flex flex-col shrink-0 shadow-sm max-h-full overflow-hidden">
      <StoragesListHeader
        storages={storages}
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
          searchTerm=""
          onSearchChange={() => {}}
          activeFilters={activeFilters}
          onFiltersChange={setActiveFilters}
          sortBy={sortBy}
          onSortChange={(newSortBy, newSortOrder) => {
            setSortBy(newSortBy);
            setSortOrder(newSortOrder);
          }}
          onNewItem={() => console.log('New storage')}
          onEditItem={(id) => console.log('Edit storage:', id)}
          onDeleteItems={(ids) => console.log('Delete storages:', ids)}
          onExport={() => console.log('Export storages')}
          onRefresh={() => console.log('Refresh storages')}
        />
      </div>

      {/* CompactToolbar - Toggleable on Mobile */}
      <div className="md:hidden">
        {showToolbar && (
          <CompactToolbar
            config={storagesToolbarConfig}
            selectedItems={selectedItems}
            onSelectionChange={setSelectedItems}
            searchTerm=""
            onSearchChange={() => {}}
            activeFilters={activeFilters}
            onFiltersChange={setActiveFilters}
            sortBy={sortBy}
            onSortChange={(newSortBy, newSortOrder) => {
              setSortBy(newSortBy);
              setSortOrder(newSortOrder);
            }}
            onNewItem={() => console.log('New storage')}
            onEditItem={(id) => console.log('Edit storage:', id)}
            onDeleteItems={(ids) => console.log('Delete storages:', ids)}
            onExport={() => console.log('Export storages')}
            onRefresh={() => console.log('Refresh storages')}
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
              <p>Δεν βρέθηκαν αποθήκες</p>
              {searchTerm && (
                <p className="text-sm">για τον όρο "{searchTerm}"</p>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}