'use client';

/**
 * 🅿️ ENTERPRISE PARKINGS LIST COMPONENT
 *
 * Λίστα θέσεων στάθμευσης με filtering και sorting
 * Ακολουθεί το exact pattern από StoragesList.tsx
 */

import React, { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Car } from 'lucide-react';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
import { useIconSizes } from '@/hooks/useIconSizes';
import { EntityListColumn } from '@/core/containers';
import { matchesSearchTerm } from '@/lib/search/search';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { ParkingsListHeader } from './ParkingsListHeader';
// 🏢 ENTERPRISE: Using centralized domain card
import { ParkingListCard } from '@/domain';
import { CompactToolbar } from '@/components/core/CompactToolbar';
import { parkingToolbarConfig } from '@/components/core/CompactToolbar/configs';
import type { SortField } from '@/components/core/CompactToolbar/types';

interface ParkingsListProps {
  parkingSpots: ParkingSpot[];
  selectedParking: ParkingSpot | null;
  onSelectParking?: (parking: ParkingSpot) => void;
}

export function ParkingsList({
  parkingSpots,
  selectedParking,
  onSelectParking,
}: ParkingsListProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showToolbar, setShowToolbar] = useState(false);

  const toggleFavorite = (parkingId: string) => {
    setFavorites(prev =>
      prev.includes(parkingId)
        ? prev.filter(id => id !== parkingId)
        : [...prev, parkingId]
    );
  };

  // 🏢 ENTERPRISE: Filter parking spots using centralized search
  const filteredParkingSpots = useMemo(() => {
    return parkingSpots.filter(parking =>
      matchesSearchTerm(
        [
          parking.number,
          parking.location,
          parking.floor,
          parking.type,
          parking.status,
          parking.notes,
          parking.area,       // number OK
          parking.price       // number OK
        ],
        searchTerm
      )
    );
  }, [parkingSpots, searchTerm]);

  const sortedParkingSpots = [...filteredParkingSpots].sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    switch (sortBy) {
      case 'name':
        aValue = (a.number || '').toLowerCase();
        bValue = (b.number || '').toLowerCase();
        break;
      case 'area':
        aValue = a.area || 0;
        bValue = b.area || 0;
        break;
      case 'value':
        aValue = a.price || 0;
        bValue = b.price || 0;
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
    <EntityListColumn hasBorder aria-label={t('parkings.list.ariaLabel')}>
      <ParkingsListHeader
        parkingSpots={sortedParkingSpots}  // 🏢 ENTERPRISE: Περνάμε filtered results για δυναμικό count
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        showToolbar={showToolbar}
        onToolbarToggle={setShowToolbar}
      />

      {/* CompactToolbar - Always visible on Desktop, Toggleable on Mobile */}
      <div className="hidden md:block">
        <CompactToolbar
          config={parkingToolbarConfig}
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
          onNewItem={() => console.log('New parking')}
          onEditItem={(id) => console.log('Edit parking:', id)}
          onDeleteItems={(ids) => console.log('Delete parking:', ids)}
          onExport={() => console.log('Export parking')}
          onRefresh={() => console.log('Refresh parking')}
        />
      </div>

      {/* CompactToolbar - Toggleable on Mobile */}
      <div className="md:hidden">
        {showToolbar && (
          <CompactToolbar
            config={parkingToolbarConfig}
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
            onNewItem={() => console.log('New parking')}
            onEditItem={(id) => console.log('Edit parking:', id)}
            onDeleteItems={(ids) => console.log('Delete parking:', ids)}
            onExport={() => console.log('Export parking')}
            onRefresh={() => console.log('Refresh parking')}
          />
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {sortedParkingSpots.map((parking) => (
            <ParkingListCard
              key={parking.id}
              parking={parking}
              isSelected={selectedParking?.id === parking.id}
              isFavorite={favorites.includes(parking.id)}
              onSelect={() => onSelectParking?.(parking)}
              onToggleFavorite={() => toggleFavorite(parking.id)}
            />
          ))}

          {sortedParkingSpots.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Car className={`${iconSizes.xl3} mx-auto mb-2 opacity-50`} />
              <p>{t('parkings.list.noResults')}</p>
              {searchTerm && (
                <p className="text-sm">{t('parkings.list.noResultsForTerm', { term: searchTerm })}</p>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </EntityListColumn>
  );
}


