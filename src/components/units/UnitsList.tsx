'use client';

import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UnitsListHeader } from './list/UnitsListHeader';
import { UnitListItem } from './list/UnitListItem';
import { UnitsToolbar } from '@/features/units-toolbar/UnitsToolbar';
import type { Property } from '@/types/property-viewer';
import { useUnitsViewerState } from '@/hooks/useUnitsViewerState';

export type UnitSortKey = 'name' | 'price' | 'area';

interface UnitsListProps {
  units: Property[];
  selectedUnitIds: string[];
  onSelectUnit: (unitId: string, isShift: boolean) => void;
  onAssignmentSuccess: () => void;
}

export function UnitsList({ 
  units, 
  selectedUnitIds, 
  onSelectUnit,
  onAssignmentSuccess,
}: UnitsListProps) {
  const [favorites, setFavorites] = useState<string[]>(['prop-1']);
  const [sortBy, setSortBy] = useState<UnitSortKey>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const toggleFavorite = (unitId: string) => {
    setFavorites(prev => 
      prev.includes(unitId) 
        ? prev.filter(id => id !== unitId)
        : [...prev, unitId]
    );
  };

  const sortedUnits = [...units].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'price':
        aValue = a.price || 0;
        bValue = b.price || 0;
        break;
      case 'area':
        aValue = a.area || 0;
        bValue = b.area || 0;
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
        onSelectUnit('__all__', false);
    } else {
        onSelectUnit('__none__', false);
    }
  };

  const availableCount = units.filter(u => u.status === 'for-sale' || u.status === 'for-rent').length;
  const totalValue = units.reduce((sum, u) => sum + (u.price || 0), 0);

  return (
    <div className="min-w-[420px] max-w-[420px] w-full bg-card border rounded-lg flex flex-col shrink-0 shadow-sm max-h-full overflow-hidden">
      <UnitsListHeader 
        unitCount={units.length}
        availableCount={availableCount}
        totalValue={totalValue}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
      />

      <UnitsToolbar 
        selectedUnitIds={selectedUnitIds}
        onSelectAll={handleSelectAll}
        onClearSelection={() => onSelectUnit('__none__', false)}
        onAssignmentSuccess={onAssignmentSuccess}
        totalUnits={units.length}
      />

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {sortedUnits.map((unit) => (
            <UnitListItem
              key={unit.id}
              unit={unit}
              isSelected={selectedUnitIds.includes(unit.id)}
              isFavorite={favorites.includes(unit.id)}
              onSelect={(isShift) => onSelectUnit(unit.id, isShift)}
              onToggleFavorite={() => toggleFavorite(unit.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
