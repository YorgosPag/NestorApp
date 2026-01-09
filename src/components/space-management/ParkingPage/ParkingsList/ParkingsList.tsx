'use client';

/**
 * 🅿️ ENTERPRISE PARKINGS LIST COMPONENT
 *
 * Λίστα θέσεων στάθμευσης με filtering και sorting
 * Ακολουθεί το exact pattern από StoragesList.tsx
 */

import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Car } from 'lucide-react';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

import { ParkingsListHeader } from './ParkingsListHeader';
// 🏢 ENTERPRISE: Using centralized domain card
import { ParkingListCard } from '@/domain';
import { CompactToolbar } from '@/components/core/CompactToolbar';
import { parkingToolbarConfig } from '@/components/core/CompactToolbar/configs';

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
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'area' | 'price' | 'status' | 'floor' | 'type'>('name');
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

  // Filter parking spots based on search term
  const filteredParkingSpots = parkingSpots.filter(parking => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();

    return parking.number?.toLowerCase().includes(searchLower) ||
           parking.location?.toLowerCase().includes(searchLower) ||
           parking.floor?.toLowerCase().includes(searchLower) ||
           parking.type?.toLowerCase().includes(searchLower) ||
           parking.status?.toLowerCase().includes(searchLower) ||
           parking.notes?.toLowerCase().includes(searchLower);
  });

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
      case 'price':
        aValue = a.price || 0;
        bValue = b.price || 0;
        break;
      case 'status':
        aValue = (a.status || '').toLowerCase();
        bValue = (b.status || '').toLowerCase();
        break;
      case 'floor':
        aValue = (a.floor || '').toLowerCase();
        bValue = (b.floor || '').toLowerCase();
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
    <div className={`min-w-[300px] max-w-[420px] w-full bg-card border ${quick.card} flex flex-col shrink-0 shadow-sm max-h-full overflow-hidden`}>
      <ParkingsListHeader
        parkingSpots={parkingSpots}
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
          searchTerm=""
          onSearchChange={() => {}}
          activeFilters={activeFilters}
          onFiltersChange={setActiveFilters}
          sortBy={sortBy}
          onSortChange={(newSortBy, newSortOrder) => {
            setSortBy(newSortBy as typeof sortBy);
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
            searchTerm=""
            onSearchChange={() => {}}
            activeFilters={activeFilters}
            onFiltersChange={setActiveFilters}
            sortBy={sortBy}
            onSortChange={(newSortBy, newSortOrder) => {
              setSortBy(newSortBy as typeof sortBy);
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
              <p>Δεν βρέθηκαν θέσεις στάθμευσης</p>
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
