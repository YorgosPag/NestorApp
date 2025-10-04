
'use client';

import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BuildingToolbar } from './BuildingToolbar';
import type { Building } from './BuildingsPageContent';

import { BuildingsListHeader } from './BuildingsList/BuildingsListHeader';
import { BuildingListItem } from './BuildingsList/BuildingListItem';


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
  const [favorites, setFavorites] = useState<number[]>([1]);
  const [sortBy, setSortBy] = useState<'name' | 'progress' | 'value' | 'area'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const toggleFavorite = (buildingId: number) => {
    setFavorites(prev => 
      prev.includes(buildingId) 
        ? prev.filter(id => id !== buildingId)
        : [...prev, buildingId]
    );
  };

  const sortedBuildings = [...buildings].sort((a, b) => {
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
      <BuildingsListHeader 
        buildingCount={buildings.length}
        activeProjectsCount={buildings.filter(b => b.status === 'active' || b.status === 'construction').length}
        totalValue={buildings.reduce((sum, b) => sum + (b.totalValue || 0), 0)}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
      />

      <BuildingToolbar />

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {sortedBuildings.map((building) => (
            <BuildingListItem
              key={building.id}
              building={building}
              isSelected={selectedBuilding?.id === building.id}
              isFavorite={favorites.includes(Number(building.id))}
              onSelect={() => onSelectBuilding?.(building)}
              onToggleFavorite={() => toggleFavorite(Number(building.id))}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
