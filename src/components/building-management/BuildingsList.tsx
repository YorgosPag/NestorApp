
'use client';

import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import type { Building } from './BuildingsPageContent';

import { BuildingsListHeader } from './BuildingsList/BuildingsListHeader';
// 🏢 ENTERPRISE: Using centralized domain card
import { BuildingListCard } from '@/domain';
import { CompactToolbar, buildingsConfig } from '@/components/core/CompactToolbar';


interface BuildingsListProps {
  buildings: Building[];
  selectedBuilding: Building | null;
  onSelectBuilding?: (building: Building) => void;
}

export function BuildingsList({
  buildings,
  selectedBuilding,
  onSelectBuilding,
}: BuildingsListProps) {
  const { quick } = useBorderTokens();
  const [favorites, setFavorites] = useState<string[]>(['1']);
  const [sortBy, setSortBy] = useState<'name' | 'progress' | 'value' | 'area' | 'date'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showToolbar, setShowToolbar] = useState(false);

  const toggleFavorite = (buildingId: string) => {
    setFavorites(prev => 
      prev.includes(buildingId) 
        ? prev.filter(id => id !== buildingId)
        : [...prev, buildingId]
    );
  };

  // Filter buildings based on search term
  const filteredBuildings = buildings.filter(building => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();

    // Search in building name, description, location, and other relevant fields
    return building.name.toLowerCase().includes(searchLower) ||
           (building.description && building.description.toLowerCase().includes(searchLower)) ||
           (building.location && building.location.toLowerCase().includes(searchLower)) ||
           (building.address && building.address.toLowerCase().includes(searchLower)) ||
           (building.status && building.status.toLowerCase().includes(searchLower));
  });

  const sortedBuildings = [...filteredBuildings].sort((a, b) => {
    let aValue, bValue;

    switch (sortBy) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'progress':
        aValue = a.progress;
        bValue = b.progress;
        break;
      case 'value':
        aValue = a.totalValue;
        bValue = b.totalValue;
        break;
      case 'area':
        aValue = a.totalArea;
        bValue = b.totalArea;
        break;
      case 'date':
        // Assuming buildings have a createdAt or updatedAt field
        // If not available, we can use id as a proxy for creation order
        aValue = new Date(a.createdAt || a.id).getTime();
        bValue = new Date(b.createdAt || b.id).getTime();
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
    <div className={`min-w-[300px] max-w-[420px] w-full bg-card ${quick.card} flex flex-col shrink-0 shadow-sm max-h-full overflow-hidden`}>
      <BuildingsListHeader
        buildingCount={buildings.length}
        showToolbar={showToolbar}
        onToolbarToggle={setShowToolbar}
      />

      {/* CompactToolbar - Always visible on Desktop, Toggleable on Mobile */}
      <div className="hidden md:block">
        <CompactToolbar
          config={buildingsConfig}
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
          onNewItem={() => {}}
          onEditItem={(id) => {}}
          onDeleteItems={(ids) => {}}
          onExport={() => console.log('Export buildings')}
          onRefresh={() => console.log('Refresh buildings')}
        />
      </div>

      {/* CompactToolbar - Toggleable on Mobile */}
      <div className="md:hidden">
        {showToolbar && (
          <CompactToolbar
            config={buildingsConfig}
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
            onNewItem={() => {}}
            onEditItem={(id) => {}}
            onDeleteItems={(ids) => {}}
            onExport={() => console.log('Export buildings')}
            onRefresh={() => console.log('Refresh buildings')}
          />
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {sortedBuildings.map((building) => (
            <BuildingListCard
              key={building.id}
              building={building}
              isSelected={selectedBuilding?.id === building.id}
              isFavorite={favorites.includes(building.id)}
              onSelect={() => onSelectBuilding?.(building)}
              onToggleFavorite={() => toggleFavorite(building.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
